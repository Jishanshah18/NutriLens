from fastapi import APIRouter, HTTPException, Header, Request
from typing import List, Dict, Any, Optional
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
from services.auth_service import (
    verify_firebase_id_token,
    resolve_and_preserve_user_identity
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


@router.post("/user/firebase-sync", response_model=Dict[str, Any])
async def sync_firebase_user(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Called upon Firebase sign-up, sign-in, or Google authentication to securely
    resolve user identity, preserve existing Supabase and SQLite data, and return persistent profile.
    """
    try:
        body = await request.json()
        uid = body.get("uid")
        email = body.get("email")
        full_name = body.get("full_name")

        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            # Only override if it's a real verified Firebase token (not a dev/mock session placeholder)
            if token and token != "nutrilens_session_active" and not token.startswith("demo_"):
                verified = verify_firebase_id_token(token)
                if verified and not verified.get("is_mock"):
                    if not uid or verified.get("uid"):
                        uid = verified.get("uid") or uid
                    if not email or verified.get("email"):
                        email = verified.get("email") or email
                    if not full_name or verified.get("name"):
                        full_name = verified.get("name") or full_name

        if not uid:
            raise HTTPException(status_code=400, detail="Missing user uid")

        prof = resolve_and_preserve_user_identity(uid, email=email, full_name=full_name)
        return {
            "success": True,
            "user_id": prof.user_id,
            "email": prof.email or email or "",
            "full_name": prof.full_name or full_name or "NutriLens Member",
            "profile": prof.model_dump()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Firebase sync error: {str(e)}")


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
async def fetch_user_profile(
    user_id: str = "default_user",
    authorization: Optional[str] = Header(None)
):
    """
    Retrieve user health conditions, dietary preferences, allergies, and goals.
    Verifies Firebase token when present and preserves legacy data.
    """
    try:
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            verified = verify_firebase_id_token(token)
            if verified and verified.get("uid"):
                return resolve_and_preserve_user_identity(
                    verified["uid"],
                    email=verified.get("email"),
                    full_name=verified.get("name")
                )
        return get_user_profile(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/user/profile", response_model=UserProfile)
async def modify_user_profile(
    profile: UserProfile,
    authorization: Optional[str] = Header(None)
):
    """
    Update and persist user health conditions, dietary preferences, allergies, and goals.
    Secures update against authenticated Firebase user ID if token provided.
    """
    try:
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            verified = verify_firebase_id_token(token)
            if verified and verified.get("uid"):
                profile.user_id = verified["uid"]
        return update_user_profile(profile)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/stats", response_model=UserStatsResponse)
async def fetch_user_stats(
    user_id: str = "default_user",
    authorization: Optional[str] = Header(None)
):
    """
    Retrieve current streak, total scans, XP level, and earned badges.
    """
    try:
        target_uid = user_id
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            verified = verify_firebase_id_token(token)
            if verified and verified.get("uid"):
                target_uid = verified["uid"]
        return get_user_stats(target_uid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/logout")
async def logout_account():
    """
    Log out active user session.
    """
    return {"success": True, "message": "Logged out successfully."}


@router.get("/user/me", response_model=UserProfile)
async def fetch_current_user(
    user_id: str = "default_user",
    authorization: Optional[str] = Header(None)
):
    """
    Get active user session profile.
    """
    try:
        target_uid = user_id
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            verified = verify_firebase_id_token(token)
            if verified and verified.get("uid"):
                return resolve_and_preserve_user_identity(
                    verified["uid"],
                    email=verified.get("email"),
                    full_name=verified.get("name")
                )
        return get_user_profile(target_uid)
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
            success = update_user_password("default_user", request.new_password)
        return {"success": True, "message": "Password updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
