import logging
import re
from datetime import datetime, timezone, timedelta

from mcp_instance import mcp_server

logger = logging.getLogger(__name__)

_CCY_ZH = {
    "USD": "美金",
    "JPY": "日圓",
    "EUR": "歐元",
    "GBP": "英鎊",
    "AUD": "澳幣",
    "CAD": "加幣",
    "HKD": "港幣",
    "SGD": "新幣",
    "CHF": "瑞士法郎",
    "CNY": "人民幣",
    "NZD": "紐幣",
    "THB": "泰銖",
    "ZAR": "南非幣",
    "SEK": "瑞典幣",
    "MYR": "馬幣",
    "PHP": "菲律賓比索",
}

_TZ_TAIPEI = timezone(timedelta(hours=8))


def _parse_dotnet_date(val: str) -> str:
    m = re.search(r"\d+", val or "")
    if not m:
        return val or ""
    ts = int(m.group()) / 1000
    dt = datetime.fromtimestamp(ts, tz=_TZ_TAIPEI)
    return dt.strftime("%Y-%m-%d %H:%M")


def _to_float(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except Exception:
        return None


@mcp_server.tool(
    name="esun_exchange_rate",
    description=(
        "即時查詢玉山銀行外幣匯率（牌告匯率）。\n\n"
        "**何時使用：**\n"
        "- 使用者詢問匯率、外幣兌換（例：「美金多少？」「日圓匯率」「歐元對台幣」）\n"
        "- 使用者想比較即期匯率與現金匯率\n\n"
        "**回傳內容：**\n"
        "- 16 種主要貨幣對台幣的即期買入/賣出、現金買入/賣出匯率\n"
        "- 每筆資料附更新時間\n\n"
        "**資料來源：** 玉山銀行官方牌告（即時）。無需輸入任何參數。"
    ),
)
async def esun_exchange_rate() -> dict:
    import httpx

    logger.info("=" * 60)
    logger.info("💱 MCP TOOL: esun_exchange_rate() called")

    url = "https://www.esunbank.com/api/client/ExchangeRate/LastRateInfo?sc_lang=zh-TW"
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://www.esunbank.com/zh-tw/personal/deposit/rate/forex/foreign-exchange-rates",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json={})
            resp.raise_for_status()
            data = resp.json()

        rates = []
        for item in data.get("Rates", []):
            ccy = item.get("CCY", "")
            code = ccy.split("/")[0] if "/" in ccy else ccy
            zh_name = _CCY_ZH.get(code, code)
            update_time = _parse_dotnet_date(item.get("UpdateTime", ""))

            rate_obj = {
                "currency": ccy,
                "name": zh_name,
                "spot_buy": _to_float(item.get("BBoardRate")),
                "spot_sell": _to_float(item.get("SBoardRate")),
                "update_time": update_time,
            }

            cash_buy = _to_float(item.get("CashBBoardRate"))
            cash_sell = _to_float(item.get("CashSBoardRate"))
            if cash_buy is not None and cash_sell is not None:
                rate_obj["cash_buy"] = cash_buy
                rate_obj["cash_sell"] = cash_sell

            rates.append(rate_obj)

        result = {
            "data_source": "玉山銀行 即時牌告匯率",
            "total": len(rates),
            "rates": rates,
        }

        logger.info(f"✅ Fetched {len(rates)} currencies")
        logger.info("=" * 60)
        return result

    except Exception as e:
        error_msg = f"匯率查詢失敗：{e}"
        logger.error(f"❌ {error_msg}")
        return {"error": error_msg}
