import json
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from duckduckgo_search import DDGS

load_dotenv()

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


@app.post("/api/web-search", response_model=WebSearchResponse)
def web_search_endpoint(body: WebSearchRequest):
    if _groq is None:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY 未設定。請在 backend/.env 設定。"
        )

    model = "llama-3.3-70b-versatile"

    # 步驟 1：讓模型決定搜尋關鍵字
    query_resp = _groq.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "你是搜尋助手。根據使用者問題，產生一個最適合的網路搜尋關鍵字。只回覆搜尋關鍵字本身，不要加任何說明。"
            },
            {"role": "user", "content": body.query}
        ]
    )
    search_query = query_resp.choices[0].message.content.strip().strip('"')

    # 步驟 2：執行 DuckDuckGo 搜尋
    results = _execute_web_search(search_query)
    sources = [SearchSource(**r) for r in results]

    # 步驟 3：根據搜尋結果生成答案
    context = "\n\n".join(
        f"[{i+1}] {r['title']}\n{r['snippet']}\n來源: {r['url']}"
        for i, r in enumerate(results)
    ) if results else "（無搜尋結果）"

    answer_resp = _groq.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "你是一個 AI 助手。請根據以下搜尋結果，用繁體中文詳細回答使用者的問題。"
            },
            {
                "role": "user",
                "content": f"問題：{body.query}\n\n搜尋結果：\n{context}"
            }
        ]
    )

    answer = answer_resp.choices[0].message.content or "無法取得答案，請稍後再試。"
    return WebSearchResponse(answer=answer, sources=sources, search_query=search_query)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
