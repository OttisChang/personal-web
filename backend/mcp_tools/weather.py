import logging
import math
import os

from mcp_instance import mcp_server

logger = logging.getLogger(__name__)


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

    nearest = None
    min_dist = float("inf")
    for s in stations:
        coords = s.get("GeoInfo", {}).get("Coordinates", [])
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

    return (
        f"📍 地點：{city}（最近測站：{name}，距離 {min_dist:.1f} km）\n"
        f"🕐 觀測時間：{obs_time}\n"
        f"🌤️  天氣：{we.get('Weather', '-')}\n"
        f"🌡️  氣溫：{we.get('AirTemperature', '-')}°C\n"
        f"💧 濕度：{we.get('RelativeHumidity', '-')}%\n"
        f"💨 風速：{we.get('WindSpeed', '-')} m/s　風向：{we.get('WindDirection', '-')}°\n"
        f"🌧️  降水：{we.get('Now', {}).get('Precipitation', '-')} mm\n"
        f"🔵 氣壓：{we.get('AirPressure', '-')} hPa\n"
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
