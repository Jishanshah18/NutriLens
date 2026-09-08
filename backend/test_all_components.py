"""
NutriLens Full System Component Verification Test Suite
Tests all Backend, ML, Database, and Router Components.
"""

import sys
from fastapi.testclient import TestClient
from main import app
from services.model_service import load_models, analyze_ingredients
from ml.knowledge import ADDITIVES_DATABASE, ALLERGEN_TAXONOMY
from database import db_store

def run_tests():
    print("=" * 60)
    print("  NUTRILENS COMPREHENSIVE COMPONENT VERIFICATION")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    def check(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name} {details}")
            passed += 1
        else:
            print(f"  [FAIL] {name} {details}")
            failed += 1

    # 1. Test Database / In-Memory Store
    print("\n1. Testing Database & In-Memory Store Component...")
    check("Default user profile exists", "default_user" in db_store.profiles)
    check("Default scan history loaded", len(db_store.scan_history) >= 2)
    check("Default user stats loaded", "default_user" in db_store.user_stats)
    check("Default badges loaded", len(db_store.badges.get("default_user", [])) >= 4)
    check("Default quizzes loaded", len(db_store.quizzes) >= 2)

    # 2. Test ML Knowledge & Models
    print("\n2. Testing ML Engine & Knowledge Base Component...")
    check("Additives database populated", len(ADDITIVES_DATABASE) >= 10)
    check("Allergen taxonomy populated", len(ALLERGEN_TAXONOMY) >= 5)
    load_models()
    res = analyze_ingredients("Organic Blueberries, Water, Organic Lemon Juice")
    check("ML Inference executes", res.health_score > 0)
    check("NOVA group prediction in range [1, 4]", 1 <= res.nova_group <= 4)
    check("Clean food receives high health score", res.health_score >= 80, f"(Score: {res.health_score})")

    # Test Allergen detection
    from models.schemas import UserProfile
    user_with_allergy = UserProfile(user_id="test_user", allergies=["Peanuts"])
    allergy_res = analyze_ingredients("Wheat flour, sugar, peanuts, vegetable oil", user_with_allergy)
    check("Allergen flag detected", "Peanuts" in allergy_res.allergen_flags)
    check("Personalized allergen warning triggered", "CRITICAL ALLERGEN ALERT" in allergy_res.personalized_verdict)

    # 3. Test FastAPI Client & All Router Endpoints
    print("\n3. Testing FastAPI Server & API Router Endpoints...")
    client = TestClient(app)

    # Root & Health
    r = client.get("/")
    check("GET / (Root endpoint)", r.status_code == 200 and r.json().get("status") == "online")

    r = client.get("/api/health")
    check("GET /api/health (Health check)", r.status_code == 200 and r.json().get("status") == "healthy")

    # Model & Datasets router
    r = client.get("/api/model/info")
    check("GET /api/model/info", r.status_code == 200 and "status" in r.json())

    r = client.get("/api/model/datasets")
    check("GET /api/model/datasets", r.status_code == 200)

    # User profile router
    r = client.get("/api/user/profile?user_id=default_user")
    check("GET /api/user/profile", r.status_code == 200 and r.json().get("user_id") == "default_user")

    r = client.put("/api/user/profile", json={
        "user_id": "default_user",
        "dietary_preferences": ["Low Sugar", "Vegan"],
        "allergies": ["Peanuts", "Soy"],
        "health_goals": ["Weight Loss"]
    })
    check("PUT /api/user/profile", r.status_code == 200 and "Soy" in r.json().get("allergies", []))

    r = client.get("/api/user/stats?user_id=default_user")
    check("GET /api/user/stats", r.status_code == 200 and "current_streak" in r.json())

    # History router
    r = client.get("/api/history?user_id=default_user")
    check("GET /api/history", r.status_code == 200 and isinstance(r.json(), list))

    r = client.get("/api/history/scan-1")
    check("GET /api/history/{scan_id}", r.status_code == 200 and r.json().get("id") == "scan-1")

    # Engagement router
    r = client.get("/api/engagement/quizzes")
    check("GET /api/engagement/quizzes", r.status_code == 200 and len(r.json()) > 0)

    r = client.get("/api/engagement/badges?user_id=default_user")
    check("GET /api/engagement/badges", r.status_code == 200 and len(r.json()) > 0)

    r = client.post("/api/engagement/quiz/submit?user_id=default_user", json={
        "quiz_id": "q-101",
        "user_answer": "Myth - Weight & genetics are primary drivers, though high sugar contributes"
    })
    check("POST /api/engagement/quiz/submit", r.status_code == 200 and r.json().get("is_correct") is True)

    # Analyze router
    r = client.post("/api/analyze-label", json={
        "ocr_text": "Water, High Fructose Corn Syrup, Sugar, Peanuts, E621, E102",
        "user_profile": {
            "user_id": "default_user",
            "dietary_preferences": ["Low Sugar"],
            "allergies": ["Peanuts"],
            "health_goals": ["Weight Loss"]
        }
    })
    check("POST /api/analyze-label", r.status_code == 200 and r.json().get("health_score") is not None)

    r = client.get("/api/alternatives?category=snacks")
    check("GET /api/alternatives", r.status_code == 200 and len(r.json()) > 0)

    print("\n" + "=" * 60)
    print(f"  TEST RESULTS SUMMARY: {passed} PASSED, {failed} FAILED")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    run_tests()
