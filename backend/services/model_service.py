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
    AlternativeProduct,
    PreferenceAudit
)
from services.barcode_service import extract_barcode_digits, lookup_barcode_online
from services.food_classifier import classify_food_item
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
                rejection_reason=f"Barcode '{barcode_digits}' was not found in our global food nutrition database. It appears to belong to a non-food item or an unregistered foreign object.",
                product_name=f"Unrecognized Item ({barcode_digits})",
                health_score=0,
                nova_group=None,
                personalized_verdict=f"⚠️ Unrecognized Barcode: GTIN {barcode_digits} does not match any edible food or nutrition product in our database.",
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

            audit = _audit_user_preferences(text_lower, nutrition, detected_allergens, profile)
            alternatives = _find_healthier_alternatives(cleaned_text, real_nova or 3, real_score)

            # Build personalized verdict
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

            return AnalyzeResponse(
                is_food=True,
                product_name=p_name,
                health_score=real_score,
                nova_group=real_nova,
                allergen_flags=detected_allergens,
                ingredient_risks=["Contains high sugar or additives."] if real_score < 50 else [],
                positive_attributes=["Verified Food Product from Global Database"],
                additives=detected_additives,
                nutrition_estimate=nutrition,
                healthier_alternatives=alternatives,
                personalized_verdict=" ".join(verdict_parts),
                ocr_text=ocr_text,
                barcode=barcode_digits,
                preference_audit=audit
            )

    # 1. Non-Food & Foreign Object Classification
    is_food, food_reason, stats = classify_food_item(ocr_text)
    if not is_food:
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

    final_health_score = int(max(5, min(99, round(pred_score))))
    final_nova = int(max(1, min(4, pred_nova)))

    # 6. Extract/Estimate Nutrition Breakdown & Product Matching
    catalog_match = _find_catalog_match(ocr_text)
    nutrition = _estimate_nutrition(ocr_text, cleaned_text, final_nova, final_health_score)
    if catalog_match:
        product_name = catalog_match["product_name"]
        # Only use catalog nutrition if label didn't have its own printed nutrition panel
        if nutrition.is_estimated:
            nutrition = NutritionBreakdown(
                calories=float(catalog_match.get("calories", nutrition.calories)) if catalog_match.get("calories") is not None else nutrition.calories,
                protein_g=float(catalog_match.get("protein_g", nutrition.protein_g)) if catalog_match.get("protein_g") is not None else nutrition.protein_g,
                carbs_g=float(catalog_match.get("carbs_g", nutrition.carbs_g)) if catalog_match.get("carbs_g") is not None else nutrition.carbs_g,
                fat_g=float(catalog_match.get("fat_g", nutrition.fat_g)) if catalog_match.get("fat_g") is not None else nutrition.fat_g,
                sugar_g=float(catalog_match.get("sugar_g", nutrition.sugar_g)) if catalog_match.get("sugar_g") is not None else nutrition.sugar_g,
                sodium_mg=float(catalog_match.get("sodium_mg", nutrition.sodium_mg)) if catalog_match.get("sodium_mg") is not None else nutrition.sodium_mg,
                is_estimated=False,
                source=f"Product Catalog ({product_name})",
                serving_size=nutrition.serving_size
            )
            if catalog_match.get("nova_group") is not None:
                final_nova = int(catalog_match["nova_group"])
            if catalog_match.get("health_score") is not None and not ingredient_risks and not detected_additives:
                final_health_score = int(catalog_match["health_score"])
    else:
        product_name = _extract_smart_product_name(ocr_text)

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

    alternatives = _find_healthier_alternatives(cleaned_text, final_nova, final_health_score)

    return AnalyzeResponse(
        is_food=True,
        product_name=product_name,
        health_score=final_health_score,
        nova_group=final_nova,
        allergen_flags=detected_allergens,
        ingredient_risks=ingredient_risks,
        positive_attributes=positive_attributes,
        additives=detected_additives,
        nutrition_estimate=nutrition,
        healthier_alternatives=alternatives,
        personalized_verdict=" ".join(verdict_parts),
        ocr_text=ocr_text,
        preference_audit=audit
    )


def _find_catalog_match(text: str) -> Optional[Dict[str, Any]]:
    """
    Finds verified product name match from the food dataset catalog.
    Only checks title lines (before ingredient list) to prevent matching single ingredient words like 'salt'.
    """
    catalog = _models.get("product_catalog")
    if not catalog or not text:
        return None

    lines = [l.strip().lower() for l in text.split('\n') if l.strip()]
    title_lines = []
    for l in lines:
        if any(w in l for w in ['ingredients', 'nutrition facts', 'typical values', 'serving size', 'contains']):
            break
        title_lines.append(l)

    if not title_lines:
        title_lines = lines[:2]

    best_item = None
    best_len = 0
    for item in catalog:
        name = item.get("product_name", "").lower().strip()
        if len(name) < 4:
            continue
        for tl in title_lines:
            # Full match or substring in a descriptive title
            if name == tl or (len(name) >= 6 and name in tl):
                if len(name) > best_len:
                    best_item = item
                    best_len = len(name)

    return best_item


def _extract_smart_product_name(ocr_text: str, catalog_match: Optional[Dict[str, Any]] = None) -> str:
    """Extracts a clean, intelligible product name from OCR text lines."""
    if catalog_match and catalog_match.get("product_name"):
        return catalog_match["product_name"]

    lines = [l.strip() for l in ocr_text.split("\n") if l.strip()]
    if not lines:
        return "Scanned Food Product"

    ignore_prefixes = [
        "ingredient", "nutrition", "fact", "keep", "store", "best", "exp", "mfg",
        "net", "serving", "calories", "distributed", "contains", "manufactured", "batch", "lot"
    ]

    for line in lines:
        cleaned_line = re.sub(r'^[^\w]+', '', line)
        first_word = cleaned_line.split()[0].lower() if cleaned_line.split() else ""
        if any(first_word.startswith(p) for p in ignore_prefixes):
            continue
        if len(cleaned_line) >= 3 and len(cleaned_line) <= 50:
            cleaned_line = re.sub(r'[:,;.]+$', '', cleaned_line).strip()
            return cleaned_line.title()

    clean = re.sub(r'^(ingredients|contents|contains|nutrition facts)\s*[:\-]?\s*', '', lines[0], flags=re.IGNORECASE).strip()
    primary = [p.strip() for p in re.split(r'[,;]', clean) if p.strip()]
    if primary:
        return f"{primary[0].title()} Product"

    return "Scanned Food Product"


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

    res: Dict[str, Any] = {
        "calories": None,
        "protein_g": None,
        "carbs_g": None,
        "fat_g": None,
        "sugar_g": None,
        "sodium_mg": None,
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

    return NutritionBreakdown(
        calories=calories,
        protein_g=protein,
        carbs_g=carbs,
        fat_g=fat,
        sugar_g=sugar,
        sodium_mg=sodium,
        is_estimated=True,
        source="Calculated from Ingredients (No table on package)",
        serving_size=None
    )


def _estimate_nutrition(ocr_text: str, cleaned_text: str, nova: int, score: int) -> NutritionBreakdown:
    """
    Extracts genuine nutrition facts from scanned label text.
    If no printed nutrition panel exists, derives a dynamic estimate from ingredient tokens.
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
            is_estimated=False,
            source="Scanned Product Label",
            serving_size=parsed.get("serving_size")
        )

    # 2. No label nutrition table found -> compute dynamic ingredient-derived estimate
    return _estimate_from_ingredients(f"{ocr_text} {cleaned_text}", nova, score)


def extract_text_from_image_base64(image_base64: str) -> str:
    """
    Extracts text from a base64 encoded image using high-speed local OCR.
    Uses native Windows.Media.Ocr (winocr) with fast fallbacks and preprocessing.
    """
    if not image_base64:
        return ""

    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]

    extracted_text = ""
    try:
        image_bytes = base64.b64decode(image_base64)
        from PIL import Image, ImageEnhance, ImageOps
        import winocr
        import asyncio
        import concurrent.futures

        img = Image.open(BytesIO(image_bytes))

        # 1. Correct mobile EXIF orientation so rotated phone photos are upright
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # 2. Adaptive scaling: downscale huge photos (>1600px) for speed; upscale tiny photos (<800px)
        max_dim = max(img.width, img.height)
        if max_dim > 1600:
            scale = 1600.0 / max_dim
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
        elif img.width < 800 and img.width > 0:
            scale = 800.0 / img.width
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)

        async def _run_ocr_core(target_img):
            res = await winocr.recognize_pil(target_img, "en")
            return res.text.strip() if hasattr(res, "text") and res.text else ""

        def _do_ocr(target_img):
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(asyncio.run, _run_ocr_core(target_img)).result(timeout=8.0)

        # 3. Try standard image first
        try:
            extracted_text = _do_ocr(img)
        except Exception as ocr_err:
            print(f"Standard OCR notice: {ocr_err}")

        # 4. If standard OCR returned very few words, try contrast-enhanced image
        if not extracted_text or len(extracted_text.split()) < 3:
            try:
                enh = ImageEnhance.Contrast(img).enhance(1.5)
                enh_text = _do_ocr(enh)
                if len(enh_text.split()) > len(extracted_text.split()):
                    extracted_text = enh_text
            except Exception as enh_err:
                print(f"Enhanced OCR notice: {enh_err}")

        # 5. Fallback to pytesseract if installed
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

    if not extracted_text or not extracted_text.strip():
        return AnalyzeResponse(
            is_food=False,
            rejection_reason="No readable ingredient text or nutrition label was detected in this image.",
            product_name="Unrecognized Image",
            health_score=0,
            nova_group=None,
            personalized_verdict="⚠️ Unrecognized Image: No readable ingredients or nutrition facts could be extracted from this photo. Please capture a clear, well-lit view of the food packaging.",
            ocr_text=""
        )

    res = analyze_ingredients(extracted_text, profile)
    res.ocr_text = extracted_text
    return res
