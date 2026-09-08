"""
NutriLens Local Machine Learning Model Inference Service.
Replaces external Gemini API with fast, offline-capable local ML models trained on nutrition datasets.
"""

import os
import re
import json
import base64
import joblib
import numpy as np
from io import BytesIO
from typing import Optional, List, Dict, Any

from models.schemas import (
    UserProfile,
    AnalyzeResponse,
    AdditiveDetail,
    NutritionBreakdown,
    AlternativeProduct
)
from ml.knowledge import (
    ADDITIVES_DATABASE,
    ALLERGEN_TAXONOMY,
    RISK_PATTERNS,
    BENEFICIAL_PATTERNS
)
from ml.dataset_loader import clean_ingredient_text

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "saved_models")

# In-memory cached model artifacts
_models: Dict[str, Any] = {
    "vectorizer": None,
    "nova_classifier": None,
    "health_regressor": None,
    "alternatives_index": None,
    "product_catalog": None,
    "is_loaded": False
}


def load_models(force_reload: bool = False):
    """Loads trained ML model weights and feature transformers into memory."""
    global _models
    if _models["is_loaded"] and not force_reload:
        return

    vec_path = os.path.join(MODELS_DIR, "vectorizer.joblib")
    nova_path = os.path.join(MODELS_DIR, "nova_classifier.joblib")
    health_path = os.path.join(MODELS_DIR, "health_score_regressor.joblib")
    alt_path = os.path.join(MODELS_DIR, "alternatives_index.joblib")
    catalog_path = os.path.join(MODELS_DIR, "product_catalog.joblib")

    if os.path.exists(vec_path) and os.path.exists(nova_path) and os.path.exists(health_path):
        try:
            _models["vectorizer"] = joblib.load(vec_path)
            _models["nova_classifier"] = joblib.load(nova_path)
            _models["health_regressor"] = joblib.load(health_path)
            if os.path.exists(alt_path):
                _models["alternatives_index"] = joblib.load(alt_path)
            if os.path.exists(catalog_path):
                _models["product_catalog"] = joblib.load(catalog_path)
            _models["is_loaded"] = True
            print("NutriLens ML models loaded into memory successfully.")
        except Exception as e:
            print(f"Warning: Failed to load trained models: {e}. Inference will use rule-based fallbacks.")
    else:
        print("Notice: Trained model artifacts not found in saved_models. Triggering initial training...")
        try:
            from ml.train import train_pipeline
            train_pipeline()
            load_models(force_reload=True)
        except Exception as e:
            print(f"Initial training attempt returned: {e}")


def reload_models():
    """Hot-reload models after a dataset retraining trigger."""
    load_models(force_reload=True)


# Ensure models are loaded when service starts
load_models()


def analyze_ingredients(ocr_text: str, user_profile: Optional[UserProfile] = None) -> AnalyzeResponse:
    """
    Analyzes food ingredients text using custom-trained ML models and local nutritional toxicological knowledge.
    Zero external API calls required.
    """
    profile = user_profile or UserProfile()
    cleaned_text = clean_ingredient_text(ocr_text)
    text_lower = ocr_text.lower()

    # 1. Run Machine Learning Models (NOVA classification & Health Score regression)
    pred_nova = 3
    pred_score = 70.0

    if _models["is_loaded"] and _models["vectorizer"] and cleaned_text:
        try:
            X_vec = _models["vectorizer"].transform([cleaned_text])
            if _models["nova_classifier"]:
                pred_nova = int(_models["nova_classifier"].predict(X_vec)[0])
            if _models["health_regressor"]:
                pred_score = float(_models["health_regressor"].predict(X_vec)[0])
        except Exception as e:
            print(f"ML inference error: {e}. Falling back to knowledge-based scoring.")

    # 2. Extract Additives & E-numbers
    detected_additives: List[AdditiveDetail] = []
    seen_additive_codes = set()

    # Search for E-codes (e.g. E621, E-102, e330)
    e_code_matches = re.findall(r'\b[Ee][-\s]?([0-9]{3,4}[a-z]?)\b', ocr_text)
    for code_num in e_code_matches:
        full_code = f"E{code_num.upper()}"
        if full_code in ADDITIVES_DATABASE and full_code not in seen_additive_codes:
            seen_additive_codes.add(full_code)
            info = ADDITIVES_DATABASE[full_code]
            detected_additives.append(AdditiveDetail(
                code=full_code,
                name=info["name"],
                risk_level=info["risk_level"],
                description=info["description"]
            ))

    # Search for additive chemical names
    for code, info in ADDITIVES_DATABASE.items():
        if code in seen_additive_codes:
            continue
        clean_name = info["name"].lower().split("(")[0].strip()
        if len(clean_name) > 3 and clean_name in text_lower:
            seen_additive_codes.add(code)
            detected_additives.append(AdditiveDetail(
                code=code,
                name=info["name"],
                risk_level=info["risk_level"],
                description=info["description"]
            ))

    # 3. Detect Allergens
    detected_allergens: List[str] = []
    allergen_conflicts: List[str] = []
    user_allergies_lower = [a.lower() for a in profile.allergies]

    for allergen, keywords in ALLERGEN_TAXONOMY.items():
        matched = False
        for kw in keywords:
            if re.search(rf'\b{re.escape(kw)}\b', text_lower):
                matched = True
                break
        if matched:
            detected_allergens.append(allergen)
            # Check conflict with user profile
            for ua in user_allergies_lower:
                if (allergen.lower() in ua or ua in allergen.lower() or
                    any(ua == kw or ua in kw or kw in ua for kw in keywords)):
                    if allergen not in allergen_conflicts:
                        allergen_conflicts.append(allergen)

    # 4. Detect Specific Risks & Benefits
    ingredient_risks: List[str] = []
    positive_attributes: List[str] = []

    for pattern, desc, delta in RISK_PATTERNS:
        if pattern in text_lower:
            ingredient_risks.append(desc)
            pred_score += delta

    for pattern, desc, delta in BENEFICIAL_PATTERNS:
        if pattern in text_lower:
            positive_attributes.append(desc)
            pred_score += delta

    # Additive risk score adjustments
    for add in detected_additives:
        if add.risk_level == "High":
            pred_score -= 12
            pred_nova = max(pred_nova, 4)
        elif add.risk_level == "Moderate":
            pred_score -= 6
            pred_nova = max(pred_nova, 3)

    # User health goals adjustments
    health_goals_lower = [g.lower() for g in profile.health_goals]
    if any(g in health_goals_lower for g in ["diabetic care", "low sugar", "weight loss"]):
        if any(s in text_lower for s in ["sugar", "corn syrup", "fructose", "maltodextrin", "dextrose"]):
            pred_score -= 10
            ingredient_risks.append("Contains fast-digesting sugars conflicting with your blood sugar / weight goals.")

    if any(g in health_goals_lower for g in ["heart health", "low sodium"]):
        if any(s in text_lower for s in ["sodium", "salt", "monosodium glutamate"]):
            pred_score -= 8

    # Severe allergen conflict penalty
    if allergen_conflicts:
        pred_score = min(pred_score, 35.0)

    final_health_score = int(max(5, min(99, round(pred_score))))
    final_nova = int(max(1, min(4, pred_nova)))

    # 5. Generate Personalized Verdict
    if allergen_conflicts:
        verdict = f"CRITICAL ALLERGEN ALERT: Contains {', '.join(allergen_conflicts)} which directly triggers your allergy profile! Avoid consumption."
    elif final_nova == 4 or final_health_score < 40:
        verdict = "Ultra-Processed Food: Contains multiple industrial additives or high glycemic markers. Recommended to consume rarely."
    elif final_health_score >= 80:
        verdict = "Excellent Clean Profile! Wholesome, natural whole-food ingredients that align with your healthy lifestyle."
    else:
        verdict = "Moderate Processing: Balanced nutritional makeup; consume as part of a varied whole-food diet."

    # 6. Suggest Healthier Alternatives using ML similarity
    alternatives = _find_healthier_alternatives(cleaned_text, final_nova, final_health_score)

    # 7. Estimate Nutrition Breakdown
    nutrition = _estimate_nutrition(cleaned_text, final_nova, final_health_score)

    # Extract or infer product name
    lines = [line.strip() for line in ocr_text.split("\n") if line.strip()]
    product_name = lines[0][:40] if lines else "Analyzed Food Product"

    return AnalyzeResponse(
        product_name=product_name,
        health_score=final_health_score,
        nova_group=final_nova,
        allergen_flags=detected_allergens,
        ingredient_risks=ingredient_risks,
        positive_attributes=positive_attributes,
        additives=detected_additives,
        nutrition_estimate=nutrition,
        healthier_alternatives=alternatives,
        personalized_verdict=verdict,
        ocr_text=ocr_text
    )


def _find_healthier_alternatives(cleaned_text: str, current_nova: int, current_score: int) -> List[AlternativeProduct]:
    """Finds higher-scoring, cleaner alternative items from the trained product catalog."""
    catalog = _models.get("product_catalog")
    knn = _models.get("alternatives_index")
    vectorizer = _models.get("vectorizer")

    alternatives: List[AlternativeProduct] = []

    if catalog and knn and vectorizer and cleaned_text:
        try:
            X_vec = vectorizer.transform([cleaned_text])
            num_neighbors = min(25, len(catalog))
            distances, indices = knn.kneighbors(X_vec, n_neighbors=num_neighbors)
            
            seen_names = set()
            for idx in indices[0]:
                item = catalog[idx]
                item_name = item.get("product_name", "")
                if item_name in seen_names:
                    continue

                item_score = int(item.get("health_score", 80))
                item_nova = int(item.get("nova_group", 2))
                
                # Pick candidates that are healthier or less processed
                if item_score > current_score or item_nova < current_nova:
                    seen_names.add(item_name)
                    proc_desc = "Clean, minimally processed" if item_nova <= 2 else "Wholesome"
                    reason_desc = f"{proc_desc} choice with clean ingredients and high nutritional density."
                    alternatives.append(AlternativeProduct(
                        name=item_name,
                        reason=reason_desc,
                        estimated_health_score=item_score
                    ))
                    if len(alternatives) >= 3:
                        break
        except Exception as e:
            print(f"Alternative recommendation error: {e}")

    # Fallback alternatives if dataset has no direct matches
    if not alternatives:
        alternatives = [
            AlternativeProduct(
                name="Organic Raw Almond & Pumpkin Seed Mix",
                reason="Unprocessed whole foods high in magnesium and clean plant protein.",
                estimated_health_score=94
            ),
            AlternativeProduct(
                name="Stevia-Sweetened Dark Cacao Snack",
                reason="Low glycemic impact with high flavanol antioxidants and zero artificial dyes.",
                estimated_health_score=88
            )
        ]

    return alternatives


def _estimate_nutrition(cleaned_text: str, nova: int, score: int) -> NutritionBreakdown:
    """Estimates approximate macronutrient distribution per serving."""
    # Attempt to extract explicit nutrient numbers if printed on label (e.g. "180 calories", "5g protein")
    cal_match = re.search(r'(\d+)\s*(?:kcal|calories)', cleaned_text)
    protein_match = re.search(r'(\d+(?:\.\d+)?)\s*g\s*protein', cleaned_text)
    carb_match = re.search(r'(\d+(?:\.\d+)?)\s*g\s*(?:carbs|carbohydrates)', cleaned_text)
    fat_match = re.search(r'(\d+(?:\.\d+)?)\s*g\s*fat', cleaned_text)
    sugar_match = re.search(r'(\d+(?:\.\d+)?)\s*g\s*sugar', cleaned_text)
    sodium_match = re.search(r'(\d+)\s*mg\s*sodium', cleaned_text)

    calories = float(cal_match.group(1)) if cal_match else (220.0 if nova >= 3 else 140.0)
    protein = float(protein_match.group(1)) if protein_match else (3.5 if nova >= 3 else 7.0)
    carbs = float(carb_match.group(1)) if carb_match else (28.0 if nova >= 3 else 14.0)
    fat = float(fat_match.group(1)) if fat_match else (10.0 if nova >= 3 else 4.0)
    sugar = float(sugar_match.group(1)) if sugar_match else (12.0 if nova == 4 else 2.0)
    sodium = float(sodium_match.group(1)) if sodium_match else (380.0 if nova >= 3 else 60.0)

    return NutritionBreakdown(
        calories=calories,
        protein_g=protein,
        carbs_g=carbs,
        fat_g=fat,
        sugar_g=sugar,
        sodium_mg=sodium
    )


def extract_text_from_image_base64(image_base64: str) -> str:
    """
    Extracts text from a base64 encoded image using high-speed local OCR.
    Uses native Windows.Media.Ocr (winocr) with fallbacks.
    """
    if not image_base64:
        return ""

    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]

    extracted_text = ""
    try:
        image_bytes = base64.b64decode(image_base64)
        from PIL import Image, ImageEnhance, ImageOps
        img = Image.open(BytesIO(image_bytes))

        # Convert to RGB if needed
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # 1. Primary OCR: Native Windows Media OCR (sub-100ms on Windows 10/11)
        try:
            import winocr
            import asyncio
            import concurrent.futures

            def _run_winocr(target_img):
                new_loop = asyncio.new_event_loop()
                try:
                    return new_loop.run_until_complete(winocr.recognize_pil(target_img, "en"))
                finally:
                    new_loop.close()

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                res = executor.submit(_run_winocr, img).result(timeout=8)
                if res and res.text:
                    extracted_text = res.text.strip()

            # If initial text is very short, try preprocessed contrast image
            if len(extracted_text) < 15:
                gray = ImageOps.grayscale(img)
                enhanced = ImageEnhance.Contrast(gray).enhance(1.8)
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    res2 = executor.submit(_run_winocr, enhanced).result(timeout=8)
                    if res2 and len(res2.text.strip()) > len(extracted_text):
                        extracted_text = res2.text.strip()

        except Exception as winocr_err:
            print(f"winocr engine notice: {winocr_err}")

        # 2. Fallback OCR: pytesseract if available
        if not extracted_text:
            try:
                import pytesseract
                extracted_text = pytesseract.image_to_string(img).strip()
            except Exception:
                pass

    except Exception as e:
        print(f"Error decoding and processing image for OCR: {e}")

    return extracted_text.strip()


def analyze_label_image(image_base64: str, user_profile: Optional[UserProfile] = None) -> AnalyzeResponse:
    """
    Analyzes an ingredient label image locally using on-device OCR and trained ML models.
    Decodes base64, extracts text via OCR, and parses ingredients.
    """
    profile = user_profile or UserProfile()
    extracted_text = extract_text_from_image_base64(image_base64)

    if not extracted_text:
        # Fallback informative notice if image was blank or unreadable
        extracted_text = "Ingredients: Unlabeled food product. No legible text detected in image."

    res = analyze_ingredients(extracted_text, profile)
    res.ocr_text = extracted_text
    return res
