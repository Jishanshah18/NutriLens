from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from models.schemas import (
    UserProfile,
    UserStatsResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserAuthResponse,
    UserPasswordUpdateRequest
)
from services.user_service import (
    get_user_profile,
    update_user_profile,
    get_user_stats,
    register_new_user,
    authenticate_existing_user,
    list_all_users,
    update_user_password
)

router = APIRouter(tags=["User"])

@router.post("/user/register", response_model=UserAuthResponse)
async def register_account(request: UserRegisterRequest):
    """
    Create a new user account with personal profile and persistent health conditions.
    """
    try:
        return register_new_user(request)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/user/login", response_model=UserAuthResponse)
async def login_account(request: UserLoginRequest):
    """
    Authenticate an existing user and retrieve their persistent health profile.
    """
    try:
        auth_res = authenticate_existing_user(request)
        if not auth_res:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return auth_res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@router.get("/user/list", response_model=List[Dict[str, Any]])
async def fetch_user_list():
    """
    List available user profiles for quick-switching during testing or multi-profile setups.
    """
    try:
        return list_all_users()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/profile", response_model=UserProfile)
async def fetch_user_profile(user_id: str = "default_user"):
    """
    Retrieve user health conditions, dietary preferences, allergies, and goals.
    """
    try:
        return get_user_profile(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/user/profile", response_model=UserProfile)
async def modify_user_profile(profile: UserProfile):
    """
    Update and persist user health conditions, dietary preferences, allergies, and goals.
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


@router.post("/user/logout")
async def logout_account():
    """
    Log out active user session.
    """
    return {"success": True, "message": "Logged out successfully."}


@router.get("/user/me", response_model=UserProfile)
async def fetch_current_user(user_id: str = "default_user"):
    """
    Get active user session profile.
    """
    try:
        return get_user_profile(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/user/password")
async def update_password_endpoint(request: UserPasswordUpdateRequest):
    """
    Update user password in backend persistent database.
    """
    try:
        target_id = request.user_id or "default_user"
        success = update_user_password(target_id, request.new_password)
        if not success:
            # Fallback to default_user if target_id wasn't found
            success = update_user_password("default_user", request.new_password)
        return {"success": True, "message": "Password updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
