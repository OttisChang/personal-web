import logging
import os

from database import get_db
from mcp_instance import mcp_server

logger = logging.getLogger(__name__)

_INDEX_NAME = "progit_vector_index"
_EMBED_MODEL = "voyage-context-4"
_TOP_K = 5


def _pdf_link(page: int) -> str:
    base = (os.environ.get("BACKEND_PUBLIC_URL") or "http://localhost:8001").rstrip("/")
    return f"{base}/static/progit.pdf#page={page}"


async def _embed_query(query: str) -> list[float]:
    import voyageai

    vo = voyageai.AsyncClient(api_key=os.environ.get("VOYAGE_API_KEY"))
    result = await vo.contextualized_embed(
        model=_EMBED_MODEL,
        inputs=[query],
        input_type="query",
    )
    return result.results[0].embeddings[0]


@mcp_server.tool(
    name="search_progit_book",
    description=(
        "在《Pro Git》書籍全文中做語意搜尋，回傳最相關的段落，附頁碼引用。\n\n"
        "**何時使用：**\n"
        "- 使用者詢問 Git 指令、概念、用法（例如 branch、merge、rebase、cherry-pick、"
        "submodule、reflog 等）\n"
        "- 使用者想了解 Git 內部運作原理或最佳實踐\n\n"
        "**參數：** query — 使用者問題的關鍵字或完整問題（書籍原文是英文，建議用英文查詢）"
    ),
)
async def search_progit_book(query: str) -> str:
    logger.info("=" * 60)
    logger.info(f"📖 MCP TOOL: search_progit_book() called — query={query}")

    try:
        query_vector = await _embed_query(query)
    except Exception as e:
        logger.error(f"❌ Embedding failed: {e}")
        return f"查詢向量化失敗：{e}"

    db = get_db()
    pipeline = [
        {
            "$vectorSearch": {
                "index": _INDEX_NAME,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": 100,
                "limit": _TOP_K,
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "start_page": 1,
                "end_page": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    try:
        results = await db.progit_chunks.aggregate(pipeline).to_list(length=_TOP_K)
    except Exception as e:
        logger.error(f"❌ Vector search failed: {e}")
        return f"書籍搜尋失敗：{e}"

    if not results:
        return "在《Pro Git》書中找不到相關內容。"

    lines = [f"📖 從《Pro Git》搜尋到 {len(results)} 段相關內容：\n"]
    for r in results:
        start, end = r["start_page"], r["end_page"]
        pages = f"p.{start}" if start == end else f"p.{start}-{end}"
        lines.append(f"【{pages}】\n{r['text']}\n")

    min_page = min(r["start_page"] for r in results)
    lines.append(f"（文本連結：{_pdf_link(min_page)}）")

    result = "\n".join(lines)
    logger.info(f"✅ Found {len(results)} chunks")
    logger.info("=" * 60)
    return result
