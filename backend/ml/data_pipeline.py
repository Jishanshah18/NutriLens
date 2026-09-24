"""
NutriLens Data Preprocessing & Quality Pipeline.
Processes raw datasets:
1. USDA FoodData Central (~40,000 foods)
2. Open Food Facts (~5,000 products) - February 2026
Normalizes units, cleans typography, strictly preserves unavailable values (null ≠ 0g),
computes data completeness ratings, and generates stratified train/validation/test sets.
"""

import os
import re
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple

# Base paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
TRAINING_DIR = os.path.join(DATA_DIR, "training")

RAW_SOURCE_DIR = os.path.join(
    os.path.dirname(BASE_DIR),
    "FINAL FOOD DATASET",
    "Diet Nutrition"
)

USDA_RAW_FILE = os.path.join(RAW_SOURCE_DIR, "comprehensive_foods_usda.csv")
OFF_RAW_FILE = os.path.join(RAW_SOURCE_DIR, "foods_health_scores_allergens.csv")


def clean_text(text: Any) -> str:
    """Standardize string formatting and strip extra whitespace/symbols."""
    if pd.isna(text) or not isinstance(text, str):
        return ""
    cleaned = re.sub(r'[\r\n\t]+', ' ', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def clean_ingredients_for_tokens(text: Any) -> str:
    """Extract clean ingredient tokens for NLP/TF-IDF while keeping additive E-codes."""
    if pd.isna(text) or not isinstance(text, str):
        return ""
    cleaned = text.lower()
    cleaned = re.sub(r'[\(\)\[\]\{\}\*:\.;,/]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def clean_numeric(val: Any, min_val: float = 0.0, max_val: float = 10000.0) -> Any:
    """
    Safely convert to float while strictly preserving missing values as None/NaN.
    Does NOT impute zeros for missing values.
    """
    if pd.isna(val) or val is None or val == "":
        return np.nan
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return np.nan
        if f < min_val:
            return np.nan
        if f > max_val:
            return np.nan
        return round(f, 2)
    except (ValueError, TypeError):
        return np.nan


def compute_data_completeness(row: Dict[str, Any]) -> Tuple[str, list]:
    """
    Calculates transparency data completeness rating without assuming missing=0.
    """
    core_macros = ["calories", "protein_g", "fat_g", "carbs_g"]
    secondary_nutrients = ["sugar_g", "fiber_g", "sodium_mg"]
    
    missing_fields = []
    for field in core_macros + secondary_nutrients:
        val = row.get(field)
        if pd.isna(val) or val is None:
            missing_fields.append(field)

    if len(missing_fields) == 0:
        return "High", []
    elif len(missing_fields) <= 2:
        return "Partial", missing_fields
    else:
        return "Low", missing_fields


def load_and_clean_usda(file_path: str = USDA_RAW_FILE) -> pd.DataFrame:
    """Preprocess and normalize USDA FoodData Central (40,000 foods)."""
    print(f"Loading USDA FoodData Central from {file_path}...")
    df = pd.read_csv(file_path, low_memory=False)
    print(f"Raw USDA records: {len(df)}")

    processed_rows = []
    for _, r in df.iterrows():
        name = clean_text(r.get("food_name", ""))
        if not name or len(name) < 2:
            continue

        brand = clean_text(r.get("brand_name") or r.get("brand_owner") or "")
        category = clean_text(r.get("food_category") or "")
        raw_ingredients = clean_text(r.get("ingredients") or "")
        token_ingredients = clean_ingredients_for_tokens(raw_ingredients or name)

        calories = clean_numeric(r.get("calories"), max_val=950.0)
        protein = clean_numeric(r.get("protein_g"), max_val=100.0)
        fat = clean_numeric(r.get("fat_g"), max_val=100.0)
        carbs = clean_numeric(r.get("carbs_g"), max_val=100.0)
        sugar = clean_numeric(r.get("sugar_g"), max_val=100.0)
        fiber = clean_numeric(r.get("fiber_g"), max_val=100.0)
        sodium = clean_numeric(r.get("sodium_mg"), max_val=30000.0)
        saturated_fat = clean_numeric(r.get("saturated_fat_g"), max_val=100.0)
        health_score = clean_numeric(r.get("health_score"), min_val=0.0, max_val=100.0)

        # Estimate NOVA group based on ingredients & degree of processing
        # USDA entries with multiple industrial additives/sugars/refined fats are NOVA 4
        nova_group = 1
        ing_lower = raw_ingredients.lower()
        if any(marker in ing_lower for marker in ["high fructose", "hydrogenated", "artificial flavor", "preservative", "e621", "msg", "caramel color", "palm oil", "emulsifier"]):
            nova_group = 4
        elif any(marker in ing_lower for marker in ["sugar", "salt", "oil", "syrup", "dextrose"]):
            nova_group = 3
        elif len(raw_ingredients) > 50:
            nova_group = 2
        else:
            nova_group = 1

        row_dict = {
            "source_id": str(r.get("fdc_id", "")),
            "food_name": name,
            "brand": brand or "USDA Verified Food",
            "category": category or "Whole / General Food",
            "ingredients_text": raw_ingredients or name,
            "ingredients_tokens": token_ingredients,
            "calories": calories,
            "protein_g": protein,
            "fat_g": fat,
            "carbs_g": carbs,
            "sugar_g": sugar,
            "fiber_g": fiber,
            "sodium_mg": sodium,
            "saturated_fat_g": saturated_fat,
            "health_score": health_score if not pd.isna(health_score) else (85.0 if nova_group <= 2 else 55.0),
            "nova_group": nova_group,
            "allergens": "",
            "data_source": "USDA FoodData Central",
            "last_verified": "February 2026"
        }

        completeness, missing = compute_data_completeness(row_dict)
        row_dict["data_completeness"] = completeness
        row_dict["missing_nutrients"] = json.dumps(missing)

        processed_rows.append(row_dict)

    out_df = pd.DataFrame(processed_rows)
    print(f"Processed USDA records: {len(out_df)}")
    return out_df


def load_and_clean_openfoodfacts(file_path: str = OFF_RAW_FILE) -> pd.DataFrame:
    """Preprocess and normalize Open Food Facts (~5,000 products)."""
    print(f"Loading Open Food Facts from {file_path}...")
    df = pd.read_csv(file_path, low_memory=False)
    print(f"Raw Open Food Facts records: {len(df)}")

    processed_rows = []
    for idx, r in df.iterrows():
        name = clean_text(r.get("product_name", ""))
        if not name or len(name) < 2:
            continue

        brand = clean_text(r.get("brands") or "")
        category = clean_text(r.get("categories") or "")
        raw_ingredients = clean_text(r.get("ingredients") or "")
        token_ingredients = clean_ingredients_for_tokens(raw_ingredients or name)

        calories = clean_numeric(r.get("energy_kcal"), max_val=950.0)
        protein = clean_numeric(r.get("proteins_100g"), max_val=100.0)
        fat = clean_numeric(r.get("fat_100g"), max_val=100.0)
        carbs = clean_numeric(r.get("carbs_100g"), max_val=100.0)
        sugar = clean_numeric(r.get("sugars_100g"), max_val=100.0)
        fiber = clean_numeric(r.get("fiber_100g"), max_val=100.0)
        
        # OFF sodium_100g is in grams -> convert to mg
        sodium_g = clean_numeric(r.get("sodium_100g"), max_val=30.0)
        sodium_mg = round(sodium_g * 1000.0, 2) if not pd.isna(sodium_g) else np.nan
        saturated_fat = clean_numeric(r.get("saturated_fat_100g"), max_val=100.0)

        # NOVA Group
        raw_nova = r.get("nova_group")
        try:
            nova_group = int(float(raw_nova)) if not pd.isna(raw_nova) else 3
            if nova_group not in [1, 2, 3, 4]:
                nova_group = 3
        except (ValueError, TypeError):
            nova_group = 3

        # Nutri-score to health score approximation
        nutriscore = str(r.get("nutriscore_grade", "")).lower().strip()
        score_map = {"a": 92.0, "b": 78.0, "c": 62.0, "d": 45.0, "e": 28.0}
        health_score = score_map.get(nutriscore, 60.0)

        # Assemble allergens
        allergens_list = []
        if r.get("contains_gluten") is True: allergens_list.append("Gluten")
        if r.get("contains_dairy") is True: allergens_list.append("Dairy")
        if r.get("contains_nuts") is True: allergens_list.append("Nuts")
        if r.get("contains_soy") is True: allergens_list.append("Soy")
        if r.get("contains_eggs") is True: allergens_list.append("Eggs")
        if r.get("contains_fish") is True: allergens_list.append("Fish")
        allergens_str = ", ".join(allergens_list)

        row_dict = {
            "source_id": f"OFF_{idx}",
            "food_name": name,
            "brand": brand or "Packaged Food Brand",
            "category": category or "Packaged Groceries",
            "ingredients_text": raw_ingredients or name,
            "ingredients_tokens": token_ingredients,
            "calories": calories,
            "protein_g": protein,
            "fat_g": fat,
            "carbs_g": carbs,
            "sugar_g": sugar,
            "fiber_g": fiber,
            "sodium_mg": sodium_mg,
            "saturated_fat_g": saturated_fat,
            "health_score": health_score,
            "nova_group": nova_group,
            "allergens": allergens_str,
            "data_source": "Open Food Facts",
            "last_verified": "February 2026"
        }

        completeness, missing = compute_data_completeness(row_dict)
        row_dict["data_completeness"] = completeness
        row_dict["missing_nutrients"] = json.dumps(missing)

        processed_rows.append(row_dict)

    out_df = pd.DataFrame(processed_rows)
    print(f"Processed Open Food Facts records: {len(out_df)}")
    return out_df


def run_pipeline() -> pd.DataFrame:
    """Executes the full extraction, cleaning, deduplication, and export pipeline."""
    print("=============================================================")
    print("   NutriLens Data Preprocessing & Quality Pipeline Starting  ")
    print("=============================================================")

    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    os.makedirs(TRAINING_DIR, exist_ok=True)

    df_usda = load_and_clean_usda()
    df_off = load_and_clean_openfoodfacts()

    # Merge datasets
    combined_df = pd.concat([df_usda, df_off], ignore_index=True)
    print(f"\nTotal merged records before deduplication: {len(combined_df)}")

    # Deduplicate based on lowercase food name + brand
    combined_df["dedup_key"] = (combined_df["food_name"].str.lower() + "_" + combined_df["brand"].str.lower())
    combined_df.drop_duplicates(subset=["dedup_key"], keep="first", inplace=True)
    combined_df.drop(columns=["dedup_key"], inplace=True)
    print(f"Total unique verified food items after deduplication: {len(combined_df)}")

    # Data Quality & Missingness Report
    print("\n--- Data Quality & Completeness Report ---")
    total = len(combined_df)
    for col in ["calories", "protein_g", "fat_g", "carbs_g", "sugar_g", "fiber_g", "sodium_mg"]:
        missing = combined_df[col].isna().sum()
        pct = (missing / total) * 100
        print(f"  {col:16s}: {missing:6d} unavailable ({pct:5.2f}%) | Available: {total - missing:6d} ({100-pct:5.2f}%)")

    completeness_dist = combined_df["data_completeness"].value_counts().to_dict()
    print(f"Completeness Breakdown: {completeness_dist}")

    # Export Processed Master Dataset
    master_csv_path = os.path.join(PROCESSED_DIR, "combined_food_dataset.csv")
    combined_df.to_csv(master_csv_path, index=False, encoding="utf-8")
    print(f"\nMaster processed dataset saved to: {master_csv_path}")

    # Generate Stratified Train / Test split for ML
    print("\nGenerating Train (80%) and Test (20%) dataset splits...")
    from sklearn.model_selection import train_test_split
    
    # Stratify by nova_group
    train_df, test_df = train_test_split(
        combined_df,
        test_size=0.2,
        random_state=42,
        stratify=combined_df["nova_group"]
    )
    
    train_csv_path = os.path.join(TRAINING_DIR, "train_dataset.csv")
    test_csv_path = os.path.join(TRAINING_DIR, "test_dataset.csv")

    train_df.to_csv(train_csv_path, index=False, encoding="utf-8")
    test_df.to_csv(test_csv_path, index=False, encoding="utf-8")
    print(f"Training set: {len(train_df)} samples -> {train_csv_path}")
    print(f"Test set:     {len(test_df)} samples -> {test_csv_path}")
    print("=============================================================\n")

    return combined_df


if __name__ == "__main__":
    run_pipeline()
