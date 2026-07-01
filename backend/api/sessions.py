import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

from database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


def _make_groq_client() -> Optional[OpenAI]:
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        return OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    return None

_groq = _make_groq_client()


async def _generate_session_title(user_message: str, assistant_message: str) -> str:
    if _groq is None:
        return "新對話"
    try:
        prompt = f"""根據以下對話內容，生成一個簡短的標題，要求：
1. 最多 10 個中文字（2 個英文字算 1 個中文字）
2. 簡潔明瞭，能概括對話主題
3. 只返回標題，不要其他說明

用戶問題：{user_message}
AI 回應：{assistant_message[:200]}

標題："""
        resp = _groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=50,
            temperature=0.3,
        )
        title = (resp.choices[0].message.content or "").strip().strip('"').strip("'")
        return title[:15] if title else "新對話"
    except Exception as e:
        logger.error(f"Title generation failed: {e}")
        return "新對話"


class PlanItem(BaseModel):
    sort: int
    plan: str

class MessageItem(BaseModel):
    role: str
    content: str
    model_name: Optional[str] = None
    tool_used: Optional[str] = None
    search_query: Optional[str] = None
    sources: Optional[list] = None
    plans: Optional[List[PlanItem]] = None

class CreateSessionRequest(BaseModel):
    user_id: str
    user_email: str
    messages: List[MessageItem]
    title: Optional[str] = None

class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_visible: Optional[bool] = None

class AddMessagesRequest(BaseModel):
    messages: List[MessageItem]

class GenerateTitleRequest(BaseModel):
    user_message: str
    assistant_message: str


@router.post("/api/sessions")
async def create_session(body: CreateSessionRequest):
    db = get_db()
    now = datetime.now(timezone.utc)
    session_id = str(uuid.uuid4())

    user_msgs = [m for m in body.messages if m.role == "user"]
    title = body.title or (user_msgs[0].content[:60] if user_msgs else "新對話")

    await db.chat_sessions.insert_one({
        "_id": session_id,
        "user_id": body.user_id,
        "user_email": body.user_email,
        "title": title,
        "is_visible": True,
        "is_pinned": False,
        "pinned_at": None,
        "is_defined_title": body.title is not None,
        "created_at": now,
        "updated_at": now,
    })

    for msg in body.messages:
        msg_id = str(uuid.uuid4())
        await db.chat_messages.insert_one({
            "_id": msg_id,
            "session_id": session_id,
            "role": msg.role,
            "content": msg.content,
            "model_name": msg.model_name,
            "tool_used": msg.tool_used,
            "search_query": msg.search_query,
            "sources": msg.sources or [],
            "created_at": now,
        })

        if msg.role == "assistant" and msg.plans:
            await db.chat_plans.insert_many([
                {
                    "_id": str(uuid.uuid4()),
                    "message_id": msg_id,
                    "sort": p.sort,
                    "plan": p.plan,
                    "created_at": now,
                }
                for p in msg.plans
            ])

    return {"id": session_id, "title": title}


@router.post("/api/sessions/{session_id}/messages")
async def add_messages_to_session(session_id: str, body: AddMessagesRequest):
    db = get_db()
    session = await db.chat_sessions.find_one({"_id": session_id}, {"_id": 1})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    for msg in body.messages:
        msg_id = str(uuid.uuid4())
        await db.chat_messages.insert_one({
            "_id": msg_id,
            "session_id": session_id,
            "role": msg.role,
            "content": msg.content,
            "model_name": msg.model_name,
            "tool_used": msg.tool_used,
            "search_query": msg.search_query,
            "sources": msg.sources or [],
            "created_at": now,
        })
        if msg.role == "assistant" and msg.plans:
            await db.chat_plans.insert_many([
                {"_id": str(uuid.uuid4()), "message_id": msg_id, "sort": p.sort, "plan": p.plan, "created_at": now}
                for p in msg.plans
            ])

    await db.chat_sessions.update_one(
        {"_id": session_id},
        {"$set": {"updated_at": now}},
    )
    return {"ok": True}


@router.get("/api/sessions")
async def list_sessions(user_email: str):
    db = get_db()
    cursor = db.chat_sessions.find(
        {"user_email": user_email, "is_visible": True},
        {"title": 1, "is_pinned": 1, "created_at": 1, "updated_at": 1},
    ).sort([("is_pinned", -1), ("updated_at", -1)]).limit(50)

    items = []
    async for doc in cursor:
        items.append({
            "id": doc["_id"],
            "title": doc["title"],
            "is_pinned": doc.get("is_pinned", False),
            "created_at": doc["created_at"].isoformat(),
            "updated_at": doc["updated_at"].isoformat(),
        })
    return items


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    db = get_db()
    session = await db.chat_sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = []
    async for msg in db.chat_messages.find({"session_id": session_id}).sort("created_at", 1):
        msg_dict = {
            "id": msg["_id"],
            "role": msg["role"],
            "content": msg["content"],
            "model_name": msg.get("model_name"),
            "tool_used": msg.get("tool_used"),
            "search_query": msg.get("search_query"),
            "sources": msg.get("sources", []),
            "created_at": msg["created_at"].isoformat(),
        }
        if msg["role"] == "assistant":
            msg_dict["plans"] = [
                {"sort": p["sort"], "plan": p["plan"]}
                async for p in db.chat_plans.find({"message_id": msg["_id"]}).sort("sort", 1)
            ]
        messages.append(msg_dict)

    return {
        "id": session["_id"],
        "title": session["title"],
        "is_pinned": session.get("is_pinned", False),
        "created_at": session["created_at"].isoformat(),
        "updated_at": session["updated_at"].isoformat(),
        "messages": messages,
    }


@router.post("/api/sessions/{session_id}/title")
async def generate_session_title(session_id: str, body: GenerateTitleRequest):
    db = get_db()
    session = await db.chat_sessions.find_one({"_id": session_id}, {"is_defined_title": 1})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("is_defined_title", False):
        return {"ok": True, "skipped": True}

    title = await _generate_session_title(body.user_message, body.assistant_message)
    await db.chat_sessions.update_one(
        {"_id": session_id},
        {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"ok": True, "title": title}


@router.patch("/api/sessions/{session_id}")
async def update_session(session_id: str, body: UpdateSessionRequest):
    db = get_db()
    fields: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.title is not None:
        fields["title"] = body.title
        fields["is_defined_title"] = True
    if body.is_pinned is not None:
        fields["is_pinned"] = body.is_pinned
        fields["pinned_at"] = datetime.now(timezone.utc) if body.is_pinned else None
    if body.is_visible is not None:
        fields["is_visible"] = body.is_visible

    result = await db.chat_sessions.update_one({"_id": session_id}, {"$set": fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    db = get_db()
    result = await db.chat_sessions.update_one(
        {"_id": session_id},
        {"$set": {"is_visible": False, "deleted_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}
