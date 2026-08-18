import logging
import os

from database import get_db
from mcp_instance import mcp_server

logger = logging.getLogger(__name__)

_INDEX_NAME = "document_vector_index"
_EMBED_MODEL = "voyage-context-4"
_TOP_K = 5
_MIN_SCORE = 0.65  # 過低分數代表跟查詢不相關，通常是候選文件不夠多時的補位結果，過濾掉避免混淆答案


def _doc_link(blob_url: str, page: int) -> str:
    return f"{blob_url}#page={page}"


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
    name="search_documents",
    description=(
        "在內部知識庫（多份文件）全文中做語意搜尋，回傳最相關的段落，附頁碼與來源引用。\n\n"
        "知識庫目前收錄的文件（每次新增文件到 document_chunks 後，請更新這份清單）：\n"
        "- 《Pro Git》：Git 指令、概念、原理、最佳實踐\n"
        "- 《生成式AI基礎概念》：生成式 AI 基礎概念\n\n"
        "**參數：** query — 使用者問題的關鍵字或完整問題"
    ),
)
async def search_documents(query: str) -> str:
    logger.info("=" * 60)
    logger.info(f"📚 MCP TOOL: search_documents() called — query={query}")

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
                "blob_url": 1,
                "title": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    try:
        results = await db.document_chunks.aggregate(pipeline).to_list(length=_TOP_K)
    except Exception as e:
        logger.error(f"❌ Vector search failed: {e}")
        return f"知識庫搜尋失敗：{e}"

    results = [r for r in results if r["score"] >= _MIN_SCORE]

    if not results:
        return "在知識庫中找不到相關內容。"

    lines = [f"📚 從知識庫搜尋到 {len(results)} 段相關內容：\n"]
    for r in results:
        start, end = r["start_page"], r["end_page"]
        pages = f"p.{start}" if start == end else f"p.{start}-{end}"
        lines.append(f"【{r['title']}　{pages}】\n{r['text']}\n")

    # 依文件分組，每份被引用到的文件各自附上頁碼範圍與文本連結
    by_title: dict[str, dict] = {}
    for r in results:
        entry = by_title.setdefault(r["title"], {"blob_url": r["blob_url"], "pages": []})
        entry["pages"].append(r["start_page"])
        entry["pages"].append(r["end_page"])

    lines.append("")
    for title, info in by_title.items():
        lo, hi = min(info["pages"]), max(info["pages"])
        lines.append(f"（《{title}》，頁碼範圍 p.{lo}-{hi}，文本連結：{_doc_link(info['blob_url'], lo)}）")

    result = "\n".join(lines)
    logger.info(f"✅ Found {len(results)} chunks across {len(by_title)} document(s)")
    logger.info("=" * 60)
    return result
