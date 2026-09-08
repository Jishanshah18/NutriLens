"""
NutriLens Interactive Model Runner & Inference Demo.
Run this script to test the trained machine learning models on ingredient labels.
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.model_service import analyze_ingredients, load_models
from models.schemas import UserProfile


def run_demo():
    print("=" * 70)
    print("       NUTRILENS ML MODEL INFERENCE ENGINE")
    print("=" * 70)

    # 1. Warm-up and load models
    load_models()

    # 2. Sample test cases
    sample_cases = [
        {
            "name": "Organic Fresh Green Apple",
            "ingredients": "Organic fresh green apples",
            "profile": UserProfile()
        },
        {
            "name": "Whole Grain Rolled Oats & Chia",
            "ingredients": "100% whole grain rolled oats, organic chia seeds, ground cinnamon",
            "profile": UserProfile()
        },
        {
            "name": "Milk Chocolate Chip Cookies",
            "ingredients": "Enriched flour, palm oil, sugar, cocoa butter, whole milk powder, soy lecithin E322, artificial vanilla flavor, high fructose corn syrup, salt",
            "profile": UserProfile(dietary_preferences=["Low Sugar"], health_goals=["Weight Loss"])
        },
        {
            "name": "Carbonated Energy Drink",
            "ingredients": "Carbonated water, sucrose, glucose, citric acid E330, taurine, sodium benzoate E211, artificial caffeine, red 40 E129",
            "profile": UserProfile()
        },
        {
            "name": "Peanut Butter Crunch Granola Bar (Nut Allergy User)",
            "ingredients": "Whole grain rolled oats, roasted peanuts, peanut butter, brown rice syrup, sea salt",
            "profile": UserProfile(allergies=["Peanuts"])
        }
    ]

    for idx, item in enumerate(sample_cases, 1):
        print(f"\n[{idx}] Testing: {item['name']}")
        print(f"    Ingredients: {item['ingredients']}")
        if item['profile'].allergies or item['profile'].dietary_preferences:
            print(f"    User Profile: Allergies={item['profile'].allergies}, Prefs={item['profile'].dietary_preferences}")

        result = analyze_ingredients(item['ingredients'], user_profile=item['profile'])

        processing_levels = {
            1: "Whole / Minimally Processed Food",
            2: "Processed Culinary Ingredient",
            3: "Moderately Processed Food",
            4: "Ultra-Processed Formulation"
        }
        level_name = processing_levels.get(result.nova_group, "Whole Food")

        print(f"    -> Food Processing Level : {level_name}")
        print(f"    -> Health Score        : {result.health_score}/100")
        print(f"    -> Detected Allergens  : {result.allergen_flags if result.allergen_flags else 'None'}")
        
        additives_str = ", ".join([f"{a.code} ({a.name} - Risk: {a.risk_level})" for a in result.additives])
        print(f"    -> Additives / E-Codes : {additives_str if additives_str else 'None'}")
        
        if result.ingredient_risks:
            print(f"    -> Risk Flags          : {'; '.join(result.ingredient_risks)}")
            
        print(f"    -> Personalized Verdict: {result.personalized_verdict}")
        
        if result.healthier_alternatives:
            print("    -> Healthier Clean Alternatives:")
            for alt in result.healthier_alternatives[:2]:
                print(f"       * {alt.name} (Est. Score: {alt.estimated_health_score}) - {alt.reason}")

    print("\n" + "=" * 70)
    print("  MODEL RUN COMPLETED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_demo()
