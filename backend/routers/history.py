from fastapi import APIRouter, HTTPException, Query
from typing import List
from models.schemas import ScanHistoryItem
from services.history_service import get_scan_history, get_scan_by_id, delete_scan_by_id

router = APIRouter(tags=["History"])

@router.get("/history", response_model=List[ScanHistoryItem])
async def fetch_history(
    user_id: str = "default_user",
    limit: int = Query(20, ge=1, le=100)
):
    """
    Retrieve previous product scan history for a user.
    """
    try:
        return get_scan_history(user_id=user_id, limit=limit)
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
async def delete_scan_entry(scan_id: str):
    """
    Delete a scan history entry.
    """
    success = delete_scan_by_id(scan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Scan entry not found")
    return {"message": f"Scan entry {scan_id} deleted successfully"}
