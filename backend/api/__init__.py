from fastapi import APIRouter

from .profile import router as profile_router
from .sessions import router as sessions_router
from .web_search import router as web_search_router

router = APIRouter()
router.include_router(profile_router)
router.include_router(web_search_router)
router.include_router(sessions_router)
