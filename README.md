# 🧑‍💻 AI Search Platform & Personal Website

這是一個使用現代化技術建構的個人網站，核心功能是一套支援 **MCP Tool** 整合的 **AI Search 智慧助理**，同時保留個人履歷展示，主要用於展示前後端架構整合與 AI 應用開發能力。

## ✨ 核心功能 (Key Features)

*   **🔍 AI Search（支援 MCP Tool）:** 透過 Groq LLM 的 Function Calling 判斷使用者意圖，自動呼叫對應的 MCP Tool（即時天氣、天氣預報、銀行匯率查詢）或進行網路搜尋，並以 SSE 串流回傳結果。
*   **🔐 Google OAuth 登入與對話紀錄:** 透過 NextAuth 整合 Google 登入，對話內容持久化儲存於 MongoDB，支援對話列表查詢與刪除。
*   **🌐 國際化 (i18n):** 實作多國語系，支援中/英文內容無縫切換。
*   **🌓 深淺主題 (Dark/Light Mode):** 實作流暢的深淺色模式切換，提供最佳的使用者閱讀體驗。
*   **📄 動態資料管理:** 履歷資料來源統一以 JSON 格式儲存，並透過後端 API 靈活提供與維護。

## 🛠️ 技術棧 (Tech Stack)

**Frontend:**
*   React / Next.js / TypeScript
*   NextAuth（Google OAuth）
*   next-intl（i18n）

**Backend:**
*   Python / FastAPI
*   MCP（Model Context Protocol）Tools
*   Groq（LLM Function Calling）
*   MongoDB（Motor 非同步驅動）

---

## ⚠️ 版權聲明 (Copyright & License)

**Copyright © 2026 Ottis Chang. All Rights Reserved.**

本專案之原始碼公開僅供**技術展示、面試交流與學習參考**之用。
請尊重開發者的原創心血，**未經授權，請勿直接 Fork、Clone 或複製本專案的程式碼、設計排版與架構，作為您個人的履歷網站模板或任何商業用途。**