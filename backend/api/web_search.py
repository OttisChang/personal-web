import json
import logging
import os
from typing import List, Optional

from duckduckgo_search import DDGS
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

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


class WebSearchRequest(BaseModel):
    query: str

class SearchSource(BaseModel):
    title: str
    url: str
    snippet: str

class WebSearchResponse(BaseModel):
    answer: str
    sources: List[SearchSource]
    search_query: Optional[str] = None
    tool_used: Optional[str] = None


_ROUTING_SYSTEM = """你是一個智慧助手的工具路由器。根據使用者的問題，決定應該使用哪個工具來回答，並以 JSON 格式回覆。

可用工具：
- get_weather：查詢任何城市的「即時」天氣（現在的溫度、濕度、風速、是否下雨）
- get_weather_forecast：查詢台灣縣市「未來」天氣預報（明天、後天、週末、未來幾天的降雨機率、溫度區間）
- esun_exchange_rate：查詢玉山銀行即時外幣牌告匯率（美金、日圓、歐元、港幣、人民幣等）
- web_search：網路搜尋，適用於其他一般問題

判斷原則：
- 問「現在/目前/今天即時」天氣 → get_weather
- 問「明天/後天/週末/未來」天氣或「會不會下雨（非即時）」 → get_weather_forecast
- 問匯率/外幣 → esun_exchange_rate
- 其他 → web_search

回覆格式（只回覆 JSON，不要加任何說明或 markdown）：
{"tool": "get_weather", "city": "城市名稱", "country": "國家（可選，非台灣才填）"}
{"tool": "get_weather_forecast", "city": "台灣縣市名稱"}
{"tool": "esun_exchange_rate"}
{"tool": "web_search", "search_query": "最佳搜尋關鍵字"}"""

_ZH_TW = "請務必使用繁體中文（Traditional Chinese）回答，不要使用簡體中文或英文。"

_TOOL_LABELS: dict[str, str] = {
    "get_weather": "即時天氣MCP",
    "get_weather_forecast": "天氣預報MCP",
    "esun_exchange_rate": "匯率MCP工具",
    "web_search": "網路搜尋",
}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/api/web-search")
async def web_search_endpoint(body: WebSearchRequest):
    if _groq is None:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY 未設定。請在 backend/.env 設定。")

    async def generate():
        import asyncio
        model = "llama-3.3-70b-versatile"
        try:
            yield _sse({"type": "routing"})
            await asyncio.sleep(0)

            routing_resp = _groq.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": _ROUTING_SYSTEM},
                    {"role": "user", "content": body.query},
                ],
                response_format={"type": "json_object"},
            )
            try:
                routing = json.loads(routing_resp.choices[0].message.content or "{}")
            except Exception:
                routing = {"tool": "web_search", "search_query": body.query}

            tool_name = routing.get("tool", "web_search")
            tool_label = _TOOL_LABELS.get(tool_name, tool_name)
            logger.info(f"🔀 AI routing: {routing}")

            yield _sse({"type": "tool_selected", "tool": tool_name, "label": tool_label})
            await asyncio.sleep(0)

            sources_data: list[dict] = []
            search_label = ""

            if tool_name == "get_weather":
                city = routing.get("city", "")
                country = routing.get("country", "")
                logger.info(f"🌤️ get_weather(city={city}, country={country})")
                tool_result = await get_weather(city=city, country=country)
                search_label = city
                answer_messages = [
                    {"role": "system", "content": f"你是天氣助手，請根據以下即時天氣資料友善地回答使用者。{_ZH_TW}"},
                    {"role": "user", "content": f"問題：{body.query}\n\n天氣資料：\n{tool_result}"},
                ]

            elif tool_name == "get_weather_forecast":
                city = routing.get("city", "")
                logger.info(f"📅 get_weather_forecast(city={city})")
                tool_result = await get_weather_forecast(city=city)
                search_label = city
                answer_messages = [
                    {"role": "system", "content": f"你是天氣預報助手，請根據以下中央氣象署預報資料友善地回答使用者的問題。{_ZH_TW}"},
                    {"role": "user", "content": f"問題：{body.query}\n\n預報資料：\n{tool_result}"},
                ]

            elif tool_name == "esun_exchange_rate":
                from mcp_tools.exchange_rate import esun_exchange_rate as _esun_fn
                logger.info("💱 esun_exchange_rate()")
                raw = await _esun_fn()
                tool_result = json.dumps(raw, ensure_ascii=False)
                search_label = "玉山銀行匯率"
                answer_messages = [
                    {"role": "system", "content": f"你是匯率助手，請根據以下玉山銀行牌告匯率資料回答使用者的問題，只需回答與問題相關的幣別即可。{_ZH_TW}"},
                    {"role": "user", "content": f"問題：{body.query}\n\n匯率資料：{tool_result}"},
                ]

            else:  # web_search
                search_query = routing.get("search_query", body.query).strip().strip('"')
                results = _execute_web_search(search_query)
                sources_data = [{"title": r["title"], "url": r["url"], "snippet": r["snippet"]} for r in results]
                context = "\n\n".join(
                    f"[{i+1}] {r['title']}\n{r['snippet']}\n來源: {r['url']}"
                    for i, r in enumerate(results)
                ) if results else "（無搜尋結果）"
                search_label = search_query
                answer_messages = [
                    {"role": "system", "content": f"你是一個 AI 助手，請根據以下搜尋結果詳細回答使用者的問題。{_ZH_TW}"},
                    {"role": "user", "content": f"問題：{body.query}\n\n搜尋結果：\n{context}"},
                ]

            yield _sse({"type": "executing"})

            answer_resp = _groq.chat.completions.create(model=model, messages=answer_messages)
            answer = answer_resp.choices[0].message.content or "無法取得答案，請稍後再試。"

            yield _sse({
                "type": "done",
                "answer": answer,
                "sources": sources_data,
                "search_query": search_label,
                "tool_used": tool_name,
            })

        except Exception as e:
            logger.error(f"❌ SSE error: {e}")
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
