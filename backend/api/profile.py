import json
from pathlib import Path
from typing import List

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent / "data"


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


@router.get("/")
def read_root():
    return {"message": "Personal Website API is running"}


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/api/profile", response_model=Profile)
def get_profile(lang: str = Query(default="zh", pattern="^(zh|en)$")):
    return load_profile(lang)
