"""
NutriLens End-to-End Machine Learning Pipeline Verification Test.
Validates dataset cleaning integrity, model serialization, inference accuracy,
allergen detection, and healthier alternative recommendations.
"""

import os
import sys
import json
import joblib
import pandas as pd

# Add backend directory to sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from services.model_service import analyze_ingredients, reload_models, _models
from models.schemas import UserProfile

MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def test_dataset_cleaning():
    print("\n--- 1. Testing Dataset Cleaning & Integrity ---")
    dataset_path = os.path.join(DATA_DIR, "cleaned_food_nutrients_dataset.csv")
    assert os.path.exists(dataset_path), f"Cleaned dataset missing at {dataset_path}"

    df = pd.read_csv(dataset_path)
    print(f"Verified dataset file exists with {len(df)} records.")
    assert len(df) >= 2395, f"Expected at least 2395 items, got {len(df)}"

    required_cols = [
        "product_name", "ingredients_text", "nova_group", "health_score",
        "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "sodium_mg"
    ]
    for col in required_cols:
        assert col in df.columns, f"Missing required column {col}"
        assert df[col].isna().sum() == 0, f"Found nulls in column {col}"

    # Verify ranges
    assert df["nova_group"].isin([1, 2, 3, 4]).all(), "NOVA groups must be 1, 2, 3, or 4"
    assert (df["health_score"] >= 5.0).all() and (df["health_score"] <= 100.0).all(), "Health scores out of range"
    assert (df["calories"] >= 0).all(), "Negative calories found"
    assert (df["sodium_mg"] >= 0).all(), "Negative sodium found"
    print("PASS: Dataset integrity and value ranges validated successfully.")


def test_model_artifacts():
    print("\n--- 2. Testing Model Artifacts & Metrics ---")
    required_artifacts = [
        "vectorizer.joblib",
        "nova_classifier.joblib",
        "health_score_regressor.joblib",
        "alternatives_index.joblib",
        "product_catalog.joblib",
        "training_metrics.json"
    ]
    for artifact in required_artifacts:
        path = os.path.join(MODELS_DIR, artifact)
        assert os.path.exists(path), f"Artifact {artifact} is missing!"
        size_kb = round(os.path.getsize(path) / 1024, 2)
        print(f"Artifact '{artifact}': {size_kb} KB")

    metrics_path = os.path.join(MODELS_DIR, "training_metrics.json")
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    print(f"Total training samples: {metrics['total_training_samples']}")
    print(f"NOVA Classifier Accuracy: {metrics['nova_classifier']['accuracy'] * 100:.2f}% (F1: {metrics['nova_classifier']['f1_score']:.4f})")
    print(f"Health Score Regressor MAE: {metrics['health_score_regressor']['mae']} pts (R2: {metrics['health_score_regressor']['r2_score']:.4f})")
    assert metrics["nova_classifier"]["accuracy"] >= 0.80, "Classifier accuracy below 80% threshold"
    assert metrics["health_score_regressor"]["mae"] <= 15.0, "Regressor MAE exceeds 15 points threshold"
    print("PASS: Model artifacts and performance metrics meet validation criteria.")


def test_inference():
    print("\n--- 3. Testing Local Inference Across Food Categories ---")
    reload_models()

    # Case A: Minimally processed fruit / whole food
    res_fruit = analyze_ingredients("Organic Fresh Blueberries\nIngredients: raw organic blueberries")
    print(f"[Case A: Blueberries] NOVA: {res_fruit.nova_group} | Score: {res_fruit.health_score} | Verdict: {res_fruit.personalized_verdict}")
    assert res_fruit.nova_group == 1, f"Expected NOVA 1 for blueberries, got {res_fruit.nova_group}"
    assert res_fruit.health_score >= 80, f"Expected high health score for blueberries, got {res_fruit.health_score}"

    # Case B: Ultra-processed snack with additives
    res_snack = analyze_ingredients(
        "Spicy Instant Ramen\nIngredients: wheat flour, palm oil, salt, monosodium glutamate E621, artificial chicken flavor, caramel color E150d, disodium inosinate, sugar"
    )
    print(f"[Case B: Ramen] NOVA: {res_snack.nova_group} | Score: {res_snack.health_score} | Additives: {[a.code for a in res_snack.additives]} | Alternatives: {[a.name for a in res_snack.healthier_alternatives]}")
    assert res_snack.nova_group == 4, f"Expected NOVA 4 for instant ramen, got {res_snack.nova_group}"
    assert res_snack.health_score < 50, f"Expected low health score for ultra-processed ramen, got {res_snack.health_score}"
    assert any(a.code == "E621" for a in res_snack.additives), "E621 (MSG) should be detected"
    assert len(res_snack.healthier_alternatives) > 0, "Expected healthier alternative suggestions"

    # Case C: Processed cheese with allergen check
    user_with_dairy_allergy = UserProfile(allergies=["Milk/Dairy"])
    res_cheese = analyze_ingredients(
        "Aged Sharp Cheddar Cheese\nIngredients: pasteurized cultured milk, salt, microbial enzymes",
        user_profile=user_with_dairy_allergy
    )
    print(f"[Case C: Cheese + Dairy Allergy] Score: {res_cheese.health_score} | Allergens: {res_cheese.allergen_flags} | Verdict: {res_cheese.personalized_verdict}")
    assert any(a in ["Lactose", "Milk/Dairy", "Milk", "Dairy"] for a in res_cheese.allergen_flags), "Expected Milk/Dairy allergen detected"
    assert "CRITICAL ALLERGEN ALERT" in res_cheese.personalized_verdict, "Expected allergen alert for dairy allergic user"

    print("PASS: Inference across all test cases succeeded with expected classifications and alerts.")


if __name__ == "__main__":
    test_dataset_cleaning()
    test_model_artifacts()
    test_inference()
    print("\n=======================================================")
    print("   ALL NUTRILENS ML PIPELINE TESTS PASSED SUCCESSFULLY! ")
    print("=======================================================\n")
