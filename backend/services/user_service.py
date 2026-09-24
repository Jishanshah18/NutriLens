from typing import Optional, List, Dict, Any
from database import db_store, supabase
from models.schemas import (
    UserProfile,
    UserStatsResponse,
    BadgeItem,
    UserLoginRequest,
    UserRegisterRequest,
    UserAuthResponse
)

def get_user_profile(user_id: str = "default_user") -> UserProfile:
    # 1. First check local persistent SQLite store
    local_data = db_store.profiles.get(user_id)
    if local_data:
        return UserProfile(**local_data)

    # 2. Fallback to Supabase cloud if local store doesn't have it
    if supabase:
        try:
            res = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
            if res.data:
                data = res.data[0]
                if "health_conditions" not in data or data["health_conditions"] is None:
                    data["health_conditions"] = []
                prof = UserProfile(**data)
                db_store.save_profile(prof.model_dump())
                return prof
        except Exception as e:
            print(f"Supabase fetch profile notice: {e}")
            
    return UserProfile(
        user_id=user_id,
        email="",
        full_name="",
        health_conditions=[],
        dietary_preferences=[],
        allergies=[],
        health_goals=[]
    )


def update_user_profile(profile: UserProfile) -> UserProfile:
    user_id = profile.user_id
    profile_dict = profile.model_dump()
    
    # 1. Guarantee local persistent SQLite write
    db_store.save_profile(profile_dict)

    # 2. Best-effort sync to Supabase cloud if connected
    if supabase:
        try:
            clean_supa = {
                "user_id": profile.user_id,
                "dietary_preferences": profile.dietary_preferences,
                "allergies": profile.allergies,
                "health_goals": profile.health_goals
            }
            try:
                supabase.table("user_profiles").upsert({**clean_supa, "health_conditions": profile.health_conditions}).execute()
            except Exception:
                supabase.table("user_profiles").upsert(clean_supa).execute()
        except Exception as e:
            print(f"Notice: Supabase cloud sync: {e}")

    return profile


def register_new_user(req: UserRegisterRequest) -> UserAuthResponse:
    res = db_store.register_user(
        email=req.email,
        password=req.password,
        full_name=req.full_name,
        health_conditions=req.health_conditions
    )
    prof = UserProfile(**res["profile"])
    return UserAuthResponse(
        success=True,
        user_id=res["user_id"],
        email=res["email"],
        full_name=res["full_name"],
        token="nutrilens_session_active",
        message="Account created successfully!",
        profile=prof
    )


def authenticate_existing_user(req: UserLoginRequest) -> Optional[UserAuthResponse]:
    res = db_store.authenticate_user(email=req.email, password=req.password)
    if not res:
        return None
    prof = UserProfile(**res["profile"])
    return UserAuthResponse(
        success=True,
        user_id=res["user_id"],
        email=res["email"],
        full_name=res["full_name"],
        token="nutrilens_session_active",
        message="Logged in successfully!",
        profile=prof
    )


def list_all_users() -> List[Dict[str, Any]]:
    return db_store.get_all_users()


def get_user_stats(user_id: str = "default_user") -> UserStatsResponse:
    stats_data = db_store.user_stats.get(user_id, {
        "user_id": user_id,
        "current_streak": 14,
        "scans_today": 3,
        "total_scans": 28,
        "xp": 450,
        "level": 3
    })
    
    badges_raw = db_store.badges.get(user_id, [])
    badges = [BadgeItem(**b) for b in badges_raw]
    
    return UserStatsResponse(
        user_id=user_id,
        current_streak=stats_data.get("current_streak", 14),
        scans_today=stats_data.get("scans_today", 3),
        total_scans=stats_data.get("total_scans", 28),
        xp=stats_data.get("xp", 450),
        level=stats_data.get("level", 3),
        badges=badges
    )
