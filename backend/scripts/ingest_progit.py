"""
一次性腳本：讀取 backend/data/progit.pdf，用 voyage-context-4 自動切 chunk 並產生
contextualized embedding，寫入 MongoDB Atlas 的 progit_chunks collection。

用法：
    cd backend
    python scripts/ingest_progit.py
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import voyageai
from pymongo import MongoClient
from pypdf import PdfReader

PDF_PATH = Path(__file__).parent.parent / "data" / "progit.pdf"
PAGES_PER_GROUP = 12       # 每組頁面一起送進 embedding，讓 chunk 之間能參考彼此上下文
CHUNK_SIZE_TOKENS = 300    # 每個 chunk 的目標 token 數，交給 Voyage 自動切
COLLECTION_NAME = "progit_chunks"
EMBED_MODEL = "voyage-context-4"

# PDF 前 6 頁是封面/書名頁/目錄，沒有印刷頁碼；從第 7 頁起才對應印刷頁碼 1。
# 這個 offset 是針對目前這份 progit.pdf 量出來的，換版本或換書要重新確認。
PAGE_OFFSET = 6


def extract_pages(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    return [(page.extract_text() or "").strip() for page in reader.pages]


def group_pages(pages: list[str], group_size: int) -> list[tuple[int, int, str]]:
    """回傳 (start_page, end_page, combined_text)，頁碼從 1 開始。"""
    groups = []
    for i in range(0, len(pages), group_size):
        chunk_pages = pages[i : i + group_size]
        combined = "\n\n".join(p for p in chunk_pages if p)
        if combined.strip():
            groups.append((i + 1, i + len(chunk_pages), combined))
    return groups


def embed_groups(vo: voyageai.Client, groups: list[tuple[int, int, str]]) -> list[dict]:
    records = []
    for start_page, end_page, text in groups:
        result = vo.contextualized_embed(
            inputs=[text],
            model=EMBED_MODEL,
            input_type="document",
            enable_auto_chunking=True,
            chunk_size=CHUNK_SIZE_TOKENS,
        )
        doc_result = result.results[0]
        for chunk_text, embedding in zip(doc_result.chunk_texts, doc_result.embeddings):
            records.append(
                {
                    "text": chunk_text,
                    "embedding": embedding,
                    "start_page": max(start_page - PAGE_OFFSET, 1),
                    "end_page": max(end_page - PAGE_OFFSET, 1),
                    "source": "progit.pdf",
                }
            )
        print(f"page {start_page}-{end_page}: {len(doc_result.chunk_texts)} chunks")
    return records


def main():
    if not PDF_PATH.exists():
        sys.exit(f"找不到 PDF：{PDF_PATH}")

    voyage_key = os.environ.get("VOYAGE_API_KEY")
    if not voyage_key:
        sys.exit("VOYAGE_API_KEY 未設定，請加到 backend/.env")

    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        sys.exit("MONGODB_URI 未設定")

    print("讀取 PDF...")
    pages = extract_pages(PDF_PATH)
    print(f"共 {len(pages)} 頁")

    groups = group_pages(pages, PAGES_PER_GROUP)
    print(f"分成 {len(groups)} 組，開始 embedding...")

    vo = voyageai.Client(api_key=voyage_key)
    records = embed_groups(vo, groups)
    print(f"共產生 {len(records)} 個 chunks")

    client = MongoClient(mongo_uri)
    db = client.get_default_database()
    collection = db[COLLECTION_NAME]

    collection.delete_many({"source": "progit.pdf"})
    collection.insert_many(records)
    print(f"已寫入 {len(records)} 筆到 {COLLECTION_NAME} collection")

    client.close()


if __name__ == "__main__":
    main()
