import re
from dataclasses import dataclass
from typing import Literal

AgentKind = Literal["tool_agent", "sub_agent"]

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.IGNORECASE | re.DOTALL)
_THINK_OPEN_RE = re.compile(r"<think>", re.IGNORECASE)


def strip_thinking(text: str) -> str:
    """移除思考型模型（如 Qwen3）輸出中的 <think>...</think> 推理區塊，只留下正式回答。
    若因 max_tokens 提前截斷導致 <think> 沒有對應的結尾標籤，視為推理尚未結束、正式回答
    還沒生成，直接捨棄 <think> 之後的內容（通常需要搭配拉高 max_tokens 才會避免發生）。"""
    text = _THINK_BLOCK_RE.sub("", text or "")
    text = _THINK_OPEN_RE.split(text, maxsplit=1)[0]
    return text.strip()

_ZH_TW = (
    "【最優先語言規則，務必嚴格遵守】請判斷使用者這則提問使用的語言："
    "若使用者以英文提問，請全程使用英文回答，即使參考資料是中文也一樣；"
    "其餘情況請務必使用繁體中文（Traditional Chinese）回答，不要使用簡體中文。"
)
_TABLE_HINT = (
    "若使用者的問題提到「比較」、要求「表格」，或請你規劃「幾天」的行程／安排每日行程，"
    "請改用 Markdown 表格呈現回答內容（例如以「天數」「景點/行程」「備註」等欄位整理）。"
)


@dataclass(frozen=True)
class Agent:
    name: str
    label: str
    description: str
    kind: AgentKind
    tools: tuple[str, ...] = ()
    instruction: str = ""
    judging_hints: tuple[str, ...] = ()
    routing_examples: tuple[str, ...] = ()


weather_agent = Agent(
    name="weather_agent",
    label="天氣 Agent",
    description="查詢城市「即時」天氣，或台灣縣市「未來」天氣預報",
    kind="tool_agent",
    tools=("get_weather", "get_weather_forecast"),
    instruction=f"{_ZH_TW} 你是天氣助手，請根據以下天氣資料友善地回答使用者。{_TABLE_HINT}",
    judging_hints=(
        "問「現在/目前/今天即時」天氣 → weather_agent, tool=get_weather",
        "問「明天/後天/週末/未來」天氣或「會不會下雨（非即時）」 → weather_agent, tool=get_weather_forecast",
    ),
    routing_examples=(
        '{"agent": "weather_agent", "tool": "get_weather", "city": "城市名稱", "country": "國家（可選，非台灣才填）"}',
        '{"agent": "weather_agent", "tool": "get_weather_forecast", "city": "台灣縣市名稱"}',
    ),
)

financial_agent = Agent(
    name="financial_agent",
    label="財經 Agent",
    description="查詢玉山銀行即時外幣牌告匯率（美金、日圓、歐元、港幣、人民幣等）",
    kind="tool_agent",
    tools=("esun_exchange_rate",),
    instruction=f"{_ZH_TW} 你是匯率助手，請根據以下玉山銀行牌告匯率資料回答使用者的問題，只需回答與問題相關的幣別即可。{_TABLE_HINT}",
    judging_hints=("問匯率/外幣 → financial_agent",),
    routing_examples=('{"agent": "financial_agent"}',),
)

git_book_agent = Agent(
    name="git_book_agent",
    label="Git 知識庫 Agent",
    description="查詢《Pro Git》書籍內容，回答 Git 指令、概念、原理相關問題",
    kind="tool_agent",
    tools=("search_progit_book",),
    instruction=(
        f"{_ZH_TW} 你是 Git 助手，請根據以下《Pro Git》書籍摘錄內容回答使用者的問題，"
        "回答內文不需要逐句標註頁碼。回答的最後請另起一段，統一標明本次引用的頁碼範圍與文本連結，"
        "格式須為：\n"
        "參考資料來源：《Pro Git》，頁碼範圍 p.xx-xx\n"
        "文本連結：<連結>\n"
        "xx-xx 請填入本次引用摘錄中最小到最大的頁碼（例如摘錄涵蓋 p.40 與 p.45，則寫「頁碼範圍 "
        "p.40-45」）；<連結> 請一字不漏照抄資料中「文本連結：」後面提供的網址，不可自行編造或修改。"
        "若摘錄內容不足以回答，誠實告知使用者，不要編造書中沒有的內容，此時不需加上這兩行。"
    ),
    judging_hints=(
        "使用者問 git 指令、概念、用法（branch、merge、rebase、commit、submodule、reflog 等） → git_book_agent",
    ),
    routing_examples=('{"agent": "git_book_agent"}',),
)

web_search_agent = Agent(
    name="web_search",
    label="網路搜尋 Agent",
    description="網路搜尋，適用於其他一般問題",
    kind="tool_agent",
    tools=("web_search",),
    instruction=f"{_ZH_TW} 你是一個 AI 助手，請根據以下搜尋結果詳細回答使用者的問題。{_TABLE_HINT}",
    judging_hints=("以上皆不符合的一般問題 → web_search（預設）",),
    routing_examples=('{"agent": "web_search", "search_query": "最佳搜尋關鍵字"}',),
)

TRAVEL_BRAINSTORMER_INSTRUCTION = f"""{_ZH_TW}（此規則適用於 reply 欄位的文字內容）

你是「旅遊目的地發想助手」，專門協助還沒決定要去哪裡旅遊的使用者。透過了解他們的旅遊動機
（例如：想冒險刺激、想放鬆休閒、想增廣見聞學習、想血拼購物、想欣賞藝術文化等），推薦 2-3 個
合適的國家或城市，並簡短說明推薦理由。

行為原則：
- 若使用者尚未說明旅遊偏好或動機，先友善提出 1-2 個釐清問題（例如想要什麼樣的旅遊體驗、預算、
  天數），不要一次列出太多問題。
- 若使用者已表明偏好，直接推薦具體的目的地並簡述理由，避免空泛建議。
- 若使用者在對話中已經明確選定了目的地，或想開始規劃該地的具體景點/行程，代表這輪對話的意圖
  已經轉移到景點規劃，請將 stay 設為 false。
- 若使用者的問題明顯與旅遊目的地選擇無關（例如查天氣、查匯率、閒聊其他主題），請將 stay 設為 false。
- 除上述情況外，只要對話仍圍繞在「還沒決定要去哪裡玩」，請將 stay 設為 true，持續以本角色回覆。
- {_TABLE_HINT}（表格內容寫在 reply 欄位的文字裡）。

請務必只回覆 JSON，不要加任何說明或 markdown。請先判斷「使用者最新一句話」使用的語言，填入 lang
欄位，再用該語言撰寫 reply（若使用者用英文提問，lang 為 "en" 且 reply 全程用英文；其餘情況 lang
為 "zh-TW" 且 reply 全程用繁體中文，不可使用簡體中文），reply 內的語言必須與 lang 完全一致，
格式為：
{{"lang": "en 或 zh-TW", "reply": "你給使用者的完整回覆文字（語言需與 lang 完全一致）", "stay": true 或 false}}"""

ATTRACTIONS_PLANNER_INSTRUCTION = f"""{_ZH_TW}（此規則適用於 reply 欄位的文字內容）

你是「景點規劃助手」，使用者已經知道要去哪個目的地旅遊，你的任務是根據目的地與使用者的興趣，
推薦具體景點與行程安排建議，並協助累積一份「想去的景點清單」。

行為原則：
- 根據使用者提到的目的地與興趣，推薦具體景點（附上簡短介紹或推薦理由），避免空泛建議。
- 若使用者提到想去、有興趣、或同意加入清單的景點，請把「景點名稱」（僅名稱，不含描述文字）放進
  attractions_add 陣列；若本輪沒有新增任何景點，attractions_add 請給空陣列 []。
- 使用者訊息前面若附有「目前已收藏的景點清單」，請參考該清單避免重複推薦，並可視需要幫忙統整
  或給行程安排建議。
- 若使用者想要重新考慮或更換旅遊目的地（還沒決定要去哪），代表要交還給目的地發想階段，請將
  stay 設為 false。
- 若使用者的問題明顯與這趟旅遊的景點規劃無關（例如查天氣、查匯率、閒聊其他主題），請將 stay
  設為 false。
- 除上述情況外，只要對話仍圍繞在「這個目的地要去哪些景點/怎麼安排行程」，請將 stay 設為 true，
  持續以本角色回覆。
- {_TABLE_HINT}（表格內容寫在 reply 欄位的文字裡）。

請務必只回覆 JSON，不要加任何說明或 markdown。請先判斷「使用者最新一句話」使用的語言，填入 lang
欄位，再用該語言撰寫 reply（若使用者用英文提問，lang 為 "en" 且 reply 全程用英文；其餘情況 lang
為 "zh-TW" 且 reply 全程用繁體中文，不可使用簡體中文），reply 內的語言必須與 lang 完全一致，
格式為：
{{"lang": "en 或 zh-TW", "reply": "你給使用者的完整回覆文字（語言需與 lang 完全一致）", "stay": true 或 false, "attractions_add": ["景點名稱1", "景點名稱2"]}}"""

travel_brainstormer = Agent(
    name="travel_brainstormer",
    label="旅遊地點發想 Agent",
    description="協助還沒決定要去哪裡旅遊的使用者，根據他們想要的體驗推薦適合的旅遊目的地或國家",
    kind="sub_agent",
    instruction=TRAVEL_BRAINSTORMER_INSTRUCTION,
    judging_hints=("使用者還沒決定要去哪裡玩、想討論或比較旅遊目的地 → travel_brainstormer",),
    routing_examples=('{"agent": "travel_brainstormer"}',),
)

attractions_planner = Agent(
    name="attractions_planner",
    label="景點規劃 Agent",
    description="使用者已經決定旅遊目的地，協助推薦與累積該地想去的具體景點、安排行程",
    kind="sub_agent",
    instruction=ATTRACTIONS_PLANNER_INSTRUCTION,
    judging_hints=("使用者已經知道要去哪個國家/城市，想規劃景點或行程 → attractions_planner",),
    routing_examples=('{"agent": "attractions_planner", "destination": "目的地（若使用者已提到，否則留空字串）"}',),
)


@dataclass(frozen=True)
class RootAgent:
    name: str
    sub_agents: tuple[Agent, ...]


root_agent = RootAgent(
    name="root",
    sub_agents=(weather_agent, financial_agent, git_book_agent, travel_brainstormer, attractions_planner, web_search_agent),
)

AGENTS_BY_NAME: dict[str, Agent] = {a.name: a for a in root_agent.sub_agents}
SUB_AGENT_NAMES: frozenset[str] = frozenset(a.name for a in root_agent.sub_agents if a.kind == "sub_agent")


def build_routing_system() -> str:
    tool_lines = "\n".join(f"- {a.name}：{a.description}" for a in root_agent.sub_agents)
    hint_lines = "\n".join(f"- {h}" for a in root_agent.sub_agents for h in a.judging_hints)
    schema_lines = "\n".join(line for a in root_agent.sub_agents for line in a.routing_examples)
    return (
        "你是一個智慧助手的 Agent 路由器。根據使用者的問題，決定應該分派給哪個 agent 來回答，並以 JSON 格式回覆。\n\n"
        f"可用 Agent：\n{tool_lines}\n\n"
        f"判斷原則：\n{hint_lines}\n\n"
        f"回覆格式（只回覆 JSON，不要加任何說明或 markdown，agent 為 weather_agent 時才需要 tool 欄位）：\n{schema_lines}"
    )
