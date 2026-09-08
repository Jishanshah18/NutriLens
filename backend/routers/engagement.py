from fastapi import APIRouter, HTTPException
from typing import List
from models.schemas import (
    QuizQuestion,
    QuizSubmitRequest,
    QuizSubmitResponse,
    BadgeItem
)
from services.engagement_service import get_daily_quizzes, submit_quiz_answer, get_user_badges

router = APIRouter(tags=["Engagement"])

@router.get("/engagement/quizzes", response_model=List[QuizQuestion])
async def fetch_quizzes():
    """
    Get available daily nutrition quizzes.
    """
    try:
        return get_daily_quizzes()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/engagement/quiz/submit", response_model=QuizSubmitResponse)
async def submit_quiz(request: QuizSubmitRequest, user_id: str = "default_user"):
    """
    Submit answer to a daily quiz and earn XP points.
    """
    try:
        return submit_quiz_answer(request.quiz_id, request.user_answer, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/engagement/badges", response_model=List[BadgeItem])
async def fetch_badges(user_id: str = "default_user"):
    """
    Get user badges (unlocked and locked).
    """
    try:
        return get_user_badges(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
