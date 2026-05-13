import json
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

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


def load_profile(lang: str) -> Profile:
    path = DATA_DIR / f"profile_{lang}.json"
    return Profile(**json.loads(path.read_text(encoding="utf-8")))


@app.get("/")
def read_root():
    return {"message": "Personal Website API is running"}


@app.get("/api/profile", response_model=Profile)
def get_profile(lang: str = Query(default="zh", pattern="^(zh|en)$")):
    return load_profile(lang)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
