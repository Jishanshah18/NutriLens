import uuid
from typing import List, Optional
from datetime import datetime, timezone
from database import db_store, supabase
from models.schemas import ScanHistoryItem, AnalyzeResponse

def save_scan_history(analysis: AnalyzeResponse, ocr_text: str, user_id: str = "default_user") -> ScanHistoryItem:
    scan_id = f"scan-{uuid.uuid4().hex[:8]}"
    item_dict = {
        "id": scan_id,
        "product_name": analysis.product_name or "Scanned Product",
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "health_score": analysis.health_score,
        "allergen_flags": analysis.allergen_flags,
        "verdict_summary": analysis.personalized_verdict,
        "ocr_text": ocr_text
    }
    
    def _async_cloud_save():
        if supabase:
            try:
                supabase.table("scan_history").insert({**item_dict, "user_id": user_id}).execute()
            except Exception as e:
                print(f"Supabase async save error: {e}")

    import threading
    threading.Thread(target=_async_cloud_save, daemon=True).start()

    db_store.save_scan(item_dict, user_id=user_id)
    
    # Increment user scan stats
    if user_id in db_store.user_stats:
        db_store.user_stats[user_id]["total_scans"] += 1
        db_store.user_stats[user_id]["scans_today"] += 1
        db_store.user_stats[user_id]["xp"] += 20
        db_store.update_user_stats(user_id, db_store.user_stats[user_id])
        
    return ScanHistoryItem(**item_dict)


def get_scan_history(user_id: str = "default_user", limit: int = 20) -> List[ScanHistoryItem]:
    if supabase:
        try:
            res = supabase.table("scan_history").select("*").eq("user_id", user_id).order("scanned_at", desc=True).limit(limit).execute()
            if res.data:
                return [ScanHistoryItem(**item) for item in res.data]
        except Exception as e:
            print(f"Supabase fetch scan history error: {e}")
            
    items = db_store.scan_history[:limit]
    return [ScanHistoryItem(**item) for item in items]


def get_scan_by_id(scan_id: str) -> Optional[ScanHistoryItem]:
    for item in db_store.scan_history:
        if item["id"] == scan_id:
            return ScanHistoryItem(**item)
    return None


def delete_scan_by_id(scan_id: str) -> bool:
    return db_store.delete_scan(scan_id)
