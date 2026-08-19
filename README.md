# 🧑‍💻 AI Search Platform & Personal Website

這是一個使用現代化技術建構的個人網站，核心功能是一套採 **Multi-Agent 架構**、支援 **MCP Tool** 整合的 **AI Search 智慧助理**，同時保留個人履歷展示，主要用於展示前後端架構整合與 AI 應用開發能力。

## ✨ 核心功能 (Key Features)

*   **🤖 Multi-Agent AI Search:** Root Agent 透過 OpenAI 開源的 `gpt-oss-120b` 模型進行意圖路由，將問題分派給對應的 Sub Agent 處理，每個 Sub Agent 各自掛載不同的工具、或使用不同的 System Prompt，並以 SSE 串流即時回傳分派過程與最終答案。
*   **📚 知識庫 RAG 檢索:** `knowledge_base_agent` 以 Voyage AI `voyage-context-4` 對內部文件（《Pro Git》、《Google Cloud: 生成式 AI 瞭解基礎概念》）做語意向量搜尋（MongoDB Atlas Vector Search），回答附上頁碼範圍與可跳頁的文本連結（Azure Blob Storage）。
*   **🔐 Google OAuth 登入與對話紀錄:** 透過 NextAuth 整合 Google 登入，對話內容持久化儲存於 MongoDB，支援對話列表查詢與刪除。
*   **🌐 國際化 (i18n):** 實作多國語系，支援中/英文內容無縫切換。
*   **🌓 深淺主題 (Dark/Light Mode):** 實作流暢的深淺色模式切換，提供最佳的使用者閱讀體驗。
*   **📄 動態資料管理:** 履歷資料來源統一以 JSON 格式儲存，並透過後端 API 靈活提供與維護。

## 🧠 Multi-Agent 架構設計 (Multi-Agent Architecture)

AI Search 採用 **Root Agent + Sub Agent** 的兩層架構（[backend/agents.py](backend/agents.py)），Root Agent 本身不回答問題，只負責「路由分類」，實際的工具呼叫或人設對話則交給各個 Sub Agent 處理。

```
                        ┌────────────────────┐
使用者問題  ─────────▶  │      Root Agent      │
                        │ （LLM JSON 路由分類） │
                        └──────────┬──────────┘
                                   │ 依 judging_hints 判斷意圖
         ┌─────────────────┬───────┴────────┬─────────────────┐
         ▼                 ▼                ▼                  ▼
┌───────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐
│  tool_agent    │ │  tool_agent    │ │  tool_agent    │ │    sub_agent      │
│ weather_agent  │ │financial_agent │ │knowledge_base_ │ │ travel_brainstormer│
│                │ │                │ │agent           │ │ attractions_planner│
│ 掛載 MCP Tool： │ │ 掛載 MCP Tool： │ │ 掛載 MCP Tool： │ │ 無外部工具，       │
│ get_weather     │ │ esun_exchange_ │ │ search_         │ │ 改用專屬 System   │
│ get_weather_    │ │ rate           │ │ documents       │ │ Prompt 對話，依   │
│ forecast        │ │                │ │（向量檢索 RAG） │ │ JSON 欄位維護對話狀態│
└───────┬────────┘ └───────┬────────┘ └───────┬────────┘ └─────────┬─────────┘
        │                  │                   │                    │
        └──────────────────┼───────────────────┼────────────────────┘
                            ▼
                    ┌──────────────────────────┐
                    │  tool_agent: web_search    │
                    │  掛載 DuckDuckGo 搜尋工具   │
                    │  （所有問題的預設 fallback）│
                    └──────────────────────────┘
```

### Root Agent（路由層）

*   單次 `gpt-oss-120b`（透過 Groq API 呼叫）JSON-mode 請求，依每個 Sub Agent 的 `description`／`judging_hints` 判斷應分派給哪個 Agent（[build_routing_system()](backend/agents.py)）。
*   會話具備「黏著延續（sticky）」機制：若上一輪停留在某個 `sub_agent`（例如仍在規劃景點），且對話仍未偏題，則本輪會跳過路由分類，直接沿用同一個 Sub Agent，並將目前是否要繼續停留（`stay`）與已收藏景點清單等狀態存回 MongoDB（`_load_session_state` / `_save_session_state`，[api/web_search.py](backend/api/web_search.py)）。

### Sub Agent 分為兩種型態，各自掛載不同工具

| Agent | 型態 (kind) | 掛載的 Tool / 能力 | 說明 |
|---|---|---|---|
| `weather_agent` | `tool_agent` | MCP Tool：`get_weather`、`get_weather_forecast` | 查詢即時天氣（中央氣象署 / Open-Meteo）或台灣縣市未來 36 小時預報 |
| `financial_agent` | `tool_agent` | MCP Tool：`esun_exchange_rate` | 查詢玉山銀行即時外幣牌告匯率 |
| `knowledge_base_agent` | `tool_agent` | MCP Tool：`search_documents` | 對內部知識庫文件（《Pro Git》、《Google Cloud: 生成式 AI 瞭解基礎概念》）做向量語意搜尋，回答附頁碼範圍與文本連結 |
| `web_search` | `tool_agent` | DuckDuckGo 網路搜尋 | 一般問題的預設 fallback，無法歸類到其他 Agent 時使用 |
| `travel_brainstormer` | `sub_agent` | 無外部工具，改用專屬 System Prompt | 協助還沒決定旅遊目的地的使用者，依動機推薦國家／城市 |
| `attractions_planner` | `sub_agent` | 無外部工具，改用專屬 System Prompt | 使用者已選定目的地後，推薦具體景點並累積「想去景點清單」 |

*   **`tool_agent`**：實際呼叫掛載的 MCP Tool（[backend/mcp_tools/](backend/mcp_tools/)，透過 [mcp_instance.py](backend/mcp_instance.py) 的 `FastMCP` server 註冊），取得結構化資料後，再交由該 Agent 專屬的 `instruction`（System Prompt）將資料轉成自然語言回答；不具備跨輪黏著能力，每次都會重新路由。
*   **`sub_agent`**：不呼叫外部工具，而是改用該 Agent 專屬的 System Prompt 直接與 `gpt-oss-120b` 對話，並要求模型以 JSON 回傳 `reply`（回覆內容）、`stay`（是否維持在本 Agent）、`attractions_add`（新增景點，僅 `attractions_planner` 使用）等欄位，藉此驅動多輪對話的狀態轉移。

## 🛠️ 技術棧 (Tech Stack)

**Frontend:**
*   React / Next.js / TypeScript
*   NextAuth（Google OAuth）
*   next-intl（i18n）
*   react-markdown + remark-gfm（Markdown／表格渲染）

**Backend:**
*   Python / FastAPI
*   Multi-Agent 路由架構（Root Agent + Sub Agent，[backend/agents.py](backend/agents.py)）
*   MCP（Model Context Protocol）Tools（天氣、匯率）
*   知識庫 RAG 檢索
*   OpenAI 開源 `gpt-oss-120b` 模型（使用 Function Calling / JSON Mode）
*   MongoDB（Motor 非同步驅動，儲存對話紀錄與 Agent 狀態；Atlas Vector Search 儲存文件 embedding）
*   Voyage AI `voyage-context-4`（Contextualized Embedding，用於知識庫語意搜尋）
*   Azure Blob Storage（知識庫來源 PDF 儲存，供引用連結跳頁）

---

## ⚠️ 版權聲明 (Copyright & License)

**Copyright © 2026 Ottis Chang. All Rights Reserved.**

本專案之原始碼公開僅供**技術展示、面試交流與學習參考**之用。
請尊重開發者的原創心血，**未經授權，請勿直接 Fork、Clone 或複製本專案的程式碼、設計排版與架構，作為您個人的履歷網站模板或任何商業用途。**
