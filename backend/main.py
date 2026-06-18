import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from duckduckgo_search import DDGS
from mcp_instance import mcp_server
import back_exchange_rate  # noqa: F401 — 載入即註冊 MCP tool

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(title="Personal Website API")

# ── Groq client (Function Calling + DuckDuckGo) ───────────────────────────────
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
                    "snippet": r.get("body", "")
                })
    except Exception:
        pass
    return results


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "https://ottischang.com",
        "https://www.ottischang.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"


class Experience(BaseModel):
    period: str
    company: str
    title: str
    items: List[str]


class Education(BaseModel):
    school: str
    department: str
    period: str


class Profile(BaseModel):
    name: str
    intro: str
    experiences: List[Experience]
    education: Education
    skills: List[str]


def load_profile(lang: str) -> Profile:
    path = DATA_DIR / f"profile_{lang}.json"
    return Profile(**json.loads(path.read_text(encoding="utf-8")))


@app.get("/")
def read_root():
    return {"message": "Personal Website API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/profile", response_model=Profile)
def get_profile(lang: str = Query(default="zh", pattern="^(zh|en)$")):
    return load_profile(lang)


# ── Web Search ─────────────────────────────────────────────────────────────────
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


# Groq Function Calling 工具定義（對應 MCP tool）
GROQ_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查詢城市即時天氣資訊，包含溫度、體感溫度、濕度、風速、降水量等。當使用者詢問任何城市的天氣時使用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名稱，支援中英文，如：台北、東京、New York"
                    },
                    "country": {
                        "type": "string",
                        "description": "國家名稱，可提升查詢準確度，如：Taiwan、Japan、USA（可選）"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather_forecast",
            "description": "查詢台灣縣市未來 36 小時天氣預報，含降雨機率、溫度區間。當使用者問明天、後天、週末天氣，或問未來會不會下雨時使用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "台灣縣市名稱，如：台北、高雄、花蓮"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "esun_exchange_rate",
            "description": "即時查詢玉山銀行外幣匯率（牌告匯率），包含即期買入/賣出、現金買入/賣出。支援美金、日圓、歐元、港幣、人民幣等16種貨幣。當使用者詢問匯率、外幣兌換、外幣價格時使用此工具。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]


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


@app.post("/api/web-search")
async def web_search_endpoint(body: WebSearchRequest):
    if _groq is None:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY 未設定。請在 backend/.env 設定。")

    async def generate():
        import asyncio
        model = "llama-3.3-70b-versatile"
        try:
            # ── 事件 1: routing — AI 正在決策工具 ──────────────────────────────
            yield _sse({"type": "routing"})
            await asyncio.sleep(0)  # flush chunk to client

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

            # ── 事件 2: tool_selected — 已選定工具，開始執行 ────────────────────
            yield _sse({"type": "tool_selected", "tool": tool_name, "label": tool_label})
            await asyncio.sleep(0)  # flush chunk to client

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
                from back_exchange_rate import esun_exchange_rate as _esun_fn
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

            # ── 事件 3: executing — 工具執行完畢，開始生成答案 ──────────────────
            yield _sse({"type": "executing"})

            answer_resp = _groq.chat.completions.create(model=model, messages=answer_messages)
            answer = answer_resp.choices[0].message.content or "無法取得答案，請稍後再試。"

            # ── 事件 4: done — 完成 ──────────────────────────────────────────────
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


import math


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _is_taiwan(lat: float, lon: float) -> bool:
    return 21.9 <= lat <= 25.4 and 119.5 <= lon <= 122.1


async def _get_weather_cwa(lat: float, lon: float, city: str) -> str:
    """中央氣象署 O-A0001-001：找最近測站回傳即時觀測資料。"""
    import httpx

    api_key = os.environ.get("OPENDATA_API_KEY", "")
    url = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params={"Authorization": api_key, "format": "JSON"})
        resp.raise_for_status()
        data = resp.json()

    stations = data.get("records", {}).get("Station", [])
    if not stations:
        raise RuntimeError("CWA 回傳測站清單為空")

    # 找最近測站：優先 WGS84，其次取第一個有效座標
    nearest = None
    min_dist = float("inf")
    for s in stations:
        coords = s.get("GeoInfo", {}).get("Coordinates", [])
        # 優先 WGS84，找不到就用第一個
        wgs = next((c for c in coords if c.get("CoordinateName") == "WGS84"), None)
        c = wgs or (coords[0] if coords else None)
        if c is None:
            continue
        try:
            slat = float(c["StationLatitude"])
            slon = float(c["StationLongitude"])
        except (KeyError, ValueError, TypeError):
            continue
        d = _haversine_km(lat, lon, slat, slon)
        if d < min_dist:
            min_dist = d
            nearest = s

    if nearest is None:
        raise RuntimeError("找不到最近測站")

    name = nearest.get("StationName", "未知")
    obs_time = nearest.get("ObsTime", {}).get("DateTime", "")
    we = nearest.get("WeatherElement", {})

    temp = we.get("AirTemperature", "-")
    humidity = we.get("RelativeHumidity", "-")
    wind_speed = we.get("WindSpeed", "-")
    wind_dir = we.get("WindDirection", "-")
    weather_desc = we.get("Weather", "-")
    precip = we.get("Now", {}).get("Precipitation", "-")
    pressure = we.get("AirPressure", "-")

    return (
        f"📍 地點：{city}（最近測站：{name}，距離 {min_dist:.1f} km）\n"
        f"🕐 觀測時間：{obs_time}\n"
        f"🌤️  天氣：{weather_desc}\n"
        f"🌡️  氣溫：{temp}°C\n"
        f"💧 濕度：{humidity}%\n"
        f"💨 風速：{wind_speed} m/s　風向：{wind_dir}°\n"
        f"🌧️  降水：{precip} mm\n"
        f"🔵 氣壓：{pressure} hPa\n"
        f"📡 資料來源：中央氣象署 O-A0001-001（即時觀測）"
    )


async def _get_weather_openmeteo(lat: float, lon: float, city: str, display_name: str) -> str:
    """Open-Meteo fallback（台灣以外地區）。"""
    import httpx

    weather_codes = {
        0: "晴朗", 1: "大致晴朗", 2: "部分多雲", 3: "多雲",
        45: "有霧", 48: "霧淞",
        51: "毛毛雨（小）", 53: "毛毛雨（中）", 55: "毛毛雨（大）",
        61: "小雨", 63: "中雨", 65: "大雨",
        71: "小雪", 73: "中雪", 75: "大雪",
        80: "陣雨", 81: "陣雨", 82: "強陣雨",
        95: "雷雨", 96: "雷雨夾冰雹", 99: "強雷雨",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                "timezone": "auto",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    current = data.get("current", {})
    condition = weather_codes.get(current.get("weather_code", 0), "未知")

    return (
        f"📍 地點：{city}（{display_name}）\n"
        f"🕐 時間：{current.get('time', '')}（{data.get('timezone', '')}）\n"
        f"🌤️  天氣：{condition}\n"
        f"🌡️  氣溫：{current.get('temperature_2m')}°C\n"
        f"🤔 體感：{current.get('apparent_temperature')}°C\n"
        f"💧 濕度：{current.get('relative_humidity_2m')}%\n"
        f"💨 風速：{current.get('wind_speed_10m')} km/h\n"
        f"🌧️  降水：{current.get('precipitation')} mm\n"
        f"📡 資料來源：Open-Meteo（即時）"
    )


# ── CWA 縣市名稱正規化 ───────────────────────────────────────────────────────
_CWA_COUNTY_MAP: dict[str, str] = {
    k: pairs[1] for pairs in [
        (["台北", "臺北", "台北市", "臺北市"], "臺北市"),
        (["新北", "新北市"], "新北市"),
        (["桃園", "桃園市"], "桃園市"),
        (["台中", "臺中", "台中市", "臺中市"], "臺中市"),
        (["台南", "臺南", "台南市", "臺南市"], "臺南市"),
        (["高雄", "高雄市"], "高雄市"),
        (["基隆", "基隆市"], "基隆市"),
        (["新竹市"], "新竹市"),
        (["新竹", "新竹縣"], "新竹縣"),
        (["苗栗", "苗栗縣"], "苗栗縣"),
        (["彰化", "彰化縣"], "彰化縣"),
        (["南投", "南投縣"], "南投縣"),
        (["雲林", "雲林縣"], "雲林縣"),
        (["嘉義市"], "嘉義市"),
        (["嘉義", "嘉義縣"], "嘉義縣"),
        (["屏東", "屏東縣"], "屏東縣"),
        (["宜蘭", "宜蘭縣"], "宜蘭縣"),
        (["花蓮", "花蓮縣"], "花蓮縣"),
        (["台東", "臺東", "台東縣", "臺東縣"], "臺東縣"),
        (["澎湖", "澎湖縣"], "澎湖縣"),
        (["金門", "金門縣"], "金門縣"),
        (["連江", "連江縣", "馬祖"], "連江縣"),
    ]
    for k in pairs[0]
}



def _normalize_county(city: str) -> str | None:
    return _CWA_COUNTY_MAP.get(city.strip()) or _CWA_COUNTY_MAP.get(city.strip().rstrip("市縣"))


# ── MCP Tool: 天氣預報 ────────────────────────────────────────────────────────
@mcp_server.tool(
    name="get_weather_forecast",
    description=(
        "查詢台灣縣市未來 36 小時天氣預報，包含天氣現象、降雨機率、溫度區間、舒適度。\n"
        "當使用者詢問明天、後天、週末天氣，或詢問未來會不會下雨時使用此工具。\n"
        "僅支援台灣縣市（台北、高雄、台中、花蓮等）。"
    ),
)
async def get_weather_forecast(city: str) -> str:
    import httpx

    logger.info("=" * 60)
    logger.info(f"📅 MCP TOOL: get_weather_forecast() called — city={city}")

    county = _normalize_county(city)
    if not county:
        return f"找不到縣市「{city}」，請輸入台灣縣市名稱（如：台北、高雄、花蓮）。"

    api_key = os.environ.get("OPENDATA_API_KEY", "")
    url = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params={
            "Authorization": api_key,
            "format": "JSON",
            "locationName": county,
        })
        resp.raise_for_status()
        data = resp.json()

    locations = data.get("records", {}).get("location", [])
    if not locations:
        return f"查無 {county} 的預報資料"

    elements: dict[str, list] = {}
    for el in locations[0].get("weatherElement", []):
        elements[el["elementName"]] = el["time"]

    periods = elements.get("Wx", [])
    lines = [f"📅 {county} 未來 36 小時天氣預報\n"]

    def _period_label(start: str, end: str) -> str:
        s = start[5:16].replace("-", "/")
        e = end[11:16]
        hour = int(start[11:13])
        icon = "☀️" if 6 <= hour < 18 else "🌙"
        return f"{icon}  {s} ～ {e}"

    def _val(element_name: str, i: int) -> str:
        times = elements.get(element_name, [])
        if i >= len(times):
            return "-"
        return times[i].get("parameter", {}).get("parameterName", "-")

    for i, t in enumerate(periods):
        start = t.get("startTime", "")
        end = t.get("endTime", "")
        wx = t.get("parameter", {}).get("parameterName", "-")
        pop = _val("PoP", i)
        min_t = _val("MinT", i)
        max_t = _val("MaxT", i)
        ci = _val("CI", i)
        lines.append(
            f"{_period_label(start, end)}\n"
            f"   天氣：{wx}\n"
            f"   降雨機率：{pop}%\n"
            f"   溫度：{min_t}～{max_t}°C\n"
            f"   舒適度：{ci}\n"
        )

    lines.append("📡 資料來源：中央氣象署 F-C0032-001（36小時預報）")
    result = "\n".join(lines)
    logger.info(f"✅ Forecast result:\n{result}")
    logger.info("=" * 60)
    return result


# ── MCP Tool: 查詢天氣 ────────────────────────────────────────────────────────
@mcp_server.tool(
    name="get_weather",
    description=(
        "查詢城市即時天氣資訊（溫度、濕度、風速、天氣狀況等）。\n"
        "台灣地區使用中央氣象署即時觀測資料；其他國家使用 Open-Meteo。\n"
        "支援中英文城市名稱，如：台北、高雄、Tokyo、New York。"
    ),
)
async def get_weather(city: str, country: str = "") -> str:
    import httpx

    logger.info("=" * 60)
    logger.info(f"🌤️  MCP TOOL: get_weather() called — city={city}, country={country}")

    # 步驟 1：Nominatim 地理編碼
    query = f"{city}, {country}" if country else city
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo_resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1},
                headers={"User-Agent": "PersonalWebsiteMCP/1.0"},
            )
            geo_resp.raise_for_status()
            geo_data = geo_resp.json()

        if not geo_data:
            return f"找不到城市：{query}"

        lat = float(geo_data[0]["lat"])
        lon = float(geo_data[0]["lon"])
        display_name = geo_data[0].get("display_name", query)
        logger.info(f"📍 Geocoded: {display_name} → lat={lat}, lon={lon}")

    except Exception as e:
        logger.error(f"❌ Geocoding failed: {e}")
        return f"地理編碼失敗：{e}"

    # 步驟 2：依座標選擇資料來源
    try:
        if _is_taiwan(lat, lon):
            logger.info("🇹🇼 使用中央氣象署 O-A0001-001")
            result = await _get_weather_cwa(lat, lon, city)
        else:
            logger.info("🌍 使用 Open-Meteo（非台灣地區）")
            result = await _get_weather_openmeteo(lat, lon, city, display_name)

        logger.info(f"✅ Weather result:\n{result}")
        logger.info("=" * 60)
        return result

    except Exception as e:
        logger.error(f"❌ Weather API failed: {e}")
        return f"無法取得天氣資料：{e}"


# 掛載 MCP server 到 /mcp 路徑
app.mount("/mcp", app=mcp_server.streamable_http_app())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
