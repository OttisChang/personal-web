import json
import logging
import os
from datetime import datetime, timezone
from typing import Callable, List, Optional

from duckduckgo_search import DDGS
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

from agents import AGENTS_BY_NAME, Agent, SUB_AGENT_NAMES, build_routing_system, make_think_filter, root_agent, strip_thinking
from database import get_db
from mcp_tools.weather import get_weather, get_weather_forecast

router = APIRouter()
logger = logging.getLogger(__name__)


def _make_groq_client() -> Optional[OpenAI]:
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        return OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    return None

_groq = _make_groq_client()


def _execute_web_search(query: str) -> list[dict]:
    results = []
    try:
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=5):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
    except Exception:
        pass
    return results


class HistoryTurn(BaseModel):
    role: str
    content: str

class WebSearchRequest(BaseModel):
    query: str
    history: List[HistoryTurn] = []
    session_id: Optional[str] = None

class SearchSource(BaseModel):
    title: str
    url: str
    snippet: str

class WebSearchResponse(BaseModel):
    answer: str
    sources: List[SearchSource]
    search_query: Optional[str] = None
    tool_used: Optional[str] = None
    current_agent: Optional[str] = None


_ROUTING_SYSTEM = build_routing_system()
_TOOL_LABELS: dict[str, str] = {a.name: a.label for a in root_agent.sub_agents}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


# -- 既有 4 個工具，統一回傳 (tool_result, sources_data, search_label) --

async def _handle_get_weather(routing: dict, query: str) -> tuple[str, list[dict], str]:
    city = routing.get("city", "")
    country = routing.get("country", "")
    logger.info(f"🌤️ get_weather(city={city}, country={country})")
    tool_result = await get_weather(city=city, country=country)
    return tool_result, [], city


async def _handle_get_weather_forecast(routing: dict, query: str) -> tuple[str, list[dict], str]:
    city = routing.get("city", "")
    logger.info(f"📅 get_weather_forecast(city={city})")
    tool_result = await get_weather_forecast(city=city)
    return tool_result, [], city


async def _handle_esun_exchange_rate(routing: dict, query: str) -> tuple[str, list[dict], str]:
    from mcp_tools.exchange_rate import esun_exchange_rate as _esun_fn
    logger.info("💱 esun_exchange_rate()")
    raw = await _esun_fn()
    return json.dumps(raw, ensure_ascii=False), [], "玉山銀行匯率"


async def _handle_search_documents(routing: dict, query: str) -> tuple[str, list[dict], str]:
    from mcp_tools.document_rag import search_documents as _search_fn
    logger.info(f"📚 search_documents(query={query})")
    tool_result = await _search_fn(query=query)
    return tool_result, [], "知識庫"


async def _handle_web_search(routing: dict, query: str) -> tuple[str, list[dict], str]:
    search_query = routing.get("search_query", query).strip().strip('"')
    results = _execute_web_search(search_query)
    sources_data = [{"title": r["title"], "url": r["url"], "snippet": r["snippet"]} for r in results]
    context = "\n\n".join(
        f"[{i+1}] {r['title']}\n{r['snippet']}\n來源: {r['url']}"
        for i, r in enumerate(results)
    ) if results else "（無搜尋結果）"
    return context, sources_data, search_query


_TOOL_HANDLERS: dict[str, Callable] = {
    "get_weather": _handle_get_weather,
    "get_weather_forecast": _handle_get_weather_forecast,
    "esun_exchange_rate": _handle_esun_exchange_rate,
    "search_documents": _handle_search_documents,
    "web_search": _handle_web_search,
}


async def _run_sub_agent(agent: Agent, query: str, history_messages: list[dict], attractions: list[str]) -> dict:
    """單次 JSON-mode Groq 呼叫，用 sub-agent 自己的 persona。
    回傳 {"reply": str, "stay": bool, "attractions_add": list[str]}。
    絕不 raise——解析失敗時預設 stay=True，避免因模型格式偶發錯誤就把使用者踢出目前的 sub-agent。"""
    user_content = query
    if agent.name == "attractions_planner" and attractions:
        user_content = f"{query}\n\n目前已收藏的景點清單：{json.dumps(attractions, ensure_ascii=False)}"

    resp = _groq.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": agent.instruction},
            *history_messages,
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )
    try:
        data = json.loads(strip_thinking(resp.choices[0].message.content) or "{}")
    except Exception:
        data = {}

    attractions_add = []
    if agent.name == "attractions_planner":
        attractions_add = [s for s in data.get("attractions_add", []) if isinstance(s, str) and s.strip()]

    return {
        "reply": (data.get("reply") or "").strip() or "不好意思，我這輪沒有理解清楚，可以再說一次嗎？",
        "stay": bool(data.get("stay", True)),
        "attractions_add": attractions_add,
    }


async def _load_session_state(session_id: Optional[str]) -> tuple[Optional[str], list[str]]:
    """回傳 (current_agent, attractions)。session_id 不存在、Mongo 文件不存在、或任何
    Mongo 例外，都退化成 (None, [])，只記 warning，不 raise——保留無 Mongo 也能跑的能力。"""
    if not session_id:
        return None, []
    try:
        db = get_db()
        doc = await db.chat_sessions.find_one(
            {"_id": session_id}, {"current_agent": 1, "attractions": 1}
        )
    except Exception as e:
        logger.warning(f"Mongo session state read failed, degrading to stateless: {e}")
        return None, []

    if not doc:
        return None, []

    current_agent = doc.get("current_agent")
    if current_agent not in SUB_AGENT_NAMES:
        current_agent = None
    attractions = [a for a in (doc.get("attractions") or []) if isinstance(a, str)]
    return current_agent, attractions


async def _save_session_state(session_id: Optional[str], current_agent: Optional[str], attractions: list[str]) -> None:
    if not session_id:
        return
    try:
        db = get_db()
        await db.chat_sessions.update_one(
            {"_id": session_id},
            {"$set": {
                "current_agent": current_agent,
                "attractions": attractions,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
    except Exception as e:
        logger.warning(f"Mongo session state write failed (non-fatal): {e}")


@router.post("/api/web-search")
async def web_search_endpoint(body: WebSearchRequest):
    if _groq is None:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY 未設定。請在 backend/.env 設定。")

    # 只保留最近幾輪對話作為上下文，避免 prompt 無限增長
    history_messages = [{"role": h.role, "content": h.content} for h in body.history][-12:]

    async def generate():
        import asyncio
        model = "openai/gpt-oss-120b"
        try:
            current_agent, attractions = await _load_session_state(body.session_id)

            # 是否延續上一輪的 sub-agent 尚未判斷完成，此時不能先亮出該 agent 的名稱
            # （避免使用者問了不相關的問題時，畫面卻誤顯示「XX Agent（延續）」）。
            yield _sse({"type": "routing", "tool": None, "label": None})
            await asyncio.sleep(0)

            answer: str = ""
            sources_data: list[dict] = []
            search_label = ""
            new_current_agent: Optional[str] = None
            answer_ready = False
            used_sticky_shortcut = False
            tool_result = ""

            # -- 黏著延續：只打 1 次 LLM，完全跳過 routing 分類呼叫 --
            if current_agent in SUB_AGENT_NAMES:
                agent = AGENTS_BY_NAME[current_agent]
                result = await _run_sub_agent(agent, body.query, history_messages, attractions)
                if result["stay"]:
                    used_sticky_shortcut = True
                    answer_ready = True
                    answer = result["reply"]
                    if result["attractions_add"]:
                        attractions = attractions + [a for a in result["attractions_add"] if a not in attractions]
                    new_current_agent = agent.name

            if not used_sticky_shortcut:
                # -- 全新路由分類（首輪，或黏著在這輪被打斷）--
                routing_resp = _groq.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": _ROUTING_SYSTEM},
                        *history_messages,
                        {"role": "user", "content": body.query},
                    ],
                    response_format={"type": "json_object"},
                )
                try:
                    routing = json.loads(strip_thinking(routing_resp.choices[0].message.content) or "{}")
                except Exception:
                    routing = {"agent": "web_search", "search_query": body.query}

                agent_name = routing.get("agent", "web_search")
                agent = AGENTS_BY_NAME.get(agent_name) or AGENTS_BY_NAME["web_search"]
                logger.info(f"🔀 AI routing: {routing}")

                if agent.kind == "sub_agent":
                    result = await _run_sub_agent(agent, body.query, history_messages, attractions)
                    answer_ready = True
                    answer = result["reply"]
                    if agent.name == "attractions_planner" and result["attractions_add"]:
                        attractions = attractions + [a for a in result["attractions_add"] if a not in attractions]
                    new_current_agent = agent.name if result["stay"] else None
                else:
                    leaf_tool = routing.get("tool") if len(agent.tools) > 1 else agent.tools[0]
                    if leaf_tool not in agent.tools:
                        leaf_tool = agent.tools[0]
                    handler = _TOOL_HANDLERS[leaf_tool]
                    tool_result, sources_data, search_label = await handler(routing, body.query)
                    new_current_agent = None  # tool_agent 永不黏著

            tool_label = _TOOL_LABELS.get(agent.name, agent.name)
            if used_sticky_shortcut:
                tool_label = f"{tool_label}（延續）"
            yield _sse({"type": "tool_selected", "tool": agent.name, "label": tool_label})
            await asyncio.sleep(0)

            yield _sse({"type": "executing"})

            if not answer_ready:
                answer_messages = [
                    {"role": "system", "content": agent.instruction},
                    *history_messages,
                    {"role": "user", "content": (
                        f"問題：{body.query}\n\n資料：\n{tool_result}\n\n"
                        "【提醒】請務必使用「問題」中使用者提問所使用的語言作答（例如問題是英文就全程用"
                        "英文回答），不要被「資料」的語言影響，即使資料是中文，你的回答語言仍要跟著問題走。"
                    )},
                ]
                # 用串流模式即時把每個 token 送到前端，同時用 think_filter 把
                # <think>...</think> 推理區塊濾掉，只把正式回答的片段吐給使用者
                feed, flush = make_think_filter()
                visible_answer = ""
                answer_stream = _groq.chat.completions.create(model=model, messages=answer_messages, stream=True)
                for chunk in answer_stream:
                    delta = chunk.choices[0].delta.content or ""
                    if not delta:
                        continue
                    visible = feed(delta)
                    if visible:
                        visible_answer += visible
                        yield _sse({"type": "answer_chunk", "delta": visible})
                        await asyncio.sleep(0)
                tail = flush()
                if tail:
                    visible_answer += tail
                    yield _sse({"type": "answer_chunk", "delta": tail})
                    await asyncio.sleep(0)
                answer = visible_answer.strip() or "無法取得答案，請稍後再試。"
            else:
                # sticky / sub-agent 分支答案已在路由階段透過 JSON mode 一次生成完畢，
                # 無法逐字串流，直接整段當作一個 chunk 送出，維持前端事件處理一致
                yield _sse({"type": "answer_chunk", "delta": answer})
                await asyncio.sleep(0)

            await _save_session_state(body.session_id, new_current_agent, attractions)

            yield _sse({
                "type": "done",
                "answer": answer,
                "sources": sources_data,
                "search_query": search_label,
                "tool_used": agent.name,
                "current_agent": new_current_agent,
            })

        except Exception as e:
            logger.error(f"❌ SSE error: {e}")
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
