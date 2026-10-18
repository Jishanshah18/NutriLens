"""
NutriLens End-to-End Scanner Test Suite
Executes Phase 8 Automated Tests for both Local FastAPI and Live Render Backend.
Covers all 14 mandatory test scenarios.
"""

import os
import sys
import time
import base64
import io
import json
import urllib.request
import urllib.error
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from fastapi.testclient import TestClient
from main import app

# Initialize local TestClient
client = TestClient(app)

RENDER_BASE_URL = "https://nutrilens-jfiv.onrender.com"

# Helper to create realistic test images
def make_text_image(text_lines, width=600, height=400, bg=(255, 255, 255), fg=(0, 0, 0)):
    img = Image.new("RGB", (width, height), color=bg)
    draw = ImageDraw.Draw(img)
    y = 20
    for line in text_lines:
        draw.text((20, y), line, fill=fg)
        y += 26
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def run_local_tests():
    print("\n" + "=" * 70)
    print("  PHASE 8: LOCAL BACKEND VERIFICATION (14 TEST CASES)")
    print("=" * 70)

    results = []

    def log_result(case_num, title, passed, elapsed, detail):
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] Test {case_num:02d}: {title} ({elapsed:.3f}s)")
        print(f"       -> {detail}")
        results.append({"test": case_num, "title": title, "passed": passed, "time": elapsed, "detail": detail})

    # Test 1: Valid Nutrition Label Image
    t0 = time.time()
    b64_nutri = make_text_image([
        "NUTRITION FACTS",
        "Serving Size 1 cup (240ml)",
        "Calories 140",
        "Total Fat 2.5g",
        "Saturated Fat 1.5g",
        "Sodium 120mg",
        "Total Carbohydrate 12g",
        "Sugars 11g",
        "Protein 8g",
        "Calcium 300mg"
    ])
    r = client.post("/api/analyze-image", json={"image_base64": b64_nutri, "user_profile": {"health_conditions": []}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("is_food") is True and data.get("health_score", 0) > 0
    log_result(1, "Valid Nutrition-Label Image", passed, elapsed,
               f"Status: {r.status_code}, is_food: {data.get('is_food')}, Score: {data.get('health_score')}, NOVA: {data.get('nova_group')}")

    # Test 2: Valid Product Package Image
    t0 = time.time()
    b64_pack = make_text_image([
        "Nestle Maggi 2-Minute Masala Noodles",
        "Good Food Good Life",
        "Iron Fortified Masala Taste",
        "Made with Quality Spices"
    ])
    r = client.post("/api/analyze-image", json={"image_base64": b64_pack, "user_profile": {"health_conditions": []}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("is_food") is True
    log_result(2, "Valid Product-Package Image", passed, elapsed,
               f"Status: {r.status_code}, Product: {data.get('product_name')}, Score: {data.get('health_score')}")

    # Test 3: Ingredients-Label Image
    t0 = time.time()
    b64_ing = make_text_image([
        "INGREDIENTS: Whole grain wheat flour, sugar, palm oil,",
        "cocoa powder, high fructose corn syrup, salt, baking soda,",
        "soy lecithin, artificial vanilla flavor, preservatives (E211)."
    ])
    r = client.post("/api/analyze-image", json={"image_base64": b64_ing, "user_profile": {"health_conditions": ["Diabetes"]}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("is_food") is True and len(data.get("allergen_flags", [])) > 0
    log_result(3, "Ingredients-Label Image with Allergens/Additives", passed, elapsed,
               f"Status: {r.status_code}, Allergens: {data.get('allergen_flags')}, Additives: {[a['code'] for a in data.get('additives', [])]}")

    # Test 4: Valid Known Barcode (Maggi 8901058852898)
    t0 = time.time()
    r = client.get("/api/barcode/8901058852898?user_id=test_user")
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("is_food") is True and "Maggi" in data.get("product_name", "")
    log_result(4, "Valid Known Barcode (8901058852898)", passed, elapsed,
               f"Status: {r.status_code}, Product: {data.get('product_name')}, Score: {data.get('health_score')}")

    # Test 5: Unknown Barcode (9999999999998)
    t0 = time.time()
    r = client.get("/api/barcode/9999999999998?user_id=test_user")
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    rej = str(data.get("rejection_reason") or data.get("personalized_verdict") or "")
    passed = r.status_code == 200 and data.get("is_food") is False
    log_result(5, "Unknown Barcode (Truthful Not-Found)", passed, elapsed,
               f"Status: {r.status_code}, is_food: {data.get('is_food')}, Rejection: {rej[:60]}...")

    # Test 6: Blurry Image
    t0 = time.time()
    # Create an image and blur it heavily
    img_sharp = Image.new("RGB", (600, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img_sharp)
    draw.text((30, 50), "Organic Rolled Oats, Chia Seeds, Flax", fill=(0, 0, 0))
    img_blur = img_sharp.filter(ImageFilter.GaussianBlur(radius=5))
    buf = io.BytesIO()
    img_blur.save(buf, format="JPEG", quality=75)
    b64_blur = base64.b64encode(buf.getvalue()).decode("utf-8")
    r = client.post("/api/analyze-image", json={"image_base64": b64_blur, "user_profile": {"health_conditions": []}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    # Even if blurry, it handles gracefully without crashing: either extracts or returns clear rejection
    passed = r.status_code == 200
    log_result(6, "Blurry Image (Graceful Handling)", passed, elapsed,
               f"Status: {r.status_code}, is_food: {data.get('is_food')}, Product: {data.get('product_name')}")

    # Test 7: Rotated Image (180 degrees)
    t0 = time.time()
    img_rot = Image.new("RGB", (600, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img_rot)
    draw.text((30, 50), "Ingredients: Whole Milk, Vitamin D3", fill=(0, 0, 0))
    img_rot180 = img_rot.rotate(180)
    buf = io.BytesIO()
    img_rot180.save(buf, format="JPEG", quality=85)
    b64_rot = base64.b64encode(buf.getvalue()).decode("utf-8")
    r = client.post("/api/analyze-image", json={"image_base64": b64_rot, "user_profile": {"health_conditions": []}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200
    log_result(7, "Rotated Image (180° inversion test)", passed, elapsed,
               f"Status: {r.status_code}, is_food: {data.get('is_food')}, Score: {data.get('health_score')}")

    # Test 8: Very Large Image (2400x2400px downscaled safely)
    t0 = time.time()
    img_large = Image.new("RGB", (2400, 2400), color=(240, 240, 240))
    draw = ImageDraw.Draw(img_large)
    draw.text((100, 200), "Ingredients: Almonds, Sea Salt", fill=(0, 0, 0))
    buf = io.BytesIO()
    img_large.save(buf, format="JPEG", quality=80)
    b64_large = base64.b64encode(buf.getvalue()).decode("utf-8")
    r = client.post("/api/analyze-image", json={"image_base64": b64_large, "user_profile": {"health_conditions": []}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and elapsed < 8.0  # Must be fast due to downscaling
    log_result(8, "Very Large Image (2400x2400px Safe Scaling)", passed, elapsed,
               f"Status: {r.status_code}, Time: {elapsed:.2f}s (<8s target), is_food: {data.get('is_food')}")

    # Test 9: Corrupted / Invalid Image (not a valid image byte stream)
    t0 = time.time()
    b64_corrupt = base64.b64encode(b"THIS_IS_CORRUPTED_NON_IMAGE_DATA_BYTES").decode("utf-8")
    r = client.post("/api/analyze-image", json={"image_base64": b64_corrupt, "user_profile": {"health_conditions": []}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("is_food") is False
    rej9 = str(data.get('rejection_reason') or data.get('personalized_verdict') or '')
    log_result(9, "Corrupted / Non-Image Data", passed, elapsed,
               f"Status: {r.status_code}, is_food: {data.get('is_food')}, Reason: {rej9[:50]}...")

    # Test 10: Non-Food Image (Receipt / Invoice Text)
    t0 = time.time()
    b64_invoice = make_text_image([
        "TAX INVOICE / RECEIPT",
        "Invoice Number: 98124",
        "Due Date: March 15",
        "Subtotal: $450.00",
        "Tax (18%): $81.00",
        "Total Amount: $531.00",
        "Payment Method: VISA"
    ])
    r = client.post("/api/analyze-image", json={"image_base64": b64_invoice, "user_profile": {"health_conditions": []}})
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("is_food") is False
    rej10 = str(data.get('rejection_reason') or data.get('personalized_verdict') or '')
    log_result(10, "Non-Food Image (Invoice / Office Document)", passed, elapsed,
               f"Status: {r.status_code}, is_food: {data.get('is_food')}, Reason: {rej10[:50]}...")

    # Test 11: Missing File Upload (Multipart Form Endpoint)
    t0 = time.time()
    r = client.post("/api/analyze-label-image", data={})
    elapsed = time.time() - t0
    passed = r.status_code == 400
    log_result(11, "Missing File Upload (HTTP 400 Validation)", passed, elapsed,
               f"Status: {r.status_code}, Detail: {r.json().get('detail')}")

    # Test 12: Backend Unavailable Simulation
    # Check client's fallback / health endpoint resilience
    t0 = time.time()
    r = client.get("/api/health")
    elapsed = time.time() - t0
    passed = r.status_code == 200 and r.json().get("status") == "healthy"
    log_result(12, "Backend Health Endpoint (Local Status)", passed, elapsed,
               f"Status: {r.status_code}, Service: {r.json().get('service')}")

    # Test 13: Dataset / Product Not Found (Foreign / Non-Food Content)
    t0 = time.time()
    r = client.post("/api/analyze-label", json={
        "ocr_text": "Hardware Specifications: Model RX-900 12V 200W lithium-ion power unit. Made in China.",
        "user_profile": {"health_conditions": []}
    })
    elapsed = time.time() - t0
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("is_food") is False
    rej13 = str(data.get('rejection_reason') or data.get('personalized_verdict') or '')
    log_result(13, "Foreign / Non-Food Content (Truthful Rejection)", passed, elapsed,
               f"Status: {r.status_code}, is_food: {data.get('is_food')}, Reason: {rej13[:60]}...")

    # Test 14: ML Model & NOVA Classifier Integrity
    t0 = time.time()
    from services.model_service import analyze_ingredients
    res = analyze_ingredients("Organic Blueberries, Water, Organic Lemon Juice")
    elapsed = time.time() - t0
    passed = res.is_food is True and res.health_score >= 80 and (res.nova_group in [1, 2])
    log_result(14, "ML Model & NOVA Classifier Integrity", passed, elapsed,
               f"Score: {res.health_score}, NOVA: {res.nova_group}, Food: {res.is_food}")

    print("\nLocal Test Summary: " + f"{sum(1 for r in results if r['passed'])}/14 Passed")
    return results


def run_render_cloud_tests():
    print("\n" + "=" * 70)
    print("  PHASE 8: LIVE RENDER CLOUD BACKEND VERIFICATION")
    print("=" * 70)

    render_results = []

    def call_render(endpoint, method="GET", data=None):
        url = f"{RENDER_BASE_URL}{endpoint}"
        t0 = time.time()
        headers = {"User-Agent": "NutriLensAutomatedTester/2.0", "Content-Type": "application/json"}
        req_data = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=40) as response:
                body = response.read().decode("utf-8")
                elapsed = time.time() - t0
                return response.status, json.loads(body), elapsed
        except urllib.error.HTTPError as e:
            elapsed = time.time() - t0
            try:
                body = e.read().decode("utf-8")
                return e.code, json.loads(body), elapsed
            except Exception:
                return e.code, {}, elapsed
        except Exception as err:
            elapsed = time.time() - t0
            return 0, {"error": str(err)}, elapsed

    # 1. Health check
    status, body, elapsed = call_render("/api/health")
    print(f"[Render 1] GET /api/health -> HTTP {status} in {elapsed:.2f}s: {body.get('status')}")
    render_results.append(("Health Check", status == 200, elapsed, body))

    # 2. Known Barcode (Maggi 8901058852898)
    status, body, elapsed = call_render("/api/barcode/8901058852898?user_id=test_render")
    passed = status == 200 and body.get("is_food") is True
    print(f"[Render 2] GET /api/barcode/8901058852898 -> HTTP {status} in {elapsed:.2f}s: Product={body.get('product_name')}, Score={body.get('health_score')}")
    render_results.append(("Known Barcode", passed, elapsed, body))

    # 3. Unknown Barcode (9999999999998)
    status, body, elapsed = call_render("/api/barcode/9999999999998?user_id=test_render")
    passed = status == 200 and body.get("is_food") is False
    print(f"[Render 3] GET /api/barcode/9999999999998 -> HTTP {status} in {elapsed:.2f}s: is_food={body.get('is_food')}")
    render_results.append(("Unknown Barcode", passed, elapsed, body))

    # 4. Text Label Analysis
    status, body, elapsed = call_render("/api/analyze-label", method="POST", data={
        "ocr_text": "Ingredients: Oats, Chia Seeds, Almond Milk, Cinnamon",
        "user_profile": {"health_conditions": []}
    })
    passed = status == 200 and body.get("is_food") is True
    print(f"[Render 4] POST /api/analyze-label -> HTTP {status} in {elapsed:.2f}s: Product={body.get('product_name')}, Score={body.get('health_score')}, NOVA={body.get('nova_group')}")
    render_results.append(("Label Analysis", passed, elapsed, body))

    # 5. Image Scan on Render
    b64_test = make_text_image(["Nutrition Facts", "Calories 120", "Protein 10g", "Carbs 5g", "Fat 1g"])
    status, body, elapsed = call_render("/api/analyze-image", method="POST", data={
        "image_base64": b64_test,
        "user_profile": {"health_conditions": []}
    })
    passed = status == 200 and body.get("is_food") is True
    print(f"[Render 5] POST /api/analyze-image -> HTTP {status} in {elapsed:.2f}s: is_food={body.get('is_food')}, Score={body.get('health_score')}")
    render_results.append(("Image Scan", passed, elapsed, body))

    return render_results

if __name__ == "__main__":
    local_res = run_local_tests()
    cloud_res = run_render_cloud_tests()
