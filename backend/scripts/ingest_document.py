r"""
通用文件 ingest 腳本：讀取本機檔案、上傳到 Azure Blob Storage、用 voyage-context-4
產生 contextualized embedding，寫入 MongoDB Atlas 的 document_chunks collection，
並自動建立/更新 Atlas Vector Search 索引。

目前只支援 PDF（用 pypdf 逐頁抽文字）。要支援其他檔案類型時，在 `extract_pages`
旁邊新增對應的抽取函式，並在 main() 依 --source-type 分派即可。

用法範例（cmd.exe，重新 ingest Pro Git）：
    cd backend
    python scripts/ingest_document.py --file data\progit.pdf --source-id progit --title "Pro Git" --source-type pdf --page-offset 6

新增文件範例（檔案在桌面，路徑含中文/空白建議用雙引號括起來）：
    python scripts/ingest_document.py --file "C:\Users\mybook.pdf" --source-id mybook --title "My Book"
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import voyageai
from azure.storage.blob import BlobServiceClient, ContentSettings
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel
from pypdf import PdfReader

COLLECTION_NAME = "document_chunks"
INDEX_NAME = "document_vector_index"
EMBED_MODEL = "voyage-context-4"
CONTENT_TYPES = {".pdf": "application/pdf"}


def extract_pages(file_path: Path, source_type: str) -> list[str]:
    if source_type != "pdf":
        raise NotImplementedError(f"尚未支援 source_type={source_type!r} 的文字抽取")
    reader = PdfReader(str(file_path))
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


def embed_groups(
    vo: voyageai.Client,
    groups: list[tuple[int, int, str]],
    chunk_size: int,
    page_offset: int,
    common_fields: dict,
) -> list[dict]:
    records = []
    for start_page, end_page, text in groups:
        result = vo.contextualized_embed(
            inputs=[text],
            model=EMBED_MODEL,
            input_type="document",
            enable_auto_chunking=True,
            chunk_size=chunk_size,
        )
        doc_result = result.results[0]
        for chunk_text, embedding in zip(doc_result.chunk_texts, doc_result.embeddings):
            records.append(
                {
                    "text": chunk_text,
                    "embedding": embedding,
                    "start_page": max(start_page - page_offset, 1),
                    "end_page": max(end_page - page_offset, 1),
                    **common_fields,
                }
            )
        print(f"page {start_page}-{end_page}: {len(doc_result.chunk_texts)} chunks")
    return records


def upload_to_blob(file_path: Path, container: str, blob_name: str) -> str:
    conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        sys.exit("AZURE_STORAGE_CONNECTION_STRING 未設定，請加到 backend/.env")

    service = BlobServiceClient.from_connection_string(conn_str)
    container_client = service.get_container_client(container)
    content_type = CONTENT_TYPES.get(file_path.suffix.lower(), "application/octet-stream")

    with open(file_path, "rb") as f:
        blob_client = container_client.upload_blob(
            name=blob_name,
            data=f,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
    return blob_client.url


def ensure_vector_index(collection, dimensions: int) -> None:
    existing = {idx["name"] for idx in collection.list_search_indexes()}
    if INDEX_NAME in existing:
        print(f"索引 {INDEX_NAME} 已存在，略過建立")
        return

    index_model = SearchIndexModel(
        definition={
            "fields": [
                {"type": "vector", "path": "embedding", "numDimensions": dimensions, "similarity": "cosine"},
                {"type": "filter", "path": "source_id"},
            ]
        },
        name=INDEX_NAME,
        type="vectorSearch",
    )
    collection.create_search_index(index_model)
    print(f"已建立索引 {INDEX_NAME}（numDimensions={dimensions}），Atlas 需要幾分鐘建置完成才能查詢")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, type=Path, help="來源檔案路徑（相對於 backend/ 或絕對路徑）")
    parser.add_argument("--source-id", required=True, help="文件唯一識別字串，例如 progit")
    parser.add_argument("--title", required=True, help="文件標題，例如 'Pro Git'")
    parser.add_argument("--source-type", default="pdf", help="文件類型，預設 pdf")
    parser.add_argument("--page-offset", type=int, default=0, help="印刷頁碼相對 PDF 實際頁碼的偏移量")
    parser.add_argument("--pages-per-group", type=int, default=12, help="每組送進 embedding 的頁數")
    parser.add_argument("--chunk-size", type=int, default=300, help="每個 chunk 的目標 token 數")
    parser.add_argument("--container", default=os.environ.get("AZURE_STORAGE_CONTAINER", "documents"))
    parser.add_argument("--blob-name", default=None, help="預設為 {source-id}{副檔名}")
    return parser.parse_args()


def main():
    args = parse_args()

    file_path = args.file if args.file.is_absolute() else Path(__file__).parent.parent / args.file
    if not file_path.exists():
        sys.exit(f"找不到檔案：{file_path}")

    voyage_key = os.environ.get("VOYAGE_API_KEY")
    if not voyage_key:
        sys.exit("VOYAGE_API_KEY 未設定，請加到 backend/.env")

    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        sys.exit("MONGODB_URI 未設定")

    blob_name = args.blob_name or f"{args.source_id}{file_path.suffix}"

    print(f"上傳 {file_path.name} 到 Azure Blob（container={args.container}, blob={blob_name}）...")
    blob_url = upload_to_blob(file_path, args.container, blob_name)
    print(f"已上傳：{blob_url}")

    print("讀取檔案...")
    pages = extract_pages(file_path, args.source_type)
    print(f"共 {len(pages)} 頁")

    groups = group_pages(pages, args.pages_per_group)
    print(f"分成 {len(groups)} 組，開始 embedding...")

    common_fields = {
        "source_id": args.source_id,
        "source_type": args.source_type,
        "title": args.title,
        "blob_url": blob_url,
    }

    vo = voyageai.Client(api_key=voyage_key)
    records = embed_groups(vo, groups, args.chunk_size, args.page_offset, common_fields)
    print(f"共產生 {len(records)} 個 chunks")

    client = MongoClient(mongo_uri)
    db = client.get_default_database()
    collection = db[COLLECTION_NAME]

    collection.delete_many({"source_id": args.source_id})
    collection.insert_many(records)
    print(f"已寫入 {len(records)} 筆到 {COLLECTION_NAME} collection（source_id={args.source_id}）")

    ensure_vector_index(collection, dimensions=len(records[0]["embedding"]))

    client.close()


if __name__ == "__main__":
    main()
