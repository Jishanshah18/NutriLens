from typing import Optional
from database import db_store, supabase
from models.schemas import UserProfile, UserStatsResponse, BadgeItem

def get_user_profile(user_id: str = "default_user") -> UserProfile:
    if supabase:
        try:
            res = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
            if res.data:
                return UserProfile(**res.data[0])
        except Exception as e:
            print(f"Supabase fetch profile error: {e}")
            
    data = db_store.profiles.get(user_id) or {
        "user_id": user_id,
        "dietary_preferences": [],
        "allergies": [],
        "health_goals": []
    }
    return UserProfile(**data)


def update_user_profile(profile: UserProfile) -> UserProfile:
    user_id = profile.user_id
    profile_dict = profile.model_dump()
    
    if supabase:
        try:
            supabase.table("user_profiles").upsert(profile_dict).execute()
        except Exception as e:
            print(f"Supabase update profile error: {e}")

    db_store.save_profile(profile_dict)
    return profile


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
