from fastapi import APIRouter, HTTPException
from models.schemas import UserProfile, UserStatsResponse
from services.user_service import get_user_profile, update_user_profile, get_user_stats

router = APIRouter(tags=["User"])

@router.get("/user/profile", response_model=UserProfile)
async def fetch_user_profile(user_id: str = "default_user"):
    """
    Retrieve user dietary preferences, allergies, and health goals.
    """
    try:
        return get_user_profile(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/user/profile", response_model=UserProfile)
async def modify_user_profile(profile: UserProfile):
    """
    Update user dietary preferences, allergies, and health goals.
    """
    try:
        return update_user_profile(profile)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/stats", response_model=UserStatsResponse)
async def fetch_user_stats(user_id: str = "default_user"):
    """
    Retrieve current streak, total scans, XP level, and earned badges.
    """
    try:
        return get_user_stats(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
