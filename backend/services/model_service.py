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
from typing import Optional, List, Dict, Any, Tuple

from models.schemas import (
    UserProfile,
    AnalyzeResponse,
    AdditiveDetail,
    NutritionBreakdown,
    AlternativeProduct,
    PreferenceAudit,
    PersonalizedRecommendation
)
from services.barcode_service import extract_barcode_digits, lookup_barcode_online
from services.food_classifier import classify_food_item
from services.recommendation_service import generate_personalized_recommendation
import services.nutrition_service as nutrition_service
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

# Cached OCR engine (initialized once, reused across all requests for speed)
_rapidocr_engine = None


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


# Models are loaded either on app startup or lazily upon the first inference request


def _audit_user_preferences(
    text_lower: str,
    nutrition: NutritionBreakdown,
    detected_allergens: List[str],
    profile: UserProfile
) -> PreferenceAudit:
    """Performs deep personalized audit matching food item against user allergies, dietary preferences, and health goals."""
    allergen_conflicts: List[str] = []
    allergen_safe_notes: List[str] = []
    dietary_matches: List[str] = []
    dietary_conflicts: List[str] = []
    goal_alignments: List[str] = []
    goal_warnings: List[str] = []

    user_allergies_lower = [a.lower().strip() for a in profile.allergies if a.strip()]
    for ua in user_allergies_lower:
        matched = False
        for da in detected_allergens:
            if ua in da.lower() or da.lower() in ua:
                matched = True
                break
        if not matched:
            if re.search(rf'\b{re.escape(ua)}\b', text_lower):
                matched = True
        if matched:
            allergen_conflicts.append(ua.title())

    if profile.allergies:
        safe_allergies = [a.title() for a in profile.allergies if a.title() not in allergen_conflicts]
        if safe_allergies:
            allergen_safe_notes.append(f"Safe: Free from your allergens ({', '.join(safe_allergies)})")

    user_diet_lower = [d.lower().strip() for d in profile.dietary_preferences if d.strip()]

    # Vegan check
    if any("vegan" in d for d in user_diet_lower):
        dairy_matches = re.findall(r'\b(milk|whey|casein|cheese|cheddar|cream|yogurt|curd|ghee|lactose|gelatin|honey|egg|eggs|beef|pork|chicken|fish|tuna|salmon|shrimp|meat)\b', text_lower)
        if "butter" in text_lower and not re.search(r'\b(peanut|cocoa|almond|apple|shea|coconut)\s+butter\b', text_lower):
            dairy_matches.append("butter")
        if dairy_matches:
            unique_matches = sorted(list(set(dairy_matches)))
            dietary_conflicts.append(f"Non-Vegan: Contains animal/dairy ingredients ({', '.join(unique_matches)})")
        else:
            dietary_matches.append("100% Plant-Based / Vegan Suitable")

    # Vegetarian check
    if any("vegetarian" in d for d in user_diet_lower):
        meat_matches = re.findall(r'\b(beef|pork|chicken|fish|salmon|tuna|shrimp|gelatin|meat|lard)\b', text_lower)
        if meat_matches:
            dietary_conflicts.append(f"Non-Vegetarian: Contains animal derivatives ({', '.join(set(meat_matches))})")
        else:
            dietary_matches.append("Vegetarian Formulation")

    # Gluten-Free check
    if any("gluten" in d for d in user_diet_lower):
        gluten_matches = re.findall(r'\b(wheat|barley|rye|malt|gluten|semolina|spelt|kamut)\b', text_lower)
        if gluten_matches:
            dietary_conflicts.append(f"Contains Gluten: Found ({', '.join(set(gluten_matches))})")
        else:
            dietary_matches.append("Gluten-Free Ingredients")

    # Low Sugar / Diabetic-Friendly check
    if any("sugar" in d for d in user_diet_lower) or any("diabetic" in d for d in user_diet_lower):
        sugar_g = nutrition.sugar_g if nutrition and nutrition.sugar_g is not None else 0
        if sugar_g > 6.0 or any(s in text_lower for s in ["high fructose corn syrup", "maltodextrin", "dextrose"]):
            dietary_conflicts.append(f"High Sugar Warning: Contains approx {sugar_g}g sugar per serving, exceeding your Low Sugar target.")
        else:
            dietary_matches.append(f"Low Sugar Compliant: Only {sugar_g}g sugar per serving.")

    # Keto check
    if any("keto" in d for d in user_diet_lower):
        carbs_g = nutrition.carbs_g if nutrition and nutrition.carbs_g is not None else 0
        if carbs_g > 10.0:
            dietary_conflicts.append(f"Keto Conflict: High carb count ({carbs_g}g) will disrupt ketosis.")
        else:
            dietary_matches.append(f"Keto Compliant: Low net carbs ({carbs_g}g).")

    user_goals_lower = [g.lower().strip() for g in profile.health_goals if g.strip()]

    # Weight Loss
    if any("weight" in g for g in user_goals_lower):
        cal = nutrition.calories if nutrition and nutrition.calories is not None else 0
        if cal > 350:
            goal_warnings.append(f"Calorie Density: {cal} kcal per serving requires portion moderation for Weight Loss.")
        else:
            goal_alignments.append(f"Calorie Controlled: {cal} kcal per serving supports your Weight Loss deficit.")

    # Muscle Gain
    if any("muscle" in g for g in user_goals_lower):
        prot = nutrition.protein_g if nutrition and nutrition.protein_g is not None else 0
        if prot >= 10.0:
            goal_alignments.append(f"High Protein Yield: {prot}g protein directly fuels muscle recovery and growth.")
        else:
            goal_warnings.append(f"Low Protein Yield: Only {prot}g protein per serving.")

    # Heart Health / Low Sodium
    if any("heart" in g for g in user_goals_lower) or any("sodium" in g for g in user_goals_lower):
        sod = nutrition.sodium_mg if nutrition and nutrition.sodium_mg is not None else 0
        if sod > 400:
            goal_warnings.append(f"Elevated Sodium ({sod}mg): Limit intake to maintain optimal cardiovascular pressure.")
        else:
            goal_alignments.append(f"Cardiovascular Safe: Moderate sodium ({sod}mg) and clean lipid balance.")

    is_safe = (len(allergen_conflicts) == 0) and (len(dietary_conflicts) == 0)

    return PreferenceAudit(
        allergen_conflicts=allergen_conflicts,
        allergen_safe_notes=allergen_safe_notes,
        dietary_matches=dietary_matches,
        dietary_conflicts=dietary_conflicts,
        goal_alignments=goal_alignments,
        goal_warnings=goal_warnings,
        is_safe_for_user=is_safe
    )


def analyze_ingredients(ocr_text: str, user_profile: Optional[UserProfile] = None) -> AnalyzeResponse:
    """
    Analyzes scanned text or barcode against food datasets, toxicological knowledge base,
    and user personal dietary preferences/allergies.
    """
    if not _models.get("is_loaded"):
        load_models()
    profile = user_profile or UserProfile()

    # 0. Check for Barcode format or GTIN query
    barcode_digits = extract_barcode_digits(ocr_text)
    is_barcode_input = False
    if barcode_digits:
        pure_num = re.sub(r'[\s\-:]', '', ocr_text)
        if (
            "barcode" in ocr_text.lower()
            or "gtin" in ocr_text.lower()
            or pure_num == barcode_digits
            or len(ocr_text.strip().split()) <= 3
        ):
            is_barcode_input = True

    if is_barcode_input and barcode_digits:
        barcode_info = lookup_barcode_online(barcode_digits)
        if not barcode_info.get("found") or not barcode_info.get("is_food"):
            return AnalyzeResponse(
                is_food=False,
                rejection_reason=f"Barcode {barcode_digits} is not yet registered in the food database. Please switch to 'Food Label' mode to scan the ingredients label directly, or search by product name.",
                product_name=f"Packaged Item ({barcode_digits})",
                health_score=0,
                nova_group=None,
                personalized_verdict=f"Barcode {barcode_digits} not found in online database. Tip: Switch to 'Food Label' mode and take a photo of the ingredients list or nutrition table.",
                ocr_text=ocr_text,
                barcode=barcode_digits
            )
        else:
            # Barcode matched in food database!
            p_name = barcode_info["product_name"]
            ing_text = barcode_info.get("ingredients_text") or p_name
            nutri_dict = barcode_info.get("nutriments", {})
            real_nova = barcode_info.get("nova_group")
            real_score = barcode_info.get("health_score", 70)

            nutrition = NutritionBreakdown(
                calories=nutri_dict.get("calories"),
                protein_g=nutri_dict.get("protein_g"),
                carbs_g=nutri_dict.get("carbs_g"),
                fat_g=nutri_dict.get("fat_g"),
                sugar_g=nutri_dict.get("sugar_g"),
                sodium_mg=nutri_dict.get("sodium_mg"),
                is_estimated=False,
                source="OpenFoodFacts Global Database",
                serving_size=barcode_info.get("serving_size")
            )

            # Analyze ingredients of the matched product against user preferences
            cleaned_text = clean_ingredient_text(ing_text)
            text_lower = ing_text.lower()

            detected_additives: List[AdditiveDetail] = []
            seen_additive_codes = set()
            e_code_matches = re.findall(r'\b[Ee][-\s]?([0-9]{3,4}[a-z]?)\b', ing_text)
            for code_num in e_code_matches:
                full_code = f"E{code_num.upper()}"
                if full_code in ADDITIVES_DATABASE and full_code not in seen_additive_codes:
                    seen_additive_codes.add(full_code)
                    info = ADDITIVES_DATABASE[full_code]
                    detected_additives.append(AdditiveDetail(code=full_code, name=info["name"], risk_level=info["risk_level"], description=info["description"]))

            detected_allergens: List[str] = []
            for allergen, keywords in ALLERGEN_TAXONOMY.items():
                if any(re.search(rf'\b{re.escape(kw)}\b', text_lower) for kw in keywords):
                    detected_allergens.append(allergen)

            is_demo_user = bool(profile and profile.user_id in DEMO_USER_IDS)
            alternatives = _find_healthier_alternatives(
                cleaned_text,
                real_nova or 3,
                real_score,
                product_name=p_name,
                nutrition=nutrition,
                is_demo=is_demo_user
            )

            # Build personalized audit and verdict
            audit = _audit_user_preferences(text_lower, nutrition, detected_allergens, profile)
            verdict_parts = []
            if audit.allergen_conflicts:
                verdict_parts.append(f"CRITICAL ALLERGEN ALERT: Contains {', '.join(audit.allergen_conflicts)} which directly conflicts with your allergies! Avoid consumption.")
            elif audit.dietary_conflicts:
                verdict_parts.append(f"Dietary Notice: {audit.dietary_conflicts[0]}")
            else:
                if real_score >= 80:
                    verdict_parts.append("Excellent Clean Profile: Aligns perfectly with your personal dietary preferences and wellness goals.")
                elif real_score >= 50:
                    verdict_parts.append("Moderate Product: Balanced nutritional makeup; consume as part of a varied healthy diet.")
                else:
                    verdict_parts.append("Ultra-Processed / High Glycemic: Industrial formulation; recommended to consume in moderation.")

            if audit.goal_alignments:
                verdict_parts.append(audit.goal_alignments[0])
            elif audit.goal_warnings:
                verdict_parts.append(audit.goal_warnings[0])

            completeness, missing = nutrition_service.assess_data_completeness({
                "calories": nutrition.calories,
                "protein_g": nutrition.protein_g,
                "fat_g": nutrition.fat_g,
                "carbs_g": nutrition.carbs_g,
                "sugar_g": nutrition.sugar_g,
                "fiber_g": nutrition.fiber_g,
                "sodium_mg": nutrition.sodium_mg
            })

            personalized_rec = generate_personalized_recommendation(
                product_name=p_name,
                ocr_text=ing_text,
                nutrition=nutrition,
                detected_allergens=detected_allergens,
                ingredient_risks=["Contains high sugar or additives."] if real_score < 50 else [],
                user_profile=profile,
                data_sources=["Open Food Facts", "USDA FoodData Central"],
                data_completeness=completeness,
                missing_nutrients=missing
            )

            # Harmonize health score with personalized safety verdict for user health conditions
            if personalized_rec.status == "Not Recommended":
                real_score = min(real_score, 28)
            elif personalized_rec.status.startswith("Limit"):
                real_score = min(real_score, 50)

            brand_name = barcode_info.get("brand") or barcode_info.get("brands")
            category_name = barcode_info.get("category") or barcode_info.get("categories")
            img_url = barcode_info.get("image_url")

            return AnalyzeResponse(
                is_food=True,
                product_name=p_name,
                brand=brand_name,
                category=category_name,
                image_url=img_url,
                health_score=real_score,
                nova_group=real_nova,
                allergen_flags=detected_allergens,
                ingredient_risks=["Contains high sugar or additives."] if real_score < 50 else [],
                positive_attributes=["Verified Food Product from Global Database"],
                additives=detected_additives,
                nutrition_estimate=nutrition,
                healthier_alternatives=alternatives,
                personalized_verdict=" ".join(verdict_parts),
                personalized_recommendation=personalized_rec,
                data_completeness=completeness,
                missing_nutrients=missing,
                data_sources=["Open Food Facts", "USDA FoodData Central"],
                last_verified="February 2026",
                allergens_safety_note="Always verify allergen and ingredient information on the physical product packaging, especially if you have a severe food allergy.",
                ocr_text=ocr_text,
                barcode=barcode_digits,
                preference_audit=audit
            )

    # 1. Non-Food & Foreign Object Classification
    is_food, food_reason, stats = classify_food_item(ocr_text)
    if not is_food:
        # Check if matched in product catalog or nutrition facts table exists
        catalog_match_check = _find_catalog_match(ocr_text)
        nutrition_check = parse_nutrition_facts(ocr_text)
        if catalog_match_check or nutrition_check.get("parsed_count", 0) >= 1:
            is_food = True
        else:
            return AnalyzeResponse(
                is_food=False,
                rejection_reason=food_reason,
                product_name="Non-Food / Foreign Object",
                health_score=0,
                nova_group=None,
                personalized_verdict=f"⚠️ Non-Food Detected: {food_reason} NutriLens only evaluates edible food items, packaged snacks, beverages, and ingredient labels.",
                ocr_text=ocr_text
            )

    # 2. Food Confirmed: Run ML inference and Nutritional Audit
    cleaned_text = clean_ingredient_text(ocr_text)
    text_lower = ocr_text.lower()

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

    # 3. Extract Additives & E-numbers
    detected_additives: List[AdditiveDetail] = []
    seen_additive_codes = set()

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

    # 4. Detect Allergens
    detected_allergens: List[str] = []
    for allergen, keywords in ALLERGEN_TAXONOMY.items():
        if any(re.search(rf'\b{re.escape(kw)}\b', text_lower) for kw in keywords):
            detected_allergens.append(allergen)

    # 5. Detect Specific Risks & Benefits
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

    for add in detected_additives:
        if add.risk_level == "High":
            pred_score -= 12
            pred_nova = max(pred_nova, 4)
        elif add.risk_level == "Moderate":
            pred_score -= 6
            pred_nova = max(pred_nova, 3)

    catalog_match = _find_catalog_match(ocr_text)
    if catalog_match and catalog_match.get("health_score"):
        final_health_score = int(catalog_match["health_score"])
    else:
        final_health_score = int(max(5, min(99, round(pred_score))))

    if catalog_match and catalog_match.get("nova_group"):
        final_nova = int(catalog_match["nova_group"])
    else:
        final_nova = int(max(1, min(4, pred_nova)))

    # 6. Extract Genuine Nutrition Breakdown from Scanned Label or Verified FMCG Database
    nutrition = _estimate_nutrition(ocr_text, cleaned_text, final_nova, final_health_score, catalog_match=catalog_match)
    product_name = _extract_smart_product_name(ocr_text, catalog_match)
    brand_name = catalog_match.get("brand") if catalog_match else None
    category_name = catalog_match.get("category") if catalog_match else None
    data_source = "NutriLens Verified FMCG Catalog" if (catalog_match and not nutrition.is_estimated) else "Scanned Product Label"
    data_completeness, missing_nutrients = nutrition_service.assess_data_completeness({
        "calories": nutrition.calories,
        "protein_g": nutrition.protein_g,
        "fat_g": nutrition.fat_g,
        "carbs_g": nutrition.carbs_g,
        "sugar_g": nutrition.sugar_g,
        "fiber_g": nutrition.fiber_g,
        "sodium_mg": nutrition.sodium_mg
    })

    # 7. Run Personalized User Preference Audit
    audit = _audit_user_preferences(text_lower, nutrition, detected_allergens, profile)
    if audit.allergen_conflicts:
        final_health_score = min(final_health_score, 35)

    # 8. Compose Verdict Tailored to User Preferences
    verdict_parts = []
    if audit.allergen_conflicts:
        verdict_parts.append(f"CRITICAL ALLERGEN ALERT: Contains {', '.join(audit.allergen_conflicts)} which directly triggers your saved allergy profile! Avoid consumption.")
    elif audit.dietary_conflicts:
        verdict_parts.append(f"Dietary Notice: {audit.dietary_conflicts[0]}")
    else:
        if final_health_score >= 80:
            verdict_parts.append("Excellent Clean Profile! Wholesome, natural whole-food ingredients that align with your healthy lifestyle.")
        elif final_health_score >= 50:
            verdict_parts.append("Moderate Processing: Balanced nutritional makeup; consume as part of a varied whole-food diet.")
        else:
            verdict_parts.append("Ultra-Processed Food: Contains multiple industrial additives or high glycemic markers. Recommended to consume rarely.")

    if audit.goal_alignments:
        verdict_parts.append(audit.goal_alignments[0])
    elif audit.goal_warnings:
        verdict_parts.append(audit.goal_warnings[0])

    is_demo_user = bool(profile and profile.user_id in DEMO_USER_IDS)
    alternatives = _find_healthier_alternatives(
        cleaned_text,
        final_nova,
        final_health_score,
        product_name=product_name,
        nutrition=nutrition,
        is_demo=is_demo_user
    )

    personalized_rec = generate_personalized_recommendation(
        product_name=product_name,
        ocr_text=ocr_text,
        nutrition=nutrition,
        detected_allergens=detected_allergens,
        ingredient_risks=ingredient_risks,
        user_profile=profile,
        data_sources=[data_source],
        data_completeness=data_completeness,
        missing_nutrients=missing_nutrients
    )

    # Harmonize health score with personalized safety verdict:
    # If the product is clinically unsuitable / Not Recommended for the user's specific health profile
    # (Diabetes, Kidney conditions, Heart disease, Allergies), its score MUST reflect that it is not recommended to eat!
    if personalized_rec.status == "Not Recommended":
        final_health_score = min(final_health_score, 28)
    elif personalized_rec.status.startswith("Limit"):
        final_health_score = min(final_health_score, 50)

    return AnalyzeResponse(
        is_food=True,
        product_name=product_name,
        brand=brand_name,
        category=category_name,
        health_score=final_health_score,
        nova_group=final_nova,
        allergen_flags=detected_allergens,
        ingredient_risks=ingredient_risks,
        positive_attributes=positive_attributes,
        additives=detected_additives,
        nutrition_estimate=nutrition,
        healthier_alternatives=alternatives,
        personalized_verdict=" ".join(verdict_parts),
        personalized_recommendation=personalized_rec,
        data_completeness=data_completeness,
        missing_nutrients=missing_nutrients,
        data_sources=[data_source],
        last_verified="February 2026",
        allergens_safety_note="Always verify allergen and ingredient information on the physical product packaging, especially if you have a severe food allergy.",
        ocr_text=ocr_text,
        preference_audit=audit
    )


KNOWN_FOOD_BRANDS = [
    ("coca[- ]?cola|cocacola", "Coca-Cola"),
    ("pepsi", "Pepsi"),
    ("thums up", "Thums Up"),
    ("sprite", "Sprite"),
    ("fanta", "Fanta"),
    ("7up", "7Up"),
    ("mountain dew", "Mountain Dew"),
    ("red bull", "Red Bull"),
    ("maggi.*?noodles|maggi", "Maggi 2-Minute Noodles"),
    ("lay'?s.*?chips|lay'?s|lays", "Lay's Potato Chips"),
    ("doritos", "Doritos Tortilla Chips"),
    ("pringles", "Pringles Potato Crisps"),
    ("kurkure", "Kurkure Masala Munch"),
    ("nutella", "Nutella Hazelnut Spread"),
    ("oreo", "Oreo Biscuits"),
    ("kitkat|kit kat", "Nestle KitKat"),
    ("cadbury.*?dairy milk|dairy milk", "Cadbury Dairy Milk"),
    ("snickers", "Snickers Chocolate Bar"),
    ("parle[- ]?g|parleg", "Parle-G Gluco Biscuits"),
    ("good day", "Britannia Good Day Cookies"),
    ("marie gold", "Britannia Marie Gold Biscuits"),
    ("britannia", "Britannia Biscuits"),
    ("amul.*?butter", "Amul Butter"),
    ("amul", "Amul Dairy"),
    ("haldiram", "Haldiram's Namkeen"),
    ("kellogg'?s.*?corn flakes|corn flakes", "Kellogg's Corn Flakes"),
    ("quaker.*?oats|rolled oats", "Quaker Rolled Oats"),
    ("tropicana", "Tropicana Juice"),
    ("real fruit", "Real Fruit Power Juice"),
    ("bournvita", "Cadbury Bournvita"),
    ("horlicks", "Horlicks Nutrition Drink"),
    ("peanut butter", "Peanut Butter"),
    ("dark chocolate", "Dark Chocolate"),
    ("oat.*?crunch.*?cookies|oat.*?cookies", "Oat Crunch Cookies"),
    ("granola bar", "Granola Bar"),
    ("protein bar", "Protein Bar")
]


def _find_catalog_match(text: str) -> Optional[Dict[str, Any]]:
    """
    Finds verified product name match from the food dataset catalog or SQLite database.
    Only checks title lines (before ingredient list) to prevent matching single ingredient words like 'salt'.
    """
    if not text:
        return None

    lines = [l.strip().lower() for l in re.split(r'[\r\n]+', text) if l.strip()]
    
    # Nutrition lines that belong to nutrition facts panel and must never be treated as product titles
    NUTRITION_LINE_PATTERNS = [
        "calories", "% daily", "daily value", "serving", "total fat", "saturated fat",
        "trans fat", "cholesterol", "sodium", "potassium", "total carb", "carbohydrate",
        "dietary fiber", "sugars", "protein", "vitamin", "thiamin", "riboflavin",
        "niacin", "folate", "calcium", "iron", "phosphorus", "per 100", "amount per", "fat "
    ]
    GENERIC_EXCLUDE_WORDS = {
        "amine", "water", "oil", "fat", "powder", "extract", "acid", "salt",
        "sugar", "cream", "white", "black", "pure", "table", "total", "flavor", "flavour"
    }

    title_lines = []
    for l in lines:
        if any(w in l for w in ['ingredients', 'nutrition facts', 'typical values', 'contains', 'nutrition information']):
            break
        if any(np in l for np in NUTRITION_LINE_PATTERNS) or re.search(r'\b\d+\s*%\b', l):
            continue
        title_lines.append(l)

    # 1. Check in-memory product catalog
    catalog = _models.get("product_catalog")
    if catalog and title_lines:
        best_item = None
        best_len = 0
        for item in catalog:
            name = (item.get("food_name") or item.get("product_name") or "").lower().strip()
            if len(name) < 3 or name in GENERIC_EXCLUDE_WORDS:
                continue
            for tl in title_lines:
                is_match = (
                    name == tl
                    or (len(name) >= 5 and re.search(r'\b' + re.escape(name) + r'\b', tl))
                    or (len(tl) >= 5 and re.search(r'\b' + re.escape(tl) + r'\b', name))
                )
                if is_match:
                    if len(name) > best_len:
                        best_item = item
                        best_len = len(name)
        if best_item:
            return best_item

    # 2. Check SQLite food_catalog in nutrilens.db (40,000+ items + FMCG verified foods)
    try:
        import sqlite3
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "nutrilens.db")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # First priority: check if any iconic brand pattern matches in entire text
            text_lower = text.lower()
            
            BRAND_MAP = [
                (r"good day.*?butter|good day", "Britannia Good Day Butter Cookies"),
                (r"good day.*?cashew", "Britannia Good Day Cashew Cookies"),
                (r"good day.*?pista", "Britannia Good Day Pista Badam Cookies"),
                (r"bourbon", "Britannia Bourbon Chocolate Cream Biscuits"),
                (r"marie gold|marie", "Britannia Marie Gold Biscuits"),
                (r"parle[- ]?g|parleg", "Parle-G Original Gluco Biscuits"),
                (r"monaco", "Parle Monaco Salted Crackers"),
                (r"krackjack", "Parle Krackjack Crackers"),
                (r"hide.*?seek", "Parle Hide & Seek Chocolate Chip Cookies"),
                (r"maggi.*?masala|maggi", "Maggi 2-Minute Masala Noodles"),
                (r"kitkat|kit kat", "Nestlé KitKat 4-Finger Wafer Bar"),
                (r"lay'?s.*?magic masala", "Lay's India's Magic Masala Potato Chips"),
                (r"lay'?s.*?cream|lay'?s.*?onion", "Lay's American Style Cream & Onion Potato Chips"),
                (r"lay'?s.*?classic|lay'?s.*?salted|lay'?s|lays", "Lay's Classic Salted Potato Chips"),
                (r"doritos.*?nacho|doritos", "Doritos Nacho Cheese Flavored Tortilla Chips"),
                (r"pringles.*?sour cream|pringles", "Pringles Original Potato Crisps"),
                (r"kurkure", "Kurkure Masala Munch"),
                (r"aloo bhujia", "Haldiram's Nagpur Aloo Bhujia"),
                (r"bhujia sev|bhujia", "Haldiram's Bhujia Sev"),
                (r"dairy milk.*?silk", "Cadbury Dairy Milk Silk Chocolate"),
                (r"dairy milk", "Cadbury Dairy Milk Chocolate"),
                (r"5 star|five star", "Cadbury 5 Star Chocolate Bar"),
                (r"perk", "Cadbury Perk Wafer Chocolate"),
                (r"munch", "Nestle Munch Wafer Chocolate"),
                (r"snickers", "Snickers Chocolate Bar"),
                (r"oreo", "Oreo Original Vanilla Creme Cookies"),
                (r"nutella", "Nutella Hazelnut Cocoa Spread"),
                (r"amul.*?butter", "Amul Pasteurized Salted Butter"),
                (r"amul.*?ghee", "Amul Pure Cow Ghee"),
                (r"amul.*?cheese", "Amul Processed Cheese Blocks / Slices"),
                (r"amul.*?milk|amul.*?taaza|taaza", "Amul Taaza Homogenised Toned Milk"),
                (r"dark fantasy", "Sunfeast Dark Fantasy Choco Fills Cookies"),
                (r"coca[- ]?cola|coke", "Coca-Cola Original Taste"),
                (r"thums up|thumsup", "Thums Up Charged Cola"),
                (r"sprite", "Sprite Lemon-Lime Carbonated Drink"),
                (r"fanta", "Fanta Orange Carbonated Drink"),
                (r"7up|seven up", "7Up Lemon Lime Drink"),
                (r"pepsi", "Pepsi Cola"),
                (r"frooti", "Frooti Real Mango Drink"),
                (r"maaza", "Maaza Mango Drink"),
                (r"paper boat|paperboat", "Paper Boat Aamras Mango Drink"),
                (r"red bull", "Red Bull Energy Drink"),
                (r"monster energy|monster", "Monster Energy Drink Original"),
                (r"quaker.*?oats|rolled oats", "Quaker Rolled Oats Whole Grain"),
                (r"corn flakes", "Kellogg's Corn Flakes Original"),
                (r"chocos", "Kellogg's Chocos Chocolate Cereal"),
                (r"aashirvaad|atta", "Aashirvaad Shudh Chakki Atta"),
                (r"tata salt", "Tata Salt Vacuum Evaporated Iodized Salt"),
                (r"chobani", "Chobani Greek Yogurt Plain Non-Fat 150G"),
                (r"peanut butter", "Pintola All Natural Peanut Butter"),
                (r"whey protein", "Optimum Nutrition Gold Standard 100% Whey")
            ]

            full_cols = """
                SELECT food_name, brand, category, nova_group, health_score,
                       calories, protein_g, fat_g, carbs_g, sugar_g, fiber_g, sodium_mg, ingredients_text
                FROM food_catalog
            """

            for pattern, canonical_name in BRAND_MAP:
                if re.search(pattern, text_lower):
                    cur.execute(f"{full_cols} WHERE food_name = ? LIMIT 1", (canonical_name,))
                    row = cur.fetchone()
                    if row:
                        conn.close()
                        return {
                            "food_name": row[0],
                            "brand": row[1],
                            "category": row[2],
                            "nova_group": int(row[3]) if row[3] is not None else 3,
                            "health_score": int(row[4]) if row[4] is not None else 70,
                            "calories": float(row[5]) if row[5] is not None else None,
                            "protein_g": float(row[6]) if row[6] is not None else None,
                            "fat_g": float(row[7]) if row[7] is not None else None,
                            "carbs_g": float(row[8]) if row[8] is not None else None,
                            "sugar_g": float(row[9]) if row[9] is not None else None,
                            "fiber_g": float(row[10]) if row[10] is not None else None,
                            "sodium_mg": float(row[11]) if row[11] is not None else None,
                            "ingredients_text": row[12] if row[12] else None
                        }

            candidate_terms = []
            for pattern, clean_title in KNOWN_FOOD_BRANDS:
                if re.search(r'\b' + pattern + r'\b', text_lower) or re.search(pattern, text_lower):
                    candidate_terms.append(clean_title)

            # Second priority: title lines extracted from top of package
            macro_skip = {"total", "fat", "sugar", "salt", "oil", "water", "protein", "energy", "calories", "nutrition", "carbs", "carbohydrate", "sodium", "fiber", "fibre"}
            for tl in title_lines:
                clean_tl = re.sub(r'\b\d+\s*(g|gm|gms|kg|ml|l|oz|lb|pcs|pack)\b', '', tl, flags=re.I)
                clean_tl = re.sub(r'^[^\w]+|[^\w]+$', '', clean_tl).strip()
                if len(clean_tl) >= 4 and len(clean_tl) <= 50 and clean_tl.lower() not in macro_skip and clean_tl not in candidate_terms:
                    candidate_terms.append(clean_tl)

            sql = """
                SELECT food_name, brand, category, nova_group, health_score,
                       calories, protein_g, fat_g, carbs_g, sugar_g, fiber_g, sodium_mg, ingredients_text
                FROM food_catalog
                WHERE food_name LIKE ? OR brand LIKE ?
                ORDER BY CASE WHEN food_name LIKE ? THEN 1 ELSE 2 END
                LIMIT 1
            """

            for term in candidate_terms:
                term_clean = term.strip().lower()
                if term_clean in GENERIC_EXCLUDE_WORDS or len(term_clean) < 4:
                    continue
                cur.execute(sql, (f"%{term}%", f"%{term}%", f"%{term}%"))
                row = cur.fetchone()
                if row:
                    matched_name = (row[0] or "").lower()
                    if matched_name in GENERIC_EXCLUDE_WORDS:
                        continue
                    conn.close()
                    return {
                        "food_name": row[0],
                        "brand": row[1],
                        "category": row[2],
                        "nova_group": int(row[3]) if row[3] is not None else 3,
                        "health_score": int(row[4]) if row[4] is not None else 70,
                        "calories": float(row[5]) if row[5] is not None else None,
                        "protein_g": float(row[6]) if row[6] is not None else None,
                        "fat_g": float(row[7]) if row[7] is not None else None,
                        "carbs_g": float(row[8]) if row[8] is not None else None,
                        "sugar_g": float(row[9]) if row[9] is not None else None,
                        "fiber_g": float(row[10]) if row[10] is not None else None,
                        "sodium_mg": float(row[11]) if row[11] is not None else None,
                        "ingredients_text": row[12] if row[12] else None
                    }

            conn.close()
    except Exception as err:
        print(f"Catalog match error: {err}")

    return None


def _extract_smart_product_name(ocr_text: str, catalog_match: Optional[Dict[str, Any]] = None) -> str:
    """Extracts a clean, intelligent, and well-organized product name from OCR text lines."""
    if catalog_match:
        name = catalog_match.get("food_name") or catalog_match.get("product_name")
        if name and len(name.strip()) >= 3:
            return name.strip().title()

    if not ocr_text or not ocr_text.strip():
        return "Scanned Food Product"

    text_lower = ocr_text.lower()

    # 1. Match against known iconic food brands / products
    for pattern, clean_title in KNOWN_FOOD_BRANDS:
        if re.search(r'\b' + pattern + r'\b', text_lower) or re.search(pattern, text_lower):
            if "nacho cheese" in text_lower:
                return "Doritos Nacho Cheese"
            if "cream & onion" in text_lower or "cream and onion" in text_lower:
                return "Lay's American Style Cream & Onion"
            if "classic salted" in text_lower or ("classic" in text_lower and "lay" in text_lower):
                return "Lay's Classic Salted Chips"
            if "zero sugar" in text_lower or ("diet" in text_lower and "coca" in text_lower):
                return "Coca-Cola Zero Sugar"
            return clean_title

    # 2. Extract best title line from multi-line text
    lines = [l.strip() for l in re.split(r'[\r\n]+', ocr_text) if l.strip()]

    ignore_prefixes = (
        "ingredient", "nutrition", "fact", "keep", "store", "best", "exp", "mfg",
        "net", "serving", "calories", "calorie", "distributed", "contains", "manufactured",
        "batch", "lot", "fssai", "mrp", "per 100", "directions", "allergen", "weight", "wt",
        "total fat", "saturated fat", "trans fat", "cholesterol", "sodium", "total carb",
        "carbohydrate", "protein", "sugars", "dietary fiber", "energy", "kj", "total",
        "sugar", "fat", "carb", "carbs", "salt", "fibre", "fiber", "vitamin", "calcium", "iron",
        "daily", "daily value", "amount", "per", "potassium", "phosphorus", "thiamin", "niacin",
        "folate", "riboflavin", "rat", "jurum"
    )

    is_nutrition_table = any("nutrition" in l.lower() or "calories" in l.lower() or "typical values" in l.lower() or "daily value" in l.lower() for l in lines)
    is_ingredient_list = any("ingredient" in l.lower() or "contains" in l.lower() for l in lines)

    clean_candidate = ""
    for line in lines:
        cleaned = re.sub(r'^[^\w]+', '', line)
        cleaned = re.sub(r'\b(net\s*wt|serving|calories|exp|mfg|batch|mrp)\b.*$', '', cleaned, flags=re.I).strip()
        first_word = cleaned.split()[0].lower() if cleaned.split() else ""
        line_lower = cleaned.lower()
        if any(line_lower.startswith(p) or first_word.startswith(p) for p in ignore_prefixes):
            continue
        # Also ignore lines that contain percentages or nutrient units (e.g. "140 kcal", "4.5g", "% Daily Valuet")
        if re.search(r'\b\d+\s*(?:g|mg|kcal|cal|kj|%)\b', line_lower) or "%" in line_lower or "daily" in line_lower:
            continue
        cleaned = re.sub(r'[\d\.,;:\-]+$', '', cleaned).strip()
        if 3 <= len(cleaned) <= 60:
            clean_candidate = cleaned
            break

    if clean_candidate:
        # Separate camelCase words: e.g. OATCRUNCHCOOKIES -> Oat Crunch Cookies
        clean_candidate = re.sub(r'([a-z])([A-Z])', r'\1 \2', clean_candidate)
        clean_candidate = re.sub(r'(\b\w+\b)\s+Product\b', r'\1', clean_candidate, flags=re.I).strip()
        return clean_candidate.title()

    # 3. Fallback: clean the first line
    first_line = lines[0] if lines else ocr_text
    clean = re.sub(r'^(ingredients|contents|contains|nutrition facts)\s*[:\-]?\s*', '', first_line, flags=re.I).strip()
    clean = re.sub(r'\b(serving|calories|net\s*wt|exp|mfg).*$', '', clean, flags=re.I).strip()
    primary = [p.strip() for p in re.split(r'[,;.]', clean) if p.strip()]
    if primary and len(primary[0]) >= 3:
        clean_res = primary[0][:45].strip()
        macro_words = {"water", "sugar", "salt", "refined wheat flour", "wheat flour", "flour", "palm oil", "edible vegetable oil", "milk solids", "vegetable oil", "oil", "yeast", "cocoa solids", "milk", "total", "total fat", "saturated fat", "trans fat", "energy", "protein", "carbohydrates", "carbs", "sugars", "sodium", "nutrition", "calories"}
        clean_lower = clean_res.lower()
        if clean_lower not in macro_words and not any(clean_lower.startswith(m) for m in ["total", "energy", "protein", "sodium", "sugar", "fat", "carb", "calories", "per 100"]):
            return clean_res.title()

    if is_nutrition_table:
        return "Packaged Food (Nutrition Label)"
    if is_ingredient_list:
        return "Packaged Food (Ingredients Label)"

    return "Scanned Food Product"


DEMO_USER_IDS = {"default_user", "demo_user", "user_diabetes", "user_hypertension", "user_clean"}

def _find_healthier_alternatives(
    cleaned_text: str,
    current_nova: int,
    current_score: int,
    product_name: str = "",
    nutrition: Optional[Any] = None,
    is_demo: bool = False
) -> List[AlternativeProduct]:
    """
    Finds higher-scoring, cleaner alternative items.
    For DEMO users: preserves the existing sample experience and catalog fallbacks.
    For REAL users: generates category-relevant, clinically sound whole-food swaps based on
    actual product identification, calories, sugar, sodium, and processing level.
    """
    # DEMO MODE: Keep existing demo behavior and fallbacks completely untouched
    if is_demo:
        catalog = _models.get("product_catalog")
        knn = _models.get("alternatives_index")
        vectorizer = _models.get("vectorizer")
        demo_alts: List[AlternativeProduct] = []

        if catalog and knn and vectorizer and cleaned_text:
            try:
                X_vec = vectorizer.transform([cleaned_text])
                num_neighbors = min(25, len(catalog))
                distances, indices = knn.kneighbors(X_vec, n_neighbors=num_neighbors)
                seen_names = set()
                for idx in indices[0]:
                    item = catalog[idx]
                    item_name = (item.get("food_name") or item.get("product_name") or "").strip()
                    if not item_name or item_name in seen_names:
                        continue
                    item_score = int(item.get("health_score", 80))
                    item_nova = int(item.get("nova_group", 2))
                    if item_score > current_score or item_nova < current_nova:
                        seen_names.add(item_name)
                        proc_desc = "Clean, minimally processed" if item_nova <= 2 else "Wholesome"
                        demo_alts.append(AlternativeProduct(
                            name=item_name,
                            reason=f"{proc_desc} choice with clean ingredients and high nutritional density.",
                            estimated_health_score=item_score
                        ))
                        if len(demo_alts) >= 2:
                            break
            except Exception:
                pass

        if not demo_alts:
            demo_alts = [
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
        return demo_alts

    # REAL USER MODE: Genuinely tailored food swap recommendations
    # 1. If scanned food is already a high-scoring clean whole food (score >= 85 and NOVA <= 2):
    if current_score >= 85 and current_nova <= 2:
        return [
            AlternativeProduct(
                name=product_name or "Current Clean Choice",
                reason="This food already has a clean nutritional profile and minimal industrial processing. No swap necessary.",
                estimated_health_score=current_score
            )
        ]

    # 2. Category and nutrient-aware intelligent whole food matching
    text_lower = f"{product_name} {cleaned_text}".lower()

    # Category A: Chips / Salty Crisps / Packaged Fried Snacks / Namkeen
    if any(k in text_lower for k in ["chip", "chips", "crisp", "crisps", "puff", "puffs", "salted", "nachos", "fries", "namkeen", "sev", "bhujia"]):
        return [
            AlternativeProduct(
                name="Air-Popped Olive Oil & Sea Salt Popcorn",
                reason="Whole-grain snack with 65% less sodium and zero refined palm oil.",
                estimated_health_score=90
            ),
            AlternativeProduct(
                name="Roasted Organic Spiced Chickpeas",
                reason="High prebiotic fiber (6g) and plant protein (7g) with low glycemic load.",
                estimated_health_score=94
            )
        ]

    # Category B: Sodas / Colas / Sugary Drinks / Fruit Punch / Sweetened Beverages
    if any(k in text_lower for k in ["cola", "soda", "drink", "juice", "beverage", "syrup", "squash", "punch", "energy drink", "soft drink"]):
        return [
            AlternativeProduct(
                name="Sparkling Water Infused with Fresh Lemon & Mint",
                reason="Zero added sugars or high-fructose corn syrup; prevents insulin spikes.",
                estimated_health_score=98
            ),
            AlternativeProduct(
                name="Unsweetened Cold-Brew Hibiscus & Green Tea",
                reason="Rich in clean EGCG antioxidants with 0g sugar and natural cellular hydration.",
                estimated_health_score=96
            )
        ]

    # Category C: Cookies / Biscuits / Sweet Bakery / Chocolates / Candies
    if any(k in text_lower for k in ["cookie", "cookies", "biscuit", "biscuits", "cake", "sweet", "chocolate", "wafer", "candy", "pastry", "donut", "doughnut"]):
        return [
            AlternativeProduct(
                name="Raw Organic Walnut & Date Energy Bites",
                reason="Naturally sweetened with whole fruit fiber; zero bleached flour or artificial emulsifiers.",
                estimated_health_score=92
            ),
            AlternativeProduct(
                name="85% Extra Dark Single-Origin Cacao with Almonds",
                reason="Under 4g sugar per serving, delivering bioavailable magnesium and heart-healthy polyphenols.",
                estimated_health_score=89
            )
        ]

    # Category D: Instant Noodles / Packaged Ramen / Heavily Processed Soups
    if any(k in text_lower for k in ["noodle", "noodles", "ramen", "soup", "pasta", "maggi", "chowmein", "macaroni"]):
        return [
            AlternativeProduct(
                name="100% Organic Buckwheat Soba Noodles",
                reason="Slow-digesting complex carbs with zero synthetic MSG (E621) or industrial sodium spikes.",
                estimated_health_score=91
            ),
            AlternativeProduct(
                name="Red Lentil & Spinach High-Protein Spiral Pasta",
                reason="Delivers 14g clean plant protein and 7g fiber per serving with low glycemic impact.",
                estimated_health_score=93
            )
        ]

    # Category E: Processed Sweetened Dairy / Flavored Milks / Ice Creams
    if any(k in text_lower for k in ["milk", "yogurt", "curd", "dairy", "cheese", "ice cream", "kulfi", "shake"]):
        return [
            AlternativeProduct(
                name="Plain Organic Greek Yogurt with Fresh Berries",
                reason="15g clean bioavailable protein with active gut probiotics and zero cane sugar syrups.",
                estimated_health_score=95
            ),
            AlternativeProduct(
                name="Unsweetened Cold-Pressed Almond Milk",
                reason="Fortified plant calcium with zero emulsifiers, carrageenan, or added sucrose.",
                estimated_health_score=91
            )
        ]

    # Category F: Processed Meats / Hot Dogs / Cured Sausages / Nuggets
    if any(k in text_lower for k in ["sausage", "ham", "bacon", "salami", "nugget", "nuggets", "frank", "hot dog", "bologna"]):
        return [
            AlternativeProduct(
                name="Herbed Organic Tempeh or Grilled Lean Turkey",
                reason="Complete amino acid profile free from carcinogenic sodium nitrites (E250) or curing salts.",
                estimated_health_score=92
            )
        ]

    # Category G: Refined White Bread / Commercial Pastries / Buns
    if any(k in text_lower for k in ["bread", "bun", "toast", "white flour", "maida", "croissant"]):
        return [
            AlternativeProduct(
                name="100% Sprouted Whole-Grain Bread (Ezekiel Style)",
                reason="Living sprouted grains reduce glycemic index by 40% with higher bioavailable B-vitamins.",
                estimated_health_score=94
            )
        ]

    # Category H: Sweetened Breakfast Cereals / Granola Bars
    if any(k in text_lower for k in ["cereal", "flakes", "corn flakes", "granola", "muesli", "froot loops"]):
        return [
            AlternativeProduct(
                name="Steel-Cut Oats with Chia Seeds & Cinnamon",
                reason="Abundant beta-glucan soluble fiber that stabilizes blood glucose with 0g refined syrups.",
                estimated_health_score=95
            )
        ]

    # 3. Catalog KNN search if available
    catalog = _models.get("product_catalog")
    knn = _models.get("alternatives_index")
    vectorizer = _models.get("vectorizer")
    if catalog and knn and vectorizer and cleaned_text:
        try:
            X_vec = vectorizer.transform([cleaned_text])
            num_neighbors = min(20, len(catalog))
            distances, indices = knn.kneighbors(X_vec, n_neighbors=num_neighbors)
            seen_names = set()
            knn_alts: List[AlternativeProduct] = []
            for idx in indices[0]:
                item = catalog[idx]
                item_name = (item.get("food_name") or item.get("product_name") or "").strip()
                if not item_name or item_name in seen_names or item_name.lower() in text_lower:
                    continue
                item_score = int(item.get("health_score", 80))
                item_nova = int(item.get("nova_group", 2))
                if item_score > current_score or item_nova < current_nova:
                    seen_names.add(item_name)
                    knn_alts.append(AlternativeProduct(
                        name=item_name,
                        reason="Minimally processed alternative with cleaner ingredients and superior nutritional density.",
                        estimated_health_score=item_score
                    ))
                    if len(knn_alts) >= 2:
                        return knn_alts
        except Exception:
            pass

    # 4. Strict requirement fallback when no suitable alternative exists
    return [
        AlternativeProduct(
            name="No suitable swap found for this food yet.",
            reason="NutriLens found no clinically verified healthier alternative with lower processing for this specific item.",
            estimated_health_score=0
        )
    ]


def parse_nutrition_facts(text: str) -> Dict[str, Any]:
    """
    High-accuracy bidirectional parser for food nutrition fact labels.
    Handles international label formats (US FDA, UK/EU, Indian FSSAI, Latin America):
    - Calories: 70 kcal, Energy: 1845 kJ / 440 kcal, Calories 140
    - Protein: 13g, Clean Protein 13g, 13g Protein, Protein (g): 13.5
    - Total Carbohydrate: 28g, Carbs: 4g, 4g Carbs, Carbohydrate (g): 68.4
    - Total Fat: 10g, Lipids 1.5g, 1.5g Fat (differentiates from Saturated/Trans Fat)
    - Total Sugars: 3g, 3g Sugar, of which sugars 3g (differentiates from Added Sugars)
    - Sodium: 85mg, Sodium (mg): 85, 85mg Sodium, Salt: 0.2g
    """
    if not text:
        return {"parsed_count": 0}

    t = text.lower()
    t = re.sub(r'[•·|│]', ' ', t)
    # Correct common OCR confusions (e.g. Og -> 0g, Omg -> 0mg, O kcal -> 0kcal)
    t = re.sub(r'\b[oO]\s*g\b', '0g', t)
    t = re.sub(r'\b[oO]\s*mg\b', '0mg', t)
    t = re.sub(r'\b[oO]\s*kcal\b', '0kcal', t)
    t = re.sub(r'([0-9]),([0-9])', r'\1.\2', t)
    # Separate word characters from digits when fused by OCR (e.g. fat9g -> fat 9g, calories210 -> calories 210)
    t = re.sub(r'([a-zA-Z]{2,})([0-9])', r'\1 \2', t)
    # Separate units fused with next word (e.g. 13gprotein -> 13g protein)
    t = re.sub(r'([0-9](?:kcal|kj|mg|mcg|g|oz|ml))([a-zA-Z]{2,})', r'\1 \2', t)

    res: Dict[str, Any] = {
        "calories": None,
        "protein_g": None,
        "carbs_g": None,
        "fat_g": None,
        "sugar_g": None,
        "sodium_mg": None,
        "fiber_g": None,
        "serving_size": None,
        "parsed_count": 0
    }

    # 1. Serving Size
    ss_match = re.search(
        r'(?:serving size|per serving|per|portion)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:g|ml|oz|cup|bar|piece|tablet|scoop|pkg|package)(?:\s*\([^\)]+\))?|100\s*g|100\s*ml)',
        t
    )
    if ss_match:
        res["serving_size"] = ss_match.group(1).strip()

    # 2. Calories / Energy (kcal)
    cal_patterns = [
        r'(?:calories|energy|calorific value)\s*(?:\([^\)]*kcal[^\)]*\))?\s*[:\-\s]?\s*(?:[0-9]+\s*kj\s*[\/\\]\s*)?([0-9]{1,4}(?:\.[0-9]+)?)\s*(?:kcal|calories|\b)',
        r'([0-9]{1,4}(?:\.[0-9]+)?)\s*(?:kcal|calories)',
        r'(?:energy|calories)\s*[:\-]?\s*([0-9]{2,4})\b'
    ]
    for cp in cal_patterns:
        m = re.search(cp, t)
        if m:
            try:
                val = float(m.group(1))
                if 5 <= val <= 2500:
                    res["calories"] = round(val, 1)
                    break
            except (ValueError, TypeError):
                pass

    if res["calories"] is None:
        kj_m = re.search(r'([0-9]{2,5})\s*kj\b', t)
        if kj_m:
            try:
                res["calories"] = round(float(kj_m.group(1)) / 4.184, 1)
            except (ValueError, TypeError):
                pass

    # 3. Protein (both directions, e.g. "Protein: 13g", "13g Clean Protein")
    prot_patterns = [
        r'(?:total\s+)?protein\s*(?:\([^\)]*g[^\)]*\))?\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*g?\b',
        r'([0-9]+(?:\.[0-9]+)?)\s*g\s*(?:clean\s+)?protein\b'
    ]
    for pp in prot_patterns:
        m = re.search(pp, t)
        if m:
            try:
                val = float(m.group(1))
                if val <= 100:
                    res["protein_g"] = round(val, 1)
                    break
            except (ValueError, TypeError):
                pass

    # 4. Carbohydrates (both directions, e.g. "Total Carbohydrate: 28g", "4g Carbs")
    carb_patterns = [
        r'(?:total\s+)?(?:carbohydrate|carbohydrates|carbs)\s*(?:\([^\)]*g[^\)]*\))?\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*g?\b',
        r'([0-9]+(?:\.[0-9]+)?)\s*g\s*(?:total\s+)?(?:carbohydrates|carbs|carbohydrate)\b'
    ]
    for cp in carb_patterns:
        m = re.search(cp, t)
        if m:
            try:
                val = float(m.group(1))
                if val <= 100:
                    res["carbs_g"] = round(val, 1)
                    break
            except (ValueError, TypeError):
                pass

    # 5. Total Fat (both directions, avoid picking saturated or trans fat)
    fat_patterns = [
        r'(?:\btotal\s+fat\b|(?<!saturated\s)(?<!trans\s)\bfat\b|lipids)\s*(?:\([^\)]*g[^\)]*\))?\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*g?\b',
        r'([0-9]+(?:\.[0-9]+)?)\s*g\s*(?:total\s+)?fat\b'
    ]
    for fp in fat_patterns:
        m = re.search(fp, t)
        if m:
            try:
                val = float(m.group(1))
                if val <= 100:
                    res["fat_g"] = round(val, 1)
                    break
            except (ValueError, TypeError):
                pass

    # 6. Sugars (both directions, prioritize Total Sugars over Added Sugars)
    sugar_patterns = [
        r'(?:total\s+)?sugars?\s*(?:\([^\)]*g[^\)]*\))?\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*g?\b',
        r'of which sugars\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*g?\b',
        r'([0-9]+(?:\.[0-9]+)?)\s*g\s*(?:total\s+)?sugars?\b'
    ]
    for sp in sugar_patterns:
        m = re.search(sp, t)
        if m:
            try:
                val = float(m.group(1))
                if val <= 100:
                    res["sugar_g"] = round(val, 1)
                    break
            except (ValueError, TypeError):
                pass

    # 7. Sodium / Salt (both directions, mg & g, and salt conversion)
    sod_patterns = [
        r'sodium\s*(?:\([^\)]*mg[^\)]*\))?\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:mg)?\b',
        r'([0-9]+(?:\.[0-9]+)?)\s*mg\s*sodium\b',
        r'sodium\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*g\b'
    ]
    for sp in sod_patterns:
        m = re.search(sp, t)
        if m:
            try:
                val = float(m.group(1))
                if 'g' in sp and val < 5:
                    val = val * 1000.0
                if val <= 10000:
                    res["sodium_mg"] = round(val, 1)
                    break
            except (ValueError, TypeError):
                pass

    # Fallback to Salt if Sodium not directly listed
    if res["sodium_mg"] is None:
        salt_m = re.search(r'salt\s*(?:\([^\)]*g[^\)]*\))?\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:g|mg)?\b', t)
        if salt_m:
            try:
                salt_val = float(salt_m.group(1))
                if 'mg' in salt_m.group(0):
                    res["sodium_mg"] = round(salt_val / 2.5, 1)
                else:
                    res["sodium_mg"] = round((salt_val / 2.5) * 1000.0, 1)
            except (ValueError, TypeError):
                pass

    # 8. Dietary Fiber (both directions, e.g. "Dietary Fiber: 4g", "Fiber: 3g", "Fibres: 2.5g")
    fiber_patterns = [
        r'(?:dietary\s+)?(?:fibers?|fibres?)\s*(?:\([^\)]*g[^\)]*\))?\s*[:\-\s]?\s*([0-9]+(?:\.[0-9]+)?)\s*g?\b',
        r'([0-9]+(?:\.[0-9]+)?)\s*g\s*(?:dietary\s+)?(?:fibers?|fibres?)\b'
    ]
    for fp in fiber_patterns:
        m = re.search(fp, t)
        if m:
            try:
                val = float(m.group(1))
                if val <= 60:
                    res["fiber_g"] = round(val, 1)
                    break
            except (ValueError, TypeError):
                pass

    # Count how many macros were genuinely parsed from the label
    parsed = [v for k, v in res.items() if k not in ("serving_size", "parsed_count") and v is not None]
    res["parsed_count"] = len(parsed)
    return res


def _estimate_from_ingredients(text: str, nova: int, score: int) -> NutritionBreakdown:
    """
    Computes a realistic macronutrient estimate derived from the actual detected ingredients
    when no nutrition facts panel is printed on the package.
    """
    t = text.lower()

    grain_tokens = ['wheat', 'flour', 'rice', 'oat', 'corn', 'potato', 'starch', 'barley', 'cereal', 'bread', 'noodle', 'pasta', 'grain']
    sugar_tokens = ['sugar', 'syrup', 'honey', 'glucose', 'fructose', 'sucrose', 'dextrose', 'caramel', 'molasses', 'maltodextrin']
    protein_tokens = ['protein', 'whey', 'chicken', 'beef', 'egg', 'fish', 'meat', 'milk', 'cheese', 'casein', 'soy', 'tofu', 'isolate', 'collagen']
    fat_tokens = ['oil', 'butter', 'ghee', 'cocoa butter', 'shortening', 'lard', 'margarine', 'palm', 'nut', 'almond', 'peanut', 'cashew', 'seed']
    low_cal_tokens = ['water', 'tea', 'coffee', 'vinegar', 'lettuce', 'cucumber', 'celery', 'mint', 'herb', 'spice', 'diet']

    grain_score = sum(1 for tok in grain_tokens if tok in t)
    sugar_score = sum(1 for tok in sugar_tokens if tok in t)
    protein_score = sum(1 for tok in protein_tokens if tok in t)
    fat_score = sum(1 for tok in fat_tokens if tok in t)
    low_cal_score = sum(1 for tok in low_cal_tokens if tok in t)

    if low_cal_score >= 2 and (grain_score + protein_score + fat_score) <= 1:
        calories = 15.0
        protein = 0.5
        carbs = 2.0
        fat = 0.2
        sugar = 0.5
        sodium = 15.0
    elif protein_score >= 2 and protein_score > (grain_score + fat_score):
        protein = 22.0
        carbs = 6.0
        fat = 4.0
        sugar = 2.0
        calories = round(protein * 4.0 + carbs * 4.0 + fat * 9.0, 1)
        sodium = 220.0 if ('salt' in t or 'sodium' in t) else 80.0
    elif fat_score >= 2 and fat_score > (grain_score + protein_score):
        fat = 24.0
        protein = 8.0
        carbs = 12.0
        sugar = 6.0 if sugar_score else 2.0
        calories = round(protein * 4.0 + carbs * 4.0 + fat * 9.0, 1)
        sodium = 180.0 if ('salt' in t or 'sodium' in t) else 40.0
    elif grain_score >= 1 or sugar_score >= 1:
        carbs = 32.0 if grain_score >= 2 else 22.0
        sugar = 14.0 if sugar_score >= 2 else (6.0 if sugar_score == 1 else 2.0)
        protein = 4.0
        fat = 5.0 if fat_score else 1.5
        calories = round(protein * 4.0 + carbs * 4.0 + fat * 9.0, 1)
        sodium = 240.0 if ('salt' in t or 'sodium' in t) else 60.0
    else:
        protein = 5.0
        carbs = 18.0
        fat = 4.0
        sugar = 4.0
        calories = round(protein * 4.0 + carbs * 4.0 + fat * 9.0, 1)
        sodium = 120.0

    fiber = 1.5
    if grain_score >= 1 or any(k in t for k in ['oat', 'chia', 'seed', 'blueberry', 'berry', 'bean', 'lentil']):
        fiber = 4.0 if (grain_score >= 2 or 'chia' in t or 'seed' in t or 'bean' in t) else 2.5
    elif any(k in t for k in ['vegetable', 'apple', 'fruit', 'cacao']):
        fiber = 2.0

    return NutritionBreakdown(
        calories=calories,
        protein_g=protein,
        carbs_g=carbs,
        fat_g=fat,
        sugar_g=sugar,
        sodium_mg=sodium,
        fiber_g=fiber,
        is_estimated=True,
        source="Calculated from Ingredients (No table on package)",
        serving_size=None
    )


def _estimate_nutrition(ocr_text: str, cleaned_text: str, nova: int, score: int, catalog_match: Optional[Dict[str, Any]] = None) -> NutritionBreakdown:
    """
    Extracts genuine nutrition facts from scanned label text.
    If no printed nutrition panel exists on packaging (e.g. front photo), uses verified FMCG catalog values.
    Otherwise derives dynamic estimate from ingredient tokens.
    Never injects fake static numbers.
    """
    # 1. First attempt: Parse genuine nutrition figures from OCR text
    parsed = parse_nutrition_facts(ocr_text)
    if parsed.get("parsed_count", 0) == 0 and cleaned_text != ocr_text:
        parsed = parse_nutrition_facts(cleaned_text)

    if parsed.get("parsed_count", 0) >= 1:
        # At least one real macro figure was extracted from the label!
        calories = parsed["calories"]
        protein = parsed["protein_g"]
        carbs = parsed["carbs_g"]
        fat = parsed["fat_g"]
        sugar = parsed["sugar_g"]
        sodium = parsed["sodium_mg"]
        fiber = parsed.get("fiber_g")

        # If calories is missing but macros are present, compute using Atwater factors:
        if calories is None and (protein is not None or carbs is not None or fat is not None):
            calories = round((protein or 0.0) * 4.0 + (carbs or 0.0) * 4.0 + (fat or 0.0) * 9.0, 1)

        return NutritionBreakdown(
            calories=calories,
            protein_g=protein,
            carbs_g=carbs,
            fat_g=fat,
            sugar_g=sugar,
            sodium_mg=sodium,
            fiber_g=fiber,
            is_estimated=False,
            source="Scanned Product Label",
            serving_size=parsed.get("serving_size")
        )

    # 2. Second attempt: Check if matched against verified product catalog in SQLite database
    if catalog_match and (catalog_match.get("calories") is not None or catalog_match.get("carbs_g") is not None):
        return NutritionBreakdown(
            calories=catalog_match.get("calories"),
            protein_g=catalog_match.get("protein_g"),
            carbs_g=catalog_match.get("carbs_g"),
            fat_g=catalog_match.get("fat_g"),
            sugar_g=catalog_match.get("sugar_g"),
            sodium_mg=catalog_match.get("sodium_mg"),
            fiber_g=catalog_match.get("fiber_g"),
            is_estimated=False,
            source="NutriLens Verified Food Catalog",
            serving_size=catalog_match.get("serving_size")
        )

    # 3. No label nutrition table found & not in catalog -> compute dynamic ingredient-derived estimate
    return _estimate_from_ingredients(f"{ocr_text} {cleaned_text}", nova, score)


_last_ocr_debug = ""

def get_last_ocr_debug() -> str:
    global _last_ocr_debug
    return _last_ocr_debug


def get_rapidocr_engine():
    """
    Retrieves or initializes the cached RapidOCR engine safely.
    Uses opencv-python-headless to prevent libGL.so.1 errors on Linux.
    """
    global _rapidocr_engine, _last_ocr_debug
    if _rapidocr_engine is not None:
        return _rapidocr_engine

    try:
        from rapidocr_onnxruntime import RapidOCR
        _rapidocr_engine = RapidOCR()
        try:
            _rapidocr_engine.use_angle_cls = False
        except Exception:
            pass
        return _rapidocr_engine
    except ImportError as imp_err:
        _last_ocr_debug = f"RapidOCR ImportError: {imp_err}"
        print(_last_ocr_debug)
        return None
    except Exception as rapid_err:
        _last_ocr_debug = f"RapidOCR init error: {rapid_err}"
        print(_last_ocr_debug)
        return None



def extract_text_from_image_base64(image_base64: str) -> str:
    """
    Extracts text from a base64 encoded image using high-speed local OCR.
    Uses RapidOCR (ONNX) as primary engine with adaptive sharpening, CLAHE,
    and multi-orientation passes for maximum text extraction from real-world photos.
    """
    global _last_ocr_debug
    if not image_base64:
        return ""

    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]

    image_base64 = re.sub(r'\s+', '', image_base64)
    missing_padding = len(image_base64) % 4
    if missing_padding:
        image_base64 += "=" * (4 - missing_padding)

    try:
        image_bytes = base64.b64decode(image_base64)
        from PIL import Image, ImageEnhance, ImageOps, ImageFilter
        import cv2

        img = Image.open(BytesIO(image_bytes))

        # 1. Correct mobile EXIF orientation so rotated phone photos are upright
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # 2. Quality check: evaluate brightness and blur metric
        np_check = np.array(img)
        mean_brightness = float(np.mean(np_check))
        is_blank = (mean_brightness > 248.0 and float(np.std(np_check)) < 5.0)
        del np_check  # Free array immediately
        _last_ocr_debug = ""
        if mean_brightness < 20.0:
            _last_ocr_debug = "dark_image: Mean brightness is very low (<20)"
        elif is_blank:
            _last_ocr_debug = "blank_image: Image is almost solid white"

        # 3. Adaptive scaling: keep optimal resolution (up to 800px) with high-fidelity LANCZOS resampling (fast & accurate)
        max_dim = max(img.width, img.height)
        if max_dim > 800:
            scale = 800.0 / max_dim
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
        elif img.width < 450 and img.height < 450 and img.width > 20 and img.height > 20:
            # Upscale tiny crops so small ingredient fonts become readable by OCR
            scale = min(2.0, 750.0 / max(img.width, 1))
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)

        # 4. Illumination & Contrast Normalization for uneven lighting, shadows, or dark shots
        if mean_brightness < 45.0:
            try:
                img = ImageOps.autocontrast(img, cutoff=2)
            except Exception:
                pass
        elif mean_brightness > 210.0:
            try:
                enhancer = ImageEnhance.Contrast(img)
                img = enhancer.enhance(1.35)
            except Exception:
                pass

        from services.food_classifier import FOOD_INGREDIENT_TOKENS, NUTRITION_FACTS_TERMS, FOOD_HEADING_PATTERNS

        def _clean_ocr_tokens(raw_t: str) -> str:
            if not raw_t:
                return ""
            # Separate joined brand/category tokens
            clean = re.sub(r'([a-zA-Z]{3,})(cookies|biscuits|noodles|chips|cola|chocolate|namkeen|milk|butter|wafer|sugar|wheat|flour|salt|fat|crisp|snack|powder)', r'\1 \2', raw_t, flags=re.I)
            clean = re.sub(r'(\b\w+\b)\s+Product\b', r'\1', clean, flags=re.I)
            # Normalize common OCR noise in packaging headings
            clean = re.sub(r'\b[il1|!]ngred[il1e|!]ents?\b', 'Ingredients', clean, flags=re.I)
            clean = re.sub(r'\bcont[a|e]?[il1|!]ns\b', 'Contains', clean, flags=re.I)
            clean = re.sub(r'\bnutr[il1|!]t[il1|!]on\b', 'Nutrition', clean, flags=re.I)
            return clean.strip()

        def _score_text(t: str) -> Tuple[int, int, int]:
            """Returns (total_score, food_count, nutri_count)"""
            if not t:
                return 0, 0, 0
            tl = t.lower()
            food_count = sum(1 for w in FOOD_INGREDIENT_TOKENS if re.search(r'\b' + re.escape(w) + r'\b', tl) or (len(w) >= 4 and w in tl))
            nutri_count = sum(1 for w in NUTRITION_FACTS_TERMS if w in tl)
            heading_count = sum(1 for p in FOOD_HEADING_PATTERNS if re.search(p, tl))
            units_count = len(re.findall(r'\b\d+\s*(?:g|mg|kcal|cal|kj|ml|%)\b', tl))
            has_e_code = len(re.findall(r'\b[eE][-\s]?[0-9]{3,4}[a-z]?\b', t))
            total_score = (food_count * 25) + (nutri_count * 20) + (heading_count * 30) + (units_count * 10) + (has_e_code * 20) + len(t.split())
            return total_score, food_count, nutri_count

        best_text = ""
        best_score = 0
        best_food_count = 0
        best_nutri_count = 0
        collected_lines: List[str] = []

        # RapidOCR engine
        ocr_engine = get_rapidocr_engine()

        def _run_engine(pil_image) -> Tuple[str, int, int, int, List[str]]:
            arr = None
            try:
                arr = np.array(pil_image.convert("RGB") if pil_image.mode != "RGB" else pil_image)
                res, _ = ocr_engine(arr, box_thresh=0.6, text_score=0.55)
                if res:
                    lines = [str(item[1]).strip() for item in res if item and len(item) > 1 and item[1]]
                    txt = _clean_ocr_tokens("\n".join(lines).strip())
                    sc, fc, nc = _score_text(txt)
                    return txt, sc, fc, nc, lines
            except Exception:
                pass
            finally:
                if arr is not None:
                    del arr
            return "", 0, 0, 0, []

        if ocr_engine is not None:
            # Pass 1: Original upright image (0°) - Fast direct inference
            t1, s1, fc1, nc1, l1 = _run_engine(img)
            if s1 > best_score:
                best_text, best_score, best_food_count, best_nutri_count = t1, s1, fc1, nc1
                for line in l1:
                    cl = line.strip()
                    if cl and cl.lower() not in [x.lower() for x in collected_lines]:
                        collected_lines.append(cl)

            # High-speed early exit: If Pass 1 extracted readable tokens (>= 3 words) or any food/nutrition token,
            # the packaging is upright and legible. Return immediately to prevent slow multi-pass delays on cloud instances!
            words_pass1 = len(best_text.split())
            if (words_pass1 >= 3 or best_food_count >= 1 or best_nutri_count >= 1 or best_score >= 12):
                import gc; gc.collect()
                return best_text

            # Pass 2: Unsharp Mask Deblurring & Contrast Enhancement (only for blurry / low-contrast text)
            try:
                sharp_img = img.filter(ImageFilter.UnsharpMask(radius=2.0, percent=200, threshold=2))
                enhancer = ImageEnhance.Contrast(sharp_img)
                sharp_img = enhancer.enhance(1.25)
                t2, s2, fc2, nc2, l2 = _run_engine(sharp_img)
                if s2 > best_score:
                    best_text, best_score, best_food_count, best_nutri_count = t2, s2, fc2, nc2
                for line in l2:
                    cl = line.strip()
                    if cl and cl.lower() not in [x.lower() for x in collected_lines]:
                        collected_lines.append(cl)
                del sharp_img
            except Exception:
                pass

            words_pass2 = len(best_text.split())
            if (words_pass2 >= 3 or best_food_count >= 1 or best_nutri_count >= 1 or best_score >= 12):
                import gc; gc.collect()
                return best_text

            # Only check orientation inversion (180°) if the image yielded almost zero text (< 2 words)
            is_completely_unreadable = (best_score < 10 and best_food_count == 0 and best_nutri_count == 0 and words_pass2 < 2)

            if is_completely_unreadable:
                # Pass 3: 180° Inverted Orientation Check (in case photo was captured upside down)
                try:
                    rot180 = img.rotate(180, expand=True)
                    t180, s180, fc180, nc180, l180 = _run_engine(rot180)
                    del rot180
                    if s180 > best_score:
                        best_text, best_score, best_food_count, best_nutri_count = t180, s180, fc180, nc180
                    for line in l180:
                        cl = line.strip()
                        if cl and cl.lower() not in [x.lower() for x in collected_lines]:
                            collected_lines.append(cl)
                except Exception:
                    pass

                # If still zero text, attempt CLAHE contrast as final resort
                if best_score < 10 and len(best_text.split()) < 2:
                    try:
                        gray_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
                        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
                        clahe_arr = clahe.apply(gray_cv)
                        gray_clahe = Image.fromarray(clahe_arr)
                        del gray_cv, clahe, clahe_arr
                        t3, s3, fc3, nc3, l3 = _run_engine(gray_clahe)
                        del gray_clahe
                        if s3 > best_score:
                            best_text, best_score, best_food_count, best_nutri_count = t3, s3, fc3, nc3
                        for line in l3:
                            cl = line.strip()
                            if cl and cl.lower() not in [x.lower() for x in collected_lines]:
                                collected_lines.append(cl)
                    except Exception:
                        pass

            # Smart merge: If collected distinct lines contain food tokens or nutrition facts
            if collected_lines:
                existing_lower = {line.lower().strip() for line in best_text.splitlines() if line.strip()}
                new_unique_lines = [l for l in collected_lines if l.lower().strip() not in existing_lower]
                if new_unique_lines:
                    merged_txt = _clean_ocr_tokens("\n".join(best_text.splitlines() + new_unique_lines).strip())
                    sc_merged, fc_merged, _ = _score_text(merged_txt)
                    if sc_merged >= best_score:
                        best_text = merged_txt
                        best_score = sc_merged

            if best_text and (best_score >= 8 or len(best_text.split()) >= 2):
                import gc; gc.collect()
                return best_text

        # Engine 2: Windows Native WinOCR Fallback (exceptional accuracy on blurred Latin fonts)
        if os.name == 'nt' and (not best_text or best_score < 12):
            try:
                import winocr, asyncio, concurrent.futures
                def _run_winocr_sync(target_img):
                    try:
                        async def _do():
                            res = await winocr.recognize_pil(target_img, "en")
                            return res.text.strip() if hasattr(res, "text") and res.text else ""
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        try:
                            return loop.run_until_complete(_do())
                        finally:
                            loop.close()
                    except Exception:
                        return ""
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    win_text = pool.submit(_run_winocr_sync, img).result(timeout=4.0)
                    if win_text and len(win_text.split()) >= 1:
                        sc_win, fc_win, _ = _score_text(win_text)
                        if sc_win > best_score:
                            best_text = _clean_ocr_tokens(win_text)
                            best_score = sc_win
            except Exception:
                pass

        # Engine 3: Pytesseract Fallback (Docker Linux / Render)
        if not best_text or best_score < 12:
            try:
                import pytesseract
                tess_text = pytesseract.image_to_string(img, config="--psm 6").strip()
                if not tess_text:
                    tess_text = pytesseract.image_to_string(img, config="--psm 11").strip()
                if tess_text:
                    sc_tess, _, _ = _score_text(tess_text)
                    if sc_tess > best_score:
                        best_text = _clean_ocr_tokens(tess_text)
            except Exception:
                pass

        import gc; gc.collect()
        if best_text:
            return best_text

    except Exception as e:
        _last_ocr_debug = f"error: {str(e)}"
        print(f"Error decoding and processing image for OCR: {e}")

    return ""


def analyze_label_image(image_base64: str, user_profile: Optional[UserProfile] = None) -> AnalyzeResponse:
    """
    Analyzes an ingredient label image locally using on-device OCR and trained ML models.
    Decodes base64, extracts text via OCR, and parses ingredients.
    Includes enhanced fallback logic for real-world photos with partial/sparse OCR text.
    """
    profile = user_profile or UserProfile()

    # 1. First check if photo contains a readable barcode (works cross-platform via zxing-cpp)
    try:
        from services.barcode_service import decode_barcode_from_image
        detected_barcode = decode_barcode_from_image(image_base64, allow_ocr_fallback=False)
        if detected_barcode:
            barcode_res = analyze_ingredients(f"Scanned Barcode GTIN: {detected_barcode}", profile)
            if barcode_res.is_food:
                return barcode_res
    except Exception as barcode_err:
        print(f"Barcode auto-check notice: {barcode_err}")

    # 2. Run OCR text extraction with enhanced preprocessing
    extracted_text = extract_text_from_image_base64(image_base64)

    if not extracted_text or not extracted_text.strip():
        rejection_msg = "No readable packaging text or nutrition label was detected in this photo. Please hold the camera 4–6 inches away in good lighting and tap to focus on the label."
        debug_status = get_last_ocr_debug()
        if "dark" in debug_status.lower():
            rejection_msg = "Image is too dark to read clearly. Please turn on your camera flash or capture the package in bright lighting."
        elif "blank" in debug_status.lower():
            rejection_msg = "Image appears blank or overexposed. Please aim your camera directly at the food packaging."
        return AnalyzeResponse(
            is_food=False,
            rejection_reason=rejection_msg,
            product_name="Unrecognized Image",
            health_score=0,
            nova_group=None,
            personalized_verdict=f"⚠️ {rejection_msg}",
            ocr_text=""
        )

    # 3. Try standard full analysis pipeline
    res = analyze_ingredients(extracted_text, profile)
    res.ocr_text = extracted_text

    # 4. If food classifier rejected the text but OCR did extract something,
    #    try a relaxed food detection pass - real food photos with tilt, partial glare,
    #    or small font should always be parsed and analyzed.
    if res.is_food == False and extracted_text.strip():
        text_lower = extracted_text.lower()
        word_count = len(extracted_text.split())

        from services.food_classifier import FOOD_INGREDIENT_TOKENS, NUTRITION_FACTS_TERMS, FOOD_HEADING_PATTERNS, NON_FOOD_INDICATORS

        # If strong non-food keywords are present (e.g. invoice, receipt, hardware, textiles), never override to food!
        has_non_food = any(re.search(r'\b' + re.escape(nf) + r'\b', text_lower) for nf in NON_FOOD_INDICATORS)
        catalog_match = _find_catalog_match(extracted_text)

        if has_non_food and not catalog_match:
            return res

        # Check if ANY genuine food-related tokens exist in the text
        food_hits = [w for w in FOOD_INGREDIENT_TOKENS if re.search(r'\b' + re.escape(w) + r'\b', text_lower) or (len(w) >= 4 and w in text_lower)]
        nutrition_hits = [t for t in NUTRITION_FACTS_TERMS if t in text_lower]
        heading_hits = [p for p in FOOD_HEADING_PATTERNS if re.search(p, text_lower)]

        # Check for common packaging measurements and food keywords
        has_weight = bool(re.search(r'\b\d+\s*(?:g|gm|gms|kg|ml|l|oz|lb)\b', text_lower))
        has_kcal = bool(re.search(r'\b\d+\s*(?:kcal|kj|cal)\b', text_lower))
        has_pkg_words = bool(re.search(r'\b(ingredients?|energy|calories|fat|protein|carbs?|sugar|sodium|salt|flour|oil|water|milk|fssai|serving)\b', text_lower))

        is_likely_food = (
            catalog_match is not None
            or len(food_hits) >= 1
            or len(nutrition_hits) >= 1
            or len(heading_hits) >= 1
            or has_kcal
            or (has_pkg_words and word_count >= 2)
            or (has_weight and word_count >= 2)
        )

        if is_likely_food and not has_non_food:
            # Force re-analysis treating it as food
            cleaned_text = clean_ingredient_text(extracted_text)

            pred_nova = 3
            pred_score = 65.0

            if _models["is_loaded"] and _models["vectorizer"] and cleaned_text:
                try:
                    X_vec = _models["vectorizer"].transform([cleaned_text])
                    if _models["nova_classifier"]:
                        pred_nova = int(_models["nova_classifier"].predict(X_vec)[0])
                    if _models["health_regressor"]:
                        pred_score = float(_models["health_regressor"].predict(X_vec)[0])
                except Exception:
                    pass

            catalog_match = catalog_match or _find_catalog_match(extracted_text)
            if catalog_match and catalog_match.get("health_score"):
                final_score = int(catalog_match["health_score"])
            else:
                final_score = int(max(5, min(99, round(pred_score))))

            if catalog_match and catalog_match.get("nova_group"):
                final_nova = int(catalog_match["nova_group"])
            else:
                final_nova = int(max(1, min(4, pred_nova)))

            product_name = _extract_smart_product_name(extracted_text, catalog_match)
            nutrition = _estimate_nutrition(extracted_text, cleaned_text, final_nova, final_score, catalog_match=catalog_match)

            detected_allergens = []
            for allergen, keywords in ALLERGEN_TAXONOMY.items():
                if any(re.search(rf'\b{re.escape(kw)}\b', text_lower) for kw in keywords):
                    detected_allergens.append(allergen)

            # Detect additives
            detected_additives: List[AdditiveDetail] = []
            seen_additive_codes = set()
            e_code_matches = re.findall(r'\b[Ee][-\s]?([0-9]{3,4}[a-z]?)\b', extracted_text)
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

            is_demo_user = bool(profile and profile.user_id in DEMO_USER_IDS)
            alternatives = _find_healthier_alternatives(
                cleaned_text,
                final_nova,
                final_score,
                product_name=product_name,
                nutrition=nutrition,
                is_demo=is_demo_user
            )

            # Run personalized user preference audit
            audit = _audit_user_preferences(text_lower, nutrition, detected_allergens, profile)

            verdict = "Scanned Food Product: Nutrition and ingredient assessment computed from physical packaging scan."
            if audit.allergen_conflicts:
                verdict = f"CRITICAL ALLERGEN ALERT: Contains {', '.join(audit.allergen_conflicts)} which conflicts with your saved profile!"
            elif audit.dietary_conflicts:
                verdict = f"Dietary Notice: {audit.dietary_conflicts[0]}"

            data_completeness, missing_nutrients = nutrition_service.assess_data_completeness({
                "calories": nutrition.calories,
                "protein_g": nutrition.protein_g,
                "fat_g": nutrition.fat_g,
                "carbs_g": nutrition.carbs_g,
                "sugar_g": nutrition.sugar_g,
                "fiber_g": nutrition.fiber_g,
                "sodium_mg": nutrition.sodium_mg
            })

            personalized_rec = generate_personalized_recommendation(
                product_name=product_name,
                ocr_text=extracted_text,
                nutrition=nutrition,
                detected_allergens=detected_allergens,
                ingredient_risks=[],
                user_profile=profile,
                data_sources=["Scanned Product Label"],
                data_completeness=data_completeness,
                missing_nutrients=missing_nutrients
            )

            # Harmonize health score with personalized safety verdict
            if personalized_rec.status == "Not Recommended":
                final_score = min(final_score, 28)
            elif personalized_rec.status.startswith("Limit"):
                final_score = min(final_score, 50)

            res = AnalyzeResponse(
                is_food=True,
                product_name=product_name,
                health_score=final_score,
                nova_group=final_nova,
                allergen_flags=detected_allergens,
                ingredient_risks=[],
                positive_attributes=["Food product identified and verified from package scan"],
                additives=detected_additives,
                nutrition_estimate=nutrition,
                healthier_alternatives=alternatives,
                personalized_verdict=verdict,
                personalized_recommendation=personalized_rec,
                data_completeness=data_completeness,
                missing_nutrients=missing_nutrients,
                data_sources=["Scanned Product Label"],
                ocr_text=extracted_text,
                preference_audit=audit
            )

    return res

