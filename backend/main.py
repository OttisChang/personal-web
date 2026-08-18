import logging
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # 必須在其他本地模組 import 之前執行，因為 api/web_search.py 等模組
                # 會在 import 當下（模組載入時）就讀取 GROQ_API_KEY 等環境變數

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mcp_instance import mcp_server
import mcp_tools  # noqa: F401 — registers all MCP tools on import
from api import router

logger = logging.getLogger(__name__)

app = FastAPI(title="Personal Website API")

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

app.include_router(router)
app.mount("/mcp", app=mcp_server.streamable_http_app())
# 目前只用來提供 profile_en.json / profile_zh.json；文件類資源（PDF 等）改存 Azure Blob Storage
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "data"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
