from fastapi import APIRouter, HTTPException, Query, Header
from typing import List, Optional
from models.schemas import ScanHistoryItem
from services.history_service import get_scan_history, get_scan_by_id, delete_scan_by_id
from services.auth_service import verify_firebase_id_token

router = APIRouter(tags=["History"])

@router.get("/history", response_model=List[ScanHistoryItem])
async def fetch_history(
    user_id: str = "default_user",
    limit: int = Query(20, ge=1, le=100),
    authorization: Optional[str] = Header(None)
):
    """
    Retrieve previous product scan history for a user.
    If authenticated via Firebase token, retrieves scan history for verified user.
    """
    try:
        target_uid = user_id
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            verified = verify_firebase_id_token(token)
            if verified and verified.get("uid"):
                target_uid = verified["uid"]
        return get_scan_history(user_id=target_uid, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{scan_id}", response_model=ScanHistoryItem)
async def fetch_scan_details(scan_id: str):
    """
    Retrieve detailed scan history entry by ID.
    """
    item = get_scan_by_id(scan_id)
    if not item:
        raise HTTPException(status_code=404, detail="Scan entry not found")
    return item


@router.delete("/history/{scan_id}")
async def delete_scan_entry(
    scan_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Delete a scan history entry.
    """
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        verified = verify_firebase_id_token(token)
        if verified and verified.get("uid"):
            user_id = verified["uid"]

    success = delete_scan_by_id(scan_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Scan entry not found")
    return {"message": f"Scan entry {scan_id} deleted successfully"}
