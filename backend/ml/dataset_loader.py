"""
NutriLens Dataset Loader & Normalizer.
Loads, normalizes, and merges CSV/JSON food datasets from the attached data directory.
Compatible with custom nutrition datasets and Open Food Facts export formats.
"""

import os
import glob
import re
import pandas as pd
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Column alias mappings to support varied dataset schemas (e.g. Open Food Facts, Kaggle, Custom)
COLUMN_ALIASES = {
    "product_name": ["product_name", "product", "food_name", "food", "name", "title", "item_name"],
    "ingredients_text": ["ingredients_text", "ingredients", "ingredient_list", "ingredients_raw", "contents"],
    "nova_group": ["nova_group", "nova", "nova_groups", "nova_score", "processing_group"],
    "health_score": ["health_score", "health_rating", "nutriscore_score", "score", "grade_score"],
    "allergens": ["allergens", "allergens_tags", "allergen_flags", "allergy_tags"],
    "additives": ["additives", "additives_tags", "e_numbers", "food_additives"],
    "calories": ["calories", "caloric value", "energy_kcal", "calories_kcal", "energy-kcal_100g", "calories_100g"],
    "protein_g": ["protein_g", "proteins", "protein", "proteins_100g"],
    "carbs_g": ["carbs_g", "carbohydrates", "carbs", "carbohydrates_100g"],
    "fat_g": ["fat_g", "fat", "fats", "fat_100g"],
    "sugar_g": ["sugar_g", "sugars", "sugar", "sugars_100g"],
    "sodium_mg": ["sodium_mg", "sodium", "sodium_100g", "salt_mg"]
}


def clean_ingredient_text(text: str) -> str:
    """Normalize raw ingredient text for tokenization and model training."""
    if not isinstance(text, str):
        return ""
    # Lowercase and replace excessive punctuation with spaces while preserving e-numbers
    cleaned = text.lower()
    cleaned = re.sub(r'[\(\)\[\]\{\}\*:]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def normalize_dataframe(df: pd.DataFrame, source_file: str) -> pd.DataFrame:
    """Normalize column names from different dataset schemas to NutriLens canonical schema."""
    df_clean = pd.DataFrame()
    cols_lower = {str(c).lower().strip(): c for c in df.columns}

    for canonical_col, aliases in COLUMN_ALIASES.items():
        matched_col = None
        for alias in aliases:
            if alias.lower() in cols_lower:
                matched_col = cols_lower[alias.lower()]
                break
        
        if matched_col is not None:
            df_clean[canonical_col] = df[matched_col]
        else:
            # Fallbacks
            if canonical_col == "product_name":
                df_clean[canonical_col] = f"Food Item (from {os.path.basename(source_file)})"
            elif canonical_col == "nova_group":
                df_clean[canonical_col] = None
            elif canonical_col == "health_score":
                df_clean[canonical_col] = None
            elif canonical_col in ["allergens", "additives"]:
                df_clean[canonical_col] = ""
            else:
                df_clean[canonical_col] = 0.0

    # If ingredients_text is missing or empty, generate from product_name
    if "ingredients_text" in df_clean:
        missing_mask = df_clean["ingredients_text"].isna() | (df_clean["ingredients_text"].astype(str).str.strip().str.len() <= 2)
        if missing_mask.any():
            df_clean.loc[missing_mask, "ingredients_text"] = df_clean.loc[missing_mask, "product_name"].astype(str).str.lower()
        df_clean["ingredients_text"] = df_clean["ingredients_text"].fillna("").astype(str).apply(clean_ingredient_text)
        df_clean = df_clean[df_clean["ingredients_text"].str.len() > 1].copy()

    # Convert numeric columns
    for num_col in ["nova_group", "health_score", "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "sodium_mg"]:
        if num_col in df_clean:
            df_clean[num_col] = pd.to_numeric(df_clean[num_col], errors='coerce')

    # If nova_group is missing, attempt heuristic estimation
    if df_clean["nova_group"].isna().any():
        df_clean["nova_group"] = df_clean.apply(
            lambda row: _estimate_missing_nova(row["ingredients_text"]) if pd.isna(row["nova_group"]) else int(row["nova_group"]),
            axis=1
        )

    # If health_score is missing, estimate using nutrient formula
    if df_clean["health_score"].isna().any():
        df_clean["health_score"] = df_clean.apply(
            lambda row: _estimate_missing_health_score(row) if pd.isna(row["health_score"]) else float(row["health_score"]),
            axis=1
        )

    df_clean["source_file"] = os.path.basename(source_file)
    return df_clean


def _estimate_missing_nova(ingredients_text: str) -> int:
    """Heuristic fallback for external datasets missing explicit NOVA classifications."""
    text = ingredients_text.lower()
    ultra_processed_markers = ["syrup", "hydrogenated", "artificial", "preservative", "modified starch", "monosodium", "dye", "flavor", "sweetener"]
    if any(m in text for m in ultra_processed_markers):
        return 4
    if "," in text and any(k in text for k in ["oil", "salt", "sugar"]):
        return 3
    if any(k in text for k in ["oil", "butter", "sugar", "salt", "honey", "syrup"]):
        return 2
    return 1


def _estimate_missing_health_score(row: pd.Series) -> float:
    """Heuristic nutrition balance formula to populate health score if missing in attached dataset."""
    score = 80.0
    nova = row.get("nova_group", 3)
    if nova == 4:
        score -= 30
    elif nova == 3:
        score -= 10
    elif nova == 1:
        score += 10
        
    sugar = row.get("sugar_g", 0)
    if sugar and sugar > 15:
        score -= min(25, (sugar - 15) * 1.2)
        
    sodium = row.get("sodium_mg", 0)
    if sodium and sodium > 500:
        score -= min(20, (sodium - 500) * 0.02)
        
    protein = row.get("protein_g", 0)
    if protein and protein > 10:
        score += min(10, protein * 0.5)

    return max(5.0, min(99.0, score))


def load_all_datasets(data_dir: str = DATA_DIR) -> pd.DataFrame:
    """
    Scans the data directory for all CSV and JSON files, normalizes them,
    and returns a concatenated DataFrame ready for training.
    """
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)

    files = glob.glob(os.path.join(data_dir, "*.csv")) + glob.glob(os.path.join(data_dir, "*.json"))
    if not files:
        raise FileNotFoundError(f"No dataset files found in {data_dir}. Place a .csv or .json dataset file to train the model.")

    dataframes: List[pd.DataFrame] = []
    for filepath in files:
        try:
            if filepath.endswith(".csv"):
                df = pd.read_csv(filepath)
            elif filepath.endswith(".json"):
                df = pd.read_json(filepath)
            else:
                continue

            normalized = normalize_dataframe(df, filepath)
            if not normalized.empty:
                dataframes.append(normalized)
                print(f"Loaded dataset '{os.path.basename(filepath)}': {len(normalized)} items.")
        except Exception as e:
            print(f"Warning: Failed to load dataset from {filepath}: {e}")

    if not dataframes:
        raise ValueError("No valid food items could be parsed from any attached dataset.")

    combined_df = pd.concat(dataframes, ignore_index=True)
    # Deduplicate based on product_name and ingredients_text
    combined_df = combined_df.drop_duplicates(subset=["product_name"]).reset_index(drop=True)
    return combined_df


def get_dataset_summary(data_dir: str = DATA_DIR) -> Dict[str, Any]:
    """Returns overview statistics on all currently attached datasets."""
    files = glob.glob(os.path.join(data_dir, "*.csv")) + glob.glob(os.path.join(data_dir, "*.json"))
    dataset_info = []

    total_records = 0
    for f in files:
        size_bytes = os.path.getsize(f)
        try:
            if f.endswith(".csv"):
                df = pd.read_csv(f)
            else:
                df = pd.read_json(f)
            count = len(df)
        except Exception:
            count = 0

        dataset_info.append({
            "filename": os.path.basename(f),
            "records": count,
            "size_kb": round(size_bytes / 1024, 2)
        })
        total_records += count

    return {
        "attached_files_count": len(files),
        "total_records": total_records,
        "datasets": dataset_info
    }
