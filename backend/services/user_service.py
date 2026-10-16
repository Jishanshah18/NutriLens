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
            if profile.age is not None:
                clean_supa["age"] = profile.age
            try:
                supabase.table("user_profiles").upsert({**clean_supa, "health_conditions": profile.health_conditions}).execute()
            except Exception:
                # If health_conditions or age column isn't in user_profiles schema yet, fall back to core columns
                try:
                    supabase.table("user_profiles").upsert({
                        "user_id": profile.user_id,
                        "dietary_preferences": profile.dietary_preferences,
                        "allergies": profile.allergies,
                        "health_goals": profile.health_goals
                    }).execute()
                except Exception as inner_e:
                    print(f"Supabase upsert fallback notice: {inner_e}")
        except Exception as e:
            print(f"Notice: Supabase cloud sync: {e}")

    return profile


def register_new_user(req: UserRegisterRequest) -> UserAuthResponse:
    res = db_store.register_user(
        email=req.email,
        password=req.password,
        full_name=req.full_name,
        age=req.age,
        health_conditions=req.health_conditions,
        dietary_preferences=req.dietary_preferences,
        allergies=req.allergies,
        health_goals=req.health_goals
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


from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from database import db_store, supabase
from models.schemas import (
    UserProfile,
    UserStatsResponse,
    BadgeItem,
    UserLoginRequest,
    UserRegisterRequest,
    UserAuthResponse,
    WeeklyDayData,
    WeeklyReportResponse,
    NutritionInsightsResponse
)

DEMO_USER_IDS = {"default_user", "demo_user", "user_diabetes", "user_hypertension", "user_clean"}

DEMO_WEEKLY_DAYS = [
    WeeklyDayData(day="Mon", date="2026-10-12", score=82, scans=3),
    WeeklyDayData(day="Tue", date="2026-10-13", score=74, scans=2),
    WeeklyDayData(day="Wed", date="2026-10-14", score=91, scans=4),
    WeeklyDayData(day="Thu", date="2026-10-15", score=68, scans=3),
    WeeklyDayData(day="Fri", date="2026-10-16", score=85, scans=5),
    WeeklyDayData(day="Sat", date="2026-10-17", score=94, scans=2),
    WeeklyDayData(day="Sun", date="2026-10-18", score=88, scans=3),
]

def calculate_real_user_stats(user_id: str) -> UserStatsResponse:
    """
    Derives genuine user statistics strictly from saved scan history in the database.
    Rules:
    - 1 day counts only if >= 1 valid scan was saved on that date.
    - Multiple scans on same day = 1 streak day.
    - If user scanned today: checks consecutive previous days backwards.
    - If user scanned yesterday: streak up to yesterday is active.
    - If user missed a full day: streak is 0.
    - If user has never scanned: streak is 0.
    """
    from services.history_service import get_scan_history
    scans = get_scan_history(user_id, limit=500)
    total_scans = len(scans)

    if total_scans == 0:
        return UserStatsResponse(
            user_id=user_id,
            current_streak=0,
            scans_today=0,
            total_scans=0,
            xp=0,
            level=1,
            badges=[
                BadgeItem(id="b1", name="Label Reader", icon="🔍", description="Scanned first food item", unlocked=False),
                BadgeItem(id="b2", name="Sugar Detective", icon="🛡️", description="Flagged high sugar product", unlocked=False),
                BadgeItem(id="b3", name="Streak Master", icon="🔥", description="Maintained 7-day scan streak", unlocked=False),
                BadgeItem(id="b4", name="Additive Hunter", icon="⚡", description="Found harmful food additives", unlocked=False)
            ]
        )

    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime("%Y-%m-%d")
    yesterday_str = (now_utc - timedelta(days=1)).strftime("%Y-%m-%d")

    scans_today = 0
    unique_dates = set()
    for s in scans:
        if s.scanned_at:
            try:
                # s.scanned_at can be datetime or ISO string
                d_str = s.scanned_at.strftime("%Y-%m-%d") if isinstance(s.scanned_at, datetime) else str(s.scanned_at)[:10]
                unique_dates.add(d_str)
                if d_str == today_str:
                    scans_today += 1
            except Exception:
                pass

    # Real scan streak calculation
    current_streak = 0
    anchor_date = None
    if today_str in unique_dates:
        anchor_date = now_utc.date()
    elif yesterday_str in unique_dates:
        anchor_date = (now_utc - timedelta(days=1)).date()

    if anchor_date:
        curr = anchor_date
        while curr.strftime("%Y-%m-%d") in unique_dates:
            current_streak += 1
            curr -= timedelta(days=1)

    xp = total_scans * 20
    level = max(1, xp // 100 + 1)

    badges = [
        BadgeItem(
            id="b1",
            name="Label Reader",
            icon="🔍",
            description="Scanned first food item",
            unlocked=total_scans >= 1,
            unlocked_at=scans[-1].scanned_at.strftime("%Y-%m-%d") if isinstance(scans[-1].scanned_at, datetime) else str(scans[-1].scanned_at)[:10] if total_scans >= 1 else None
        ),
        BadgeItem(
            id="b2",
            name="Sugar Detective",
            icon="🛡️",
            description="Flagged high sugar product",
            unlocked=any(s.health_score < 60 for s in scans),
            unlocked_at=None
        ),
        BadgeItem(
            id="b3",
            name="Streak Master",
            icon="🔥",
            description="Maintained 7-day scan streak",
            unlocked=current_streak >= 7,
            unlocked_at=None
        ),
        BadgeItem(
            id="b4",
            name="Additive Hunter",
            icon="⚡",
            description="Found harmful food additives",
            unlocked=any(len(s.allergen_flags or []) > 0 for s in scans),
            unlocked_at=None
        )
    ]

    return UserStatsResponse(
        user_id=user_id,
        current_streak=current_streak,
        scans_today=scans_today,
        total_scans=total_scans,
        xp=xp,
        level=level,
        badges=badges
    )


def get_user_stats(user_id: str = "default_user") -> UserStatsResponse:
    if not user_id:
        return UserStatsResponse(
            user_id="",
            current_streak=0,
            scans_today=0,
            total_scans=0,
            xp=0,
            level=1,
            badges=[]
        )

    is_demo = user_id in DEMO_USER_IDS
    if is_demo:
        stats_data = db_store.user_stats.get(user_id, {
            "user_id": user_id,
            "current_streak": 14,
            "scans_today": 3,
            "total_scans": 28,
            "xp": 450,
            "level": 3
        })
        badges_raw = db_store.badges.get(user_id, [])
        if not badges_raw:
            badges_raw = db_store.badges.get("default_user", [])
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
    else:
        return calculate_real_user_stats(user_id)


def get_weekly_report(user_id: str) -> WeeklyReportResponse:
    """
    Returns weekly report.
    For demo users: preserves existing 7-day sample data.
    For real users: queries genuine scans for current week boundaries.
    Missing days show zero activity, not fabricated data.
    """
    if not user_id:
        return WeeklyReportResponse(
            user_id="",
            is_demo=False,
            has_data=False,
            message="Please log in to view your weekly report."
        )

    if user_id in DEMO_USER_IDS:
        return WeeklyReportResponse(
            user_id=user_id,
            is_demo=True,
            has_data=True,
            weekly_avg=83,
            total_scans=23,
            days=DEMO_WEEKLY_DAYS,
            message="Demo 7-day nutritional purity trend"
        )

    # Real user: define current week Monday-Sunday boundaries
    from services.history_service import get_scan_history
    scans = get_scan_history(user_id, limit=200)

    now_utc = datetime.now(timezone.utc)
    # Start of current week (Monday)
    start_of_week = now_utc.date() - timedelta(days=now_utc.weekday())
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    week_days_data: List[WeeklyDayData] = []
    total_week_scans = 0
    scored_days: List[int] = []

    for i in range(7):
        day_date = start_of_week + timedelta(days=i)
        date_str = day_date.strftime("%Y-%m-%d")
        day_name = day_names[i]

        # Find scans matching this date
        matching_scans = []
        for s in scans:
            if s.scanned_at:
                s_date = s.scanned_at.strftime("%Y-%m-%d") if isinstance(s.scanned_at, datetime) else str(s.scanned_at)[:10]
                if s_date == date_str:
                    matching_scans.append(s)

        if matching_scans:
            day_avg = round(sum(s.health_score for s in matching_scans) / len(matching_scans))
            scan_count = len(matching_scans)
            total_week_scans += scan_count
            scored_days.append(day_avg)
            week_days_data.append(WeeklyDayData(day=day_name, date=date_str, score=day_avg, scans=scan_count))
        else:
            week_days_data.append(WeeklyDayData(day=day_name, date=date_str, score=0, scans=0))

    if total_week_scans == 0:
        return WeeklyReportResponse(
            user_id=user_id,
            is_demo=False,
            has_data=False,
            weekly_avg=None,
            total_scans=0,
            days=week_days_data,
            message="Your weekly report will appear after your first scan."
        )

    overall_avg = round(sum(scored_days) / len(scored_days)) if scored_days else None
    return WeeklyReportResponse(
        user_id=user_id,
        is_demo=False,
        has_data=True,
        weekly_avg=overall_avg,
        total_scans=total_week_scans,
        days=week_days_data,
        message=f"Weekly average health score: {overall_avg}/100 across {total_week_scans} scan(s)."
    )


def get_nutrition_insights(user_id: str) -> NutritionInsightsResponse:
    """
    Returns nutrition insights.
    For demo users: preserves existing sample data (78% clean diet, 22% UPF, 84 purity, 14 hazards).
    For real users: derives metrics strictly from saved scan records.
    """
    if not user_id:
        return NutritionInsightsResponse(
            user_id="",
            is_demo=False,
            has_data=False,
            summary_message="Sign in to view your nutrition insights."
        )

    if user_id in DEMO_USER_IDS:
        return NutritionInsightsResponse(
            user_id=user_id,
            is_demo=True,
            has_data=True,
            total_scans=28,
            clean_diet_ratio=78,
            upf_ratio=22,
            avg_purity_score=84,
            hazards_avoided_count=14,
            sugar_today_g=16.0,
            sodium_today_mg=980.0,
            protein_today_g=52.0,
            clean_brands=[
                {"name": "Organic Valley", "score": 96, "label": "Zero Artificial Preservatives", "icon": "🌱"},
                {"name": "Simple Mills", "score": 93, "label": "Almond & Coconut Flour Whole Snacks", "icon": "🌾"},
                {"name": "Artisana Organics", "score": 91, "label": "Raw Single-Ingredient Nut Butters", "icon": "🥜"},
                {"name": "Purely Elizabeth", "score": 89, "label": "Ancient Grain Chia Granola", "icon": "🥣"}
            ],
            watchlist_brands=[
                {"name": "MegaSnack Chips", "score": 24, "label": "Contains E621, E102, Refined Palm Oil", "icon": "🍟"},
                {"name": "UltraCola Refresh", "score": 18, "label": "High Fructose Corn Syrup & Phosphoric Acid", "icon": "🥤"},
                {"name": "SweetCrave Frosting", "score": 22, "label": "Hydrogenated Trans-Fats & Titanium Dioxide", "icon": "🧁"}
            ],
            summary_message="Demo nutritional insights preview."
        )

    from services.history_service import get_scan_history
    scans = get_scan_history(user_id, limit=500)
    total_scans = len(scans)

    if total_scans == 0:
        return NutritionInsightsResponse(
            user_id=user_id,
            is_demo=False,
            has_data=False,
            total_scans=0,
            clean_diet_ratio=None,
            upf_ratio=None,
            avg_purity_score=None,
            hazards_avoided_count=0,
            sugar_today_g=0.0,
            sodium_today_mg=0.0,
            protein_today_g=0.0,
            clean_brands=[],
            watchlist_brands=[],
            summary_message="Scan a food item to discover personalized nutrition insights."
        )

    clean_count = sum(1 for s in scans if s.health_score >= 70)
    upf_count = sum(1 for s in scans if s.health_score < 50)
    clean_ratio = round((clean_count / total_scans) * 100)
    upf_ratio = round((upf_count / total_scans) * 100)
    avg_score = round(sum(s.health_score for s in scans) / total_scans)
    hazards_count = sum(len(s.allergen_flags or []) for s in scans)

    # Scans from today for nutrient estimation
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_scans = [
        s for s in scans
        if (s.scanned_at.strftime("%Y-%m-%d") if isinstance(s.scanned_at, datetime) else str(s.scanned_at)[:10]) == today_str
    ]

    # Clean and watchlist brands from actual user scans
    brand_map: Dict[str, List[int]] = {}
    for s in scans:
        b_name = (s.product_name or "").strip()
        if b_name and len(b_name) > 2:
            brand_map.setdefault(b_name, []).append(s.health_score)

    clean_brands = []
    watchlist_brands = []
    for b_name, scores in brand_map.items():
        b_avg = round(sum(scores) / len(scores))
        if b_avg >= 75:
            clean_brands.append({"name": b_name, "score": b_avg, "label": "Clean whole food choice", "icon": "🌱"})
        elif b_avg < 55:
            watchlist_brands.append({"name": b_name, "score": b_avg, "label": "High processing or additives", "icon": "⚠️"})

    return NutritionInsightsResponse(
        user_id=user_id,
        is_demo=False,
        has_data=True,
        total_scans=total_scans,
        clean_diet_ratio=clean_ratio,
        upf_ratio=upf_ratio,
        avg_purity_score=avg_score,
        hazards_avoided_count=hazards_count,
        sugar_today_g=0.0,
        sodium_today_mg=0.0,
        protein_today_g=0.0,
        clean_brands=clean_brands[:4],
        watchlist_brands=watchlist_brands[:4],
        summary_message=f"Based on {total_scans} genuine food scan(s)."
    )


def update_user_password(user_id: str, new_password: str) -> bool:
    return db_store.update_password(user_id, new_password)
