from typing import List, Optional
from database import db_store
from models.schemas import QuizQuestion, QuizSubmitResponse, BadgeItem

def get_daily_quizzes() -> List[QuizQuestion]:
    return [QuizQuestion(**q) for q in db_store.quizzes]


def submit_quiz_answer(quiz_id: str, user_answer: str, user_id: str = "default_user") -> QuizSubmitResponse:
    quiz_data = next((q for q in db_store.quizzes if q["id"] == quiz_id), None)
    if not quiz_data:
        return QuizSubmitResponse(
            is_correct=False,
            explanation="Quiz question not found.",
            xp_earned=0,
            total_xp=db_store.user_stats[user_id]["xp"],
            new_streak=db_store.user_stats[user_id]["current_streak"]
        )
        
    is_correct = (user_answer.strip().lower() == quiz_data["correct_answer"].strip().lower()) or (
        quiz_data["type"] == "myth_vs_fact" and ("myth" in user_answer.lower() and "myth" in quiz_data["correct_answer"].lower())
    )
    
    xp_earned = quiz_data["xp_reward"] if is_correct else 10
    
    stats = db_store.user_stats.get(user_id, {
        "user_id": user_id,
        "current_streak": 14,
        "scans_today": 3,
        "total_scans": 28,
        "xp": 450,
        "level": 3
    })
    
    stats["xp"] += xp_earned
    stats["level"] = (stats["xp"] // 200) + 1
    db_store.update_user_stats(user_id, stats)
    
    return QuizSubmitResponse(
        is_correct=is_correct,
        explanation=quiz_data["explanation"],
        xp_earned=xp_earned,
        total_xp=stats["xp"],
        new_streak=stats["current_streak"]
    )


def get_user_badges(user_id: str = "default_user") -> List[BadgeItem]:
    badges = db_store.badges.get(user_id, [])
    return [BadgeItem(**b) for b in badges]
