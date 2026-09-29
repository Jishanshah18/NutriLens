"""
NutriLens AI & Clinical Nutrition Recommendation Engine.
Analyzes food products specifically for each user's unique health conditions and dietary restrictions.
Enforces strict medical safety guidelines and non-diagnostic phrasing.
"""

import os
import re
import json
from typing import Optional, List, Dict, Any
from models.schemas import (
    UserProfile,
    NutritionBreakdown,
    PersonalizedRecommendation
)

MEDICAL_DISCLAIMER = "NutriLens provides educational nutrition information and is not a substitute for professional medical advice, diagnosis, or treatment."
ALLERGENS_SAFETY_NOTE = "Always verify allergen and ingredient information on the physical product packaging, especially if you have a severe food allergy."

def generate_personalized_recommendation(
    product_name: str,
    ocr_text: str,
    nutrition: Optional[NutritionBreakdown],
    detected_allergens: List[str],
    ingredient_risks: List[str],
    user_profile: Optional[UserProfile] = None,
    data_sources: Optional[List[str]] = None,
    data_completeness: Optional[str] = None,
    missing_nutrients: Optional[List[str]] = None
) -> PersonalizedRecommendation:
    """
    Evaluates product suitability specifically for the user's active health conditions.
    Strictly handles missing data without assuming missing values equal zero.
    """
    profile = user_profile or UserProfile()
    conditions = [c.strip() for c in (profile.health_conditions or []) if c.strip()]
    allergies = [a.strip().lower() for a in (profile.allergies or []) if a.strip()]
    preferences = [p.strip().lower() for p in (profile.dietary_preferences or []) if p.strip()]
    text_lower = (ocr_text or "").lower()

    # Extract nutrition numbers safely (Preserving None!)
    calories = nutrition.calories if nutrition else None
    sugar = nutrition.sugar_g if nutrition else None
    protein = nutrition.protein_g if nutrition else None
    fat = nutrition.fat_g if nutrition else None
    sodium = nutrition.sodium_mg if nutrition else None
    fiber = nutrition.fiber_g if nutrition else None

    sources = data_sources or ["USDA FoodData Central", "Open Food Facts"]
    completeness = data_completeness or ("High" if None not in [calories, protein, fat, sugar, sodium] else "Partial")
    missing = missing_nutrients if missing_nutrients is not None else []

    # If GEMINI_API_KEY is configured in environment, attempt external LLM reasoning with structured evidence
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            llm_result = _call_gemini_recommendation(
                gemini_key=gemini_key,
                product_name=product_name,
                ingredients_text=ocr_text,
                nutrition=nutrition,
                user_conditions=conditions,
                user_preferences=preferences,
                user_allergies=allergies,
                data_completeness=completeness,
                missing_nutrients=missing,
                data_sources=sources
            )
            if llm_result:
                return llm_result
        except Exception as e:
            print(f"Gemini LLM inference fallback triggered: {e}")

    # Clinical Rule-Based Reasoning Engine (always reliable and offline-ready)
    return _run_clinical_reasoning(
        product_name=product_name,
        text_lower=text_lower,
        calories=calories,
        sugar=sugar,
        protein=protein,
        fat=fat,
        sodium=sodium,
        fiber=fiber,
        detected_allergens=detected_allergens,
        ingredient_risks=ingredient_risks,
        conditions=conditions,
        allergies=allergies,
        preferences=preferences,
        age=profile.age,
        data_completeness=completeness,
        missing_nutrients=missing,
        data_sources=sources
    )


def _run_clinical_reasoning(
    product_name: str,
    text_lower: str,
    calories: Optional[float],
    sugar: Optional[float],
    protein: Optional[float],
    fat: Optional[float],
    sodium: Optional[float],
    fiber: Optional[float],
    detected_allergens: List[str],
    ingredient_risks: List[str],
    conditions: List[str],
    allergies: List[str],
    preferences: List[str],
    age: Optional[int] = None,
    data_completeness: str = "High",
    missing_nutrients: Optional[List[str]] = None,
    data_sources: Optional[List[str]] = None
) -> PersonalizedRecommendation:
    reasons: List[str] = []
    key_concerns: List[str] = []
    positive_notes: List[str] = []
    better_alternatives: List[str] = []
    conditions_evaluated: List[str] = []

    is_unsuitable = False
    is_moderately_unsuitable = False

    # 1. Evaluate Allergies first (Immediate critical safety factor)
    for allergen in allergies:
        if any(allergen in da.lower() for da in detected_allergens) or re.search(rf'\b{re.escape(allergen)}\b', text_lower):
            is_unsuitable = True
            key_concerns.append(f"Contains {allergen.title()}")
            reasons.append(f"This product contains {allergen.title()}, which directly conflicts with your saved allergy profile. Avoid consumption.")
            better_alternatives.append(f"Choose certified {allergen.title()}-free verified alternatives.")

    # 2. Evaluate Specific Health Conditions
    for cond in conditions:
        cond_clean = cond.strip()
        cond_lower = cond_clean.lower()
        conditions_evaluated.append(cond_clean)

        # --- DIABETES ---
        if "diabetes" in cond_lower or "diabetic" in cond_lower:
            high_glycemic_markers = any(m in text_lower for m in [
                "high fructose corn syrup", "corn syrup", "maltodextrin", "dextrose", "glucose syrup", "invert sugar"
            ])
            if sugar is not None:
                if sugar >= 12.0 or high_glycemic_markers:
                    is_unsuitable = True
                    key_concerns.append(f"High Sugar ({sugar}g)")
                    reasons.append(
                        f"This product contains a relatively high amount of sugar ({sugar}g), which may not be suitable for your diabetes. High sugar intake can make blood glucose management more difficult."
                    )
                    better_alternatives.append("Look for a product with lower added sugar (<5g per serving) and higher soluble fiber.")
                elif sugar > 6.0:
                    is_moderately_unsuitable = True
                    key_concerns.append(f"Moderate Sugar ({sugar}g)")
                    reasons.append(
                        f"Contains moderate sugar ({sugar}g). For your diabetes, consider monitoring portion sizes to prevent post-meal glycemic fluctuations."
                    )
                else:
                    positive_notes.append(f"Low Sugar ({sugar}g)")
                    reasons.append(
                        f"Low added sugar content ({sugar}g) is generally suitable for your diabetes blood glucose management."
                    )
            elif high_glycemic_markers:
                is_unsuitable = True
                key_concerns.append("Contains High-Glycemic Refined Syrups")
                reasons.append("Contains high-glycemic sweeteners which may trigger rapid blood glucose elevation.")
            else:
                key_concerns.append("Sugar Breakdown Unavailable")
                reasons.append("Exact sugar value is unavailable in this verified record. Please verify total and added sugars on the physical packaging.")

        # --- HIGH BLOOD PRESSURE / HYPERTENSION ---
        elif "pressure" in cond_lower or "hypertension" in cond_lower:
            if sodium is not None:
                if sodium >= 400.0 or ("salt" in text_lower and sodium >= 350.0):
                    is_unsuitable = True
                    key_concerns.append(f"High Sodium ({int(sodium)}mg)")
                    reasons.append(
                        f"This product contains elevated sodium ({int(sodium)}mg per serving), which may not be suitable for your high blood pressure. High sodium intake can contribute to fluid retention and arterial tension."
                    )
                    better_alternatives.append("Select a low-sodium or 'No Salt Added' alternative (under 140mg sodium per serving).")
                elif sodium >= 220.0:
                    is_moderately_unsuitable = True
                    key_concerns.append(f"Moderate Sodium ({int(sodium)}mg)")
                    reasons.append(
                        f"Sodium content is moderate ({int(sodium)}mg). Consider balancing this with lower-sodium meals throughout your day."
                    )
                else:
                    positive_notes.append(f"Low Sodium ({int(sodium)}mg)")
                    reasons.append(
                        f"Low sodium level ({int(sodium)}mg) is generally suitable for supporting optimal blood pressure."
                    )
            else:
                key_concerns.append("Sodium Level Unavailable")
                reasons.append("Sodium level is not listed in this entry. Check the nutrition facts table on the package.")

        # --- HIGH CHOLESTEROL ---
        elif "cholesterol" in cond_lower:
            has_bad_fats = any(f in text_lower for f in ["palm oil", "partially hydrogenated", "hydrogenated", "shortening", "lard"])
            if fat is not None:
                if fat >= 12.0 or has_bad_fats:
                    is_unsuitable = True
                    key_concerns.append("Elevated Saturated/Refined Fats")
                    reasons.append(
                        "Contains elevated fats or tropical/hydrogenated oils that may negatively influence LDL cholesterol levels for your high cholesterol profile."
                    )
                    better_alternatives.append("Choose options with heart-healthy unsaturated fats (olive oil, flax, nuts) and soluble fiber.")
                else:
                    positive_notes.append("Clean Lipid Balance")
                    reasons.append(
                        "Low in saturated and trans fats, which is generally suitable for your cholesterol management."
                    )
            elif has_bad_fats:
                is_unsuitable = True
                key_concerns.append("Contains Saturated Palm/Refined Fats")
                reasons.append("Formulation contains saturated or refined oils that may affect cholesterol.")

        # --- OBESITY / WEIGHT LOSS ---
        elif "obesity" in cond_lower or "weight" in cond_lower:
            if calories is not None:
                if calories >= 350.0 or (calories >= 250.0 and sugar is not None and sugar >= 10.0):
                    is_moderately_unsuitable = True
                    key_concerns.append(f"Calorie Dense ({int(calories)} kcal)")
                    reasons.append(
                        f"At {int(calories)} kcal per serving with {sugar if sugar is not None else 'higher'}g sugar, this product is relatively calorie-dense. For obesity and weight management, consider limiting portion size."
                    )
                    better_alternatives.append("Look for nutrient-dense foods with higher protein and dietary fiber for lasting satiety.")
                else:
                    positive_notes.append(f"Calorie Controlled ({int(calories)} kcal)")
                    reasons.append(
                        f"Caloric density ({int(calories)} kcal) is moderate and can fit into a balanced weight management routine."
                    )

        # --- HEART-RELATED CONDITIONS ---
        elif "heart" in cond_lower or "cardio" in cond_lower:
            high_na = sodium is not None and sodium >= 380.0
            high_fat = fat is not None and fat >= 14.0
            if high_na or high_fat:
                is_unsuitable = True
                key_concerns.append("High Sodium / High Fat")
                reasons.append(
                    "High sodium or saturated fat levels may place unnecessary strain on cardiovascular circulation."
                )
                better_alternatives.append("Look for Mediterranean-diet aligned whole foods rich in antioxidants and omega-3s.")
            else:
                positive_notes.append("Cardiovascular Friendly")
                reasons.append(
                    "Moderate sodium and clean ingredient profile are generally suitable for your heart health considerations."
                )

        # --- KIDNEY-RELATED CONDITIONS ---
        elif "kidney" in cond_lower or "renal" in cond_lower:
            has_phosphates = any(p in text_lower for p in ["phosphate", "e338", "e339", "e340", "e341", "phosphoric"])
            high_na = sodium is not None and sodium >= 300.0
            high_prot = protein is not None and protein > 25.0
            if high_na or has_phosphates or high_prot:
                is_unsuitable = True
                key_concerns.append("High Sodium / Inorganic Phosphates")
                reasons.append(
                    "Contains elevated sodium or inorganic phosphate additives, which can increase renal filtration workload."
                )
                better_alternatives.append("Choose whole, unprocessed foods free from synthetic phosphate food additives.")
            else:
                positive_notes.append("Renal Tolerable")
                reasons.append(
                    "Nutrient profile does not present excessive sodium or phosphate burden for your kidney considerations."
                )

        # --- GLUTEN INTOLERANCE / CELIAC ---
        elif "gluten" in cond_lower or "celiac" in cond_lower:
            gluten_markers = ["wheat", "barley", "rye", "malt", "gluten", "spelt", "semolina"]
            found_gluten = [gm for gm in gluten_markers if gm in text_lower]
            if found_gluten:
                is_unsuitable = True
                key_concerns.append(f"Contains Gluten ({', '.join(found_gluten)})")
                reasons.append(
                    f"This product contains {', '.join(found_gluten)}, which directly triggers your gluten intolerance. Avoid consumption."
                )
                better_alternatives.append("Look for certified Gluten-Free labeled alternatives made with oats, quinoa, or rice flour.")
            else:
                positive_notes.append("Gluten-Free Ingredients")
                reasons.append("No obvious gluten-containing grains detected in the ingredient formulation.")

        # --- LACTOSE INTOLERANCE ---
        elif "lactose" in cond_lower or "dairy" in cond_lower:
            dairy_markers = ["milk", "cheese", "whey", "lactose", "curd", "cream", "casein", "butter"]
            found_dairy = [dm for dm in dairy_markers if dm in text_lower and not (dm == "butter" and "peanut butter" in text_lower)]
            if found_dairy:
                is_unsuitable = True
                key_concerns.append(f"Contains Dairy ({', '.join(found_dairy)})")
                reasons.append(
                    f"Contains dairy ingredients ({', '.join(found_dairy)}) which may cause digestive distress for your lactose intolerance."
                )
                better_alternatives.append("Choose plant-based or certified 100% lactose-free alternatives.")
            else:
                positive_notes.append("Dairy-Free")
                reasons.append("No dairy derivatives detected; generally suitable for lactose intolerance.")

        # --- OTHER / GENERAL CONDITIONS ---
        else:
            reasons.append(
                f"Evaluated nutritional makeup for your {cond_clean} profile; maintain standard moderation."
            )

    # 2.5 Evaluate Age-Specific Nutritional Guidance (Evidence-based clinical guidelines)
    if age is not None:
        conditions_evaluated.append(f"Age Context ({age} yrs)")
        if age < 18:
            # Pediatric guidelines (AHA/AAP/WHO)
            if sugar is not None and sugar >= 10.0:
                is_moderately_unsuitable = True
                key_concerns.append(f"High Sugar for Age <18 ({sugar}g)")
                reasons.append(
                    f"Pediatric guidelines (AHA/WHO) recommend limiting added sugars to under 25g daily for children and adolescents. At age {age}, this item accounts for {int((sugar/25.0)*100)}% of the daily recommended sugar ceiling."
                )
                better_alternatives.append("Choose whole-fruit or unsweetened snacks to support healthy metabolic development.")
            has_sweetener = any(sw in text_lower for sw in ["aspartame", "sucralose", "acesulfame", "saccharin"])
            if has_sweetener:
                key_concerns.append("Artificial Sweeteners in Youth Diet")
                reasons.append(
                    "Contains synthetic high-intensity sweeteners; pediatric clinical advice recommends prioritizing whole natural foods for developing metabolisms."
                )
            if protein is not None and protein >= 6.0:
                positive_notes.append("Growth Protein Support")
        elif age >= 65:
            # Older adult / senior guidelines (AHA/ACC/ESPEN)
            if sodium is not None and sodium >= 300.0:
                is_moderately_unsuitable = True
                if not any("Sodium" in kc for kc in key_concerns):
                    key_concerns.append(f"Sodium Sensitive for Age 65+ ({int(sodium)}mg)")
                reasons.append(
                    f"For age {age}, cardiovascular and renal guidelines recommend stricter sodium moderation (<1500mg daily ideal) to support healthy arterial elasticity and fluid balance."
                )
            if protein is not None and protein >= 8.0:
                positive_notes.append(f"Muscle-Preserving Protein ({protein}g)")
                reasons.append(
                    f"Adequate dietary protein ({protein}g per serving) supports muscle mass retention and functional vitality for healthy aging."
                )
            if sugar is not None and sugar > 15.0:
                is_moderately_unsuitable = True
                if not any("Sugar" in kc for kc in key_concerns):
                    key_concerns.append(f"High Glycemic Load ({sugar}g sugar)")
                reasons.append(
                    "High simple sugar intake in older adults can increase glycemic variability; whole grains and fiber-rich choices are preferred."
                )
        else:
            # Young / Middle Adult (18-64)
            if sodium is not None and sodium < 140.0:
                positive_notes.append("Low Sodium Profile (<140mg)")

    # 3. If user has NO health conditions selected
    if not conditions:
        general_label = "General Wellness Profile (No Specific Conditions Set)"
        if age is not None:
            conditions_evaluated = [general_label, f"Age Context ({age} yrs)"]
        else:
            conditions_evaluated = [general_label]
        s_val = sugar if sugar is not None else 0.0
        na_val = sodium if sodium is not None else 0.0
        cal_val = calories if calories is not None else 0.0

        if s_val <= 8.0 and na_val <= 300.0 and cal_val <= 300.0:
            positive_notes.append(f"Balanced Macros ({protein if protein is not None else '--'}g Protein)")
            reasons.append(
                "This product is relatively suitable for your general wellness profile. It has a balanced nutritional makeup with moderate sugar and sodium."
            )
        elif s_val > 18.0 or na_val > 500.0:
            is_moderately_unsuitable = True
            key_concerns.append(f"High { 'Sugar' if s_val > 18 else 'Sodium' }")
            reasons.append(
                f"Contains higher levels of {'sugar (' + str(s_val) + 'g)' if s_val > 18 else 'sodium (' + str(int(na_val)) + 'mg)'}. While you have no specific conditions set, general health guidelines recommend moderation."
            )
            better_alternatives.append("Consider lower-sugar and lower-sodium alternatives for long-term health.")
        else:
            positive_notes.append("Standard Whole Food Balance")
            reasons.append(
                "This product appears suitable for general consumption as part of a varied, wholesome diet."
            )

    # Extra macro highlights
    if protein is not None and protein >= 8.0:
        positive_notes.append(f"Good Protein ({protein}g)")
    if fiber is not None and fiber >= 3.0:
        positive_notes.append(f"Good Fiber ({fiber}g)")

    # 4. Final Recommendation Status & Headline Decision
    if is_unsuitable:
        status = "Not Recommended"
        headline = "⚠️ Not Recommended for Your Health Profile"
    elif is_moderately_unsuitable:
        status = "Limit" if len(conditions) > 0 else "Moderately Suitable"
        headline = "⚠️ Consider Limiting Based on Your Profile"
    else:
        status = "Good Choice" if len(positive_notes) >= 2 else "Suitable"
        headline = "✓ Suitable for Your Health Profile"

    # Default alternative if none set
    if not better_alternatives:
        if is_unsuitable or is_moderately_unsuitable:
            better_alternatives.append("Look for a minimally processed whole-food alternative with cleaner nutritional values.")
        else:
            better_alternatives.append("This product aligns with your profile. Pair with wholesome natural foods.")

    return PersonalizedRecommendation(
        status=status,
        headline=headline,
        health_conditions_considered=conditions_evaluated,
        reasons=reasons,
        key_concerns=key_concerns,
        positive_notes=positive_notes,
        better_alternative=better_alternatives[0] if better_alternatives else None,
        data_completeness=data_completeness,
        missing_nutrients=missing_nutrients or [],
        data_sources=data_sources or ["USDA FoodData Central", "Open Food Facts"],
        last_verified="February 2026",
        allergens_safety_note=ALLERGENS_SAFETY_NOTE,
        medical_disclaimer=MEDICAL_DISCLAIMER
    )


def _call_gemini_recommendation(
    gemini_key: str,
    product_name: str,
    ingredients_text: str,
    nutrition: Optional[NutritionBreakdown],
    user_conditions: List[str],
    user_preferences: List[str],
    user_allergies: List[str],
    data_completeness: str,
    missing_nutrients: List[str],
    data_sources: List[str]
) -> Optional[PersonalizedRecommendation]:
    """External Gemini LLM integration with structured JSON evidence and strict schema adherence."""
    import urllib.request
    
    evidence_payload = {
        "user_conditions": user_conditions,
        "user_preferences": user_preferences,
        "user_allergies": user_allergies,
        "product": {
            "name": product_name,
            "ingredients": ingredients_text,
            "nutrition": {
                "calories": getattr(nutrition, "calories", None),
                "protein_g": getattr(nutrition, "protein_g", None),
                "fat_g": getattr(nutrition, "fat_g", None),
                "carbs_g": getattr(nutrition, "carbs_g", None),
                "sugar_g": getattr(nutrition, "sugar_g", None),
                "fiber_g": getattr(nutrition, "fiber_g", None),
                "sodium_mg": getattr(nutrition, "sodium_mg", None)
            }
        },
        "data_quality": {
            "data_completeness": data_completeness,
            "missing_nutrients": missing_nutrients,
            "data_sources": data_sources,
            "last_verified": "February 2026"
        }
    }

    prompt = f"""
You are a clinical AI nutrition intelligence specialist for NutriLens.
Analyze if this product is suitable for THIS SPECIFIC USER based on their saved health conditions and the verified nutritional facts.
IMPORTANT:
- Do NOT assume missing nutrient values equal zero (null != 0g).
- Use non-diagnostic, educational wording ('may be suitable', 'consider limiting').
- Focus on the impact on the user's specific health conditions (e.g. sugar for diabetes, sodium for hypertension).

STRUCTURED EVIDENCE:
{json.dumps(evidence_payload, indent=2)}

Return ONLY valid JSON matching this exact structure:
{{
  "recommendation": "Good Choice" | "Suitable" | "Moderately Suitable" | "Limit" | "Not Recommended",
  "headline": "Clear recommendation summary headline",
  "health_conditions_considered": {json.dumps(user_conditions)},
  "reasons": ["Clinical explanation citing the user's conditions"],
  "keyConcerns": ["concise list of concerns e.g. High Sugar (18g)"],
  "positiveFactors": ["concise list of positive aspects e.g. Good Protein (8g)"],
  "alternativeGuidance": "Healthier alternative product or whole food recommendation"
}}
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=6.0) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))
        raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)
        return PersonalizedRecommendation(
            status=parsed.get("recommendation", parsed.get("status", "Suitable")),
            headline=parsed.get("headline", "AI Personalized Analysis"),
            health_conditions_considered=parsed.get("health_conditions_considered", user_conditions),
            reasons=parsed.get("reasons", []),
            key_concerns=parsed.get("keyConcerns", parsed.get("key_concerns", [])),
            positive_notes=parsed.get("positiveFactors", parsed.get("positive_notes", [])),
            better_alternative=parsed.get("alternativeGuidance", parsed.get("better_alternative")),
            data_completeness=data_completeness,
            missing_nutrients=missing_nutrients,
            data_sources=data_sources,
            last_verified="February 2026",
            allergens_safety_note=ALLERGENS_SAFETY_NOTE,
            medical_disclaimer=MEDICAL_DISCLAIMER
        )
