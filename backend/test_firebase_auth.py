"""
Verification test for Firebase Auth and User Identity Preservation in NutriLens.
"""
import sys
from fastapi.testclient import TestClient
from main import app
from services.auth_service import verify_firebase_id_token, resolve_and_preserve_user_identity
from database import db_store

def test_firebase_integration():
    print("Testing Firebase Auth & Identity Mapping...")
    client = TestClient(app)

    # 1. Test mock / dev token verification
    verified = verify_firebase_id_token("nutrilens_session_active")
    assert verified is not None, "Failed to verify session token"
    assert verified["uid"] == "default_user", "UID mismatch"
    print("  [PASS] Session token verification")

    # 2. Test user identity preservation:
    # First save a scan for a legacy user to verify scan migration
    from services.history_service import save_scan_history
    from models.schemas import AnalyzeResponse
    save_scan_history(
        AnalyzeResponse(is_food=True, product_name="Sarah Granola", health_score=92, personalized_verdict="Healthy"),
        "Whole grain oats, honey",
        user_id="user_diabetes"
    )

    import uuid
    firebase_uid = f"fb_test_sarah_{uuid.uuid4().hex[:6]}"
    preserved_prof = resolve_and_preserve_user_identity(
        uid=firebase_uid,
        email="sarah.diabetes@nutrilens.ai",
        full_name="Sarah Connor"
    )

    assert preserved_prof.user_id == firebase_uid, "Preserved profile user_id not mapped"
    assert "Diabetes" in preserved_prof.health_conditions, "Legacy health conditions lost!"
    print(f"  [PASS] Legacy profile conditions preserved: {preserved_prof.health_conditions}")

    # Verify scan history linked to this new Firebase UID
    with db_store._get_conn() as conn:
        cursor = conn.cursor()
        count = cursor.execute("SELECT COUNT(*) FROM scan_history WHERE user_id = ?", (firebase_uid,)).fetchone()[0]
        assert count >= 1, f"Expected scan history to be migrated, got {count}"
    print(f"  [PASS] Scan history migrated to Firebase UID: {count} items found")

    # 3. Test POST /api/user/firebase-sync endpoint
    r = client.post("/api/user/firebase-sync", json={
        "uid": "fb_new_user_999",
        "email": "newbie@nutrilens.ai",
        "full_name": "Newbie Health"
    })
    assert r.status_code == 200, f"Sync endpoint failed: {r.text}"
    sync_data = r.json()
    assert sync_data["success"] is True
    assert sync_data["user_id"] == "fb_new_user_999"
    print("  [PASS] POST /api/user/firebase-sync endpoint succeeded")

    # 4. Test authenticated GET /api/user/profile with Bearer token
    r = client.get(
        "/api/user/profile",
        headers={"Authorization": "Bearer nutrilens_session_active"}
    )
    assert r.status_code == 200
    assert r.json()["user_id"] == "default_user"
    print("  [PASS] Authenticated GET /api/user/profile succeeded")

    print("\nAll Firebase backend integration tests PASSED!")

if __name__ == "__main__":
    test_firebase_integration()
