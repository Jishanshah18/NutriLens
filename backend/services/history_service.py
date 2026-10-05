import uuid
import json
import time
from typing import List, Optional, Dict
from datetime import datetime, timezone
from database import db_store, supabase
from models.schemas import ScanHistoryItem, AnalyzeResponse

# In-memory deduplication cache: (user_id:product_name) -> (timestamp, ScanHistoryItem)
_recent_scan_dedup: Dict[str, tuple[float, ScanHistoryItem]] = {}
DEDUP_WINDOW_SECONDS = 15.0

def save_scan_history(analysis: AnalyzeResponse, ocr_text: str, user_id: str) -> Optional[ScanHistoryItem]:
    if not user_id or user_id in ["guest", ""] or user_id.startswith("test"):
        return None

    # RULE: Only valid food products can be saved as scan history
    if analysis.is_food is False:
        return None

    prod_name = (analysis.product_name or "").strip()
    prod_name_lower = prod_name.lower()
    
    # Reject dummy names, unreadable scans, or raw ingredient/table dumps
    if (
        not prod_name
        or len(prod_name) > 60
        or prod_name_lower in [
            "unrecognized image",
            "non-food / foreign object",
            "unrecognized item",
            "barcode not detected",
            "scanned food item",
            "scanned food product",
            "packaged food item",
            "product not found"
        ]
        or prod_name_lower.startswith("water, high fructose")
        or prod_name_lower.startswith("ingredients:")
        or prod_name_lower.startswith("serving size")
        or prod_name_lower.startswith("facts per")
    ):
        return None

    # Deduplication Guard: prevent duplicate records from rapid re-renders or double taps
    dedup_key = f"{user_id}:{prod_name.lower()}"
    now_ts = time.time()
    if dedup_key in _recent_scan_dedup:
        last_ts, existing_item = _recent_scan_dedup[dedup_key]
        if now_ts - last_ts < DEDUP_WINDOW_SECONDS:
            return existing_item

    scan_id = f"scan-{uuid.uuid4().hex[:8]}"
    item_dict = {
        "id": scan_id,
        "product_name": prod_name,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "health_score": analysis.health_score,
        "allergen_flags": analysis.allergen_flags or [],
        "verdict_summary": analysis.personalized_verdict,
        "ocr_text": ocr_text
    }

    # Save to Supabase (primary persistent store)
    if supabase:
        try:
            supabase.table("scan_history").insert({**item_dict, "user_id": user_id}).execute()
        except Exception as e:
            print(f"Supabase save scan history warning: {e}")

    # Save to SQLite local store
    db_store.save_scan(item_dict, user_id=user_id)

    # Increment user scan stats
    if user_id in db_store.user_stats:
        db_store.user_stats[user_id]["total_scans"] += 1
        db_store.user_stats[user_id]["scans_today"] += 1
        db_store.user_stats[user_id]["xp"] += 20
        db_store.update_user_stats(user_id, db_store.user_stats[user_id])

    scan_item = ScanHistoryItem(**item_dict)
    _recent_scan_dedup[dedup_key] = (now_ts, scan_item)
    return scan_item


def get_scan_history(user_id: str, limit: int = 20) -> List[ScanHistoryItem]:
    if not user_id:
        return []

    # 1. Fetch from Supabase (Source of Truth)
    if supabase:
        try:
            res = (
                supabase.table("scan_history")
                .select("*")
                .eq("user_id", user_id)
                .order("scanned_at", desc=True)
                .limit(limit)
                .execute()
            )
            if res.data is not None:
                return [ScanHistoryItem(**item) for item in res.data]
        except Exception as e:
            print(f"Notice: Supabase scan history query: {e}")

    # 2. Fallback to local SQLite - strictly filtered by user_id
    with db_store._get_conn() as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT id, product_name, scanned_at, health_score, allergen_flags, verdict_summary, ocr_text
            FROM scan_history
            WHERE user_id = ?
            ORDER BY scanned_at DESC
            LIMIT ?
            """,
            (user_id, limit)
        ).fetchall()

        results = []
        for r in rows:
            results.append(ScanHistoryItem(
                id=r[0],
                product_name=r[1],
                scanned_at=r[2],
                health_score=r[3],
                allergen_flags=json.loads(r[4] or "[]"),
                verdict_summary=r[5],
                ocr_text=r[6]
            ))
        return results


def get_scan_by_id(scan_id: str) -> Optional[ScanHistoryItem]:
    # 1. Check Supabase
    if supabase:
        try:
            res = supabase.table("scan_history").select("*").eq("id", scan_id).execute()
            if res.data and len(res.data) > 0:
                return ScanHistoryItem(**res.data[0])
        except Exception as e:
            print(f"Supabase get_scan_by_id notice: {e}")

    # 2. Check local SQLite
    with db_store._get_conn() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            """
            SELECT id, product_name, scanned_at, health_score, allergen_flags, verdict_summary, ocr_text
            FROM scan_history
            WHERE id = ?
            """,
            (scan_id,)
        ).fetchone()
        if row:
            return ScanHistoryItem(
                id=row[0],
                product_name=row[1],
                scanned_at=row[2],
                health_score=row[3],
                allergen_flags=json.loads(row[4] or "[]"),
                verdict_summary=row[5],
                ocr_text=row[6]
            )
    return None


def delete_scan_by_id(scan_id: str, user_id: Optional[str] = None) -> bool:
    # 1. Delete from Supabase
    if supabase:
        try:
            query = supabase.table("scan_history").delete().eq("id", scan_id)
            if user_id:
                query = query.eq("user_id", user_id)
            query.execute()
        except Exception as e:
            print(f"Supabase delete notice: {e}")

    # 2. Delete from SQLite
    with db_store._get_conn() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM scan_history WHERE id = ? AND user_id = ?", (scan_id, user_id))
        else:
            cursor.execute("DELETE FROM scan_history WHERE id = ?", (scan_id,))
        conn.commit()
    return True
