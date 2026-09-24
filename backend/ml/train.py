"""
NutriLens Production ML Model Training & Rigorous Evaluation.
Trains on USDA FoodData Central & Open Food Facts dataset splits:
1. NOVA Processing Level Classifier (NOVA 1, 2, 3, 4)
2. Nutritional Integrity / Health Score Regressor (0-100)
3. Healthier Alternatives Cosine Similarity Search Index
Evaluates using Train/Test split: Accuracy, Precision, Recall, F1, Confusion Matrix, MAE, RMSE, R2.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Dict, Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAINING_DIR = os.path.join(BASE_DIR, "data", "training")
SAVED_MODELS_DIR = os.path.join(BASE_DIR, "ml", "saved_models")
MODELS_DIR = SAVED_MODELS_DIR

TRAIN_CSV = os.path.join(TRAINING_DIR, "train_dataset.csv")
TEST_CSV = os.path.join(TRAINING_DIR, "test_dataset.csv")


def train_models():
    print("===============================================================")
    print("   NutriLens Machine Learning Training & Evaluation Starting   ")
    print("===============================================================")
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)

    print(f"Loading training data from: {TRAIN_CSV}")
    train_df = pd.read_csv(TRAIN_CSV, low_memory=False)
    print(f"Loading test data from:     {TEST_CSV}")
    test_df = pd.read_csv(TEST_CSV, low_memory=False)

    print(f"Training samples: {len(train_df)} | Test samples: {len(test_df)}")

    # Handle missing text gracefully
    train_df["ingredients_tokens"] = train_df["ingredients_tokens"].fillna(train_df["food_name"].fillna("food"))
    test_df["ingredients_tokens"] = test_df["ingredients_tokens"].fillna(test_df["food_name"].fillna("food"))

    # 1. Build TF-IDF Feature Extraction
    print("\n[1/4] Fitting TF-IDF Feature Vectorizer...")
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.90,
        sublinear_tf=True,
        max_features=25000,
        token_pattern=r'(?u)\b[a-zA-Z0-9_-]+\b'
    )
    X_train = vectorizer.fit_transform(train_df["ingredients_tokens"])
    X_test = vectorizer.transform(test_df["ingredients_tokens"])
    vocab_size = len(vectorizer.vocabulary_)
    print(f"TF-IDF Vectorizer built with {vocab_size} n-gram features.")

    # 2. Train and Evaluate NOVA Group Classifier
    print("\n[2/4] Training NOVA Processing Group Classifier (Logistic Regression)...")
    y_train_nova = train_df["nova_group"].astype(int)
    y_test_nova = test_df["nova_group"].astype(int)

    nova_clf = LogisticRegression(
        C=2.0,
        max_iter=1000,
        class_weight="balanced",
        solver="lbfgs",
        random_state=42
    )
    nova_clf.fit(X_train, y_train_nova)

    y_pred_nova = nova_clf.predict(X_test)
    nova_acc = float(accuracy_score(y_test_nova, y_pred_nova))
    nova_precision = float(precision_score(y_test_nova, y_pred_nova, average="weighted", zero_division=0))
    nova_recall = float(recall_score(y_test_nova, y_pred_nova, average="weighted", zero_division=0))
    nova_f1 = float(f1_score(y_test_nova, y_pred_nova, average="weighted", zero_division=0))
    cm = confusion_matrix(y_test_nova, y_pred_nova).tolist()

    print(f"--- NOVA Classifier Evaluation (on {len(test_df)} unseen test foods) ---")
    print(f"  Accuracy:  {nova_acc * 100:.2f}%")
    print(f"  Precision: {nova_precision:.4f}")
    print(f"  Recall:    {nova_recall:.4f}")
    print(f"  F1 Score:  {nova_f1:.4f}")
    print(f"  Confusion Matrix:\n{np.array(cm)}")

    # 3. Train and Evaluate Health Score Regressor
    print("\n[3/4] Training Health Score Regressor (Ridge Regression)...")
    y_train_health = train_df["health_score"].astype(float)
    y_test_health = test_df["health_score"].astype(float)

    health_reg = Ridge(alpha=1.5, random_state=42)
    health_reg.fit(X_train, y_train_health)

    y_pred_health = health_reg.predict(X_test)
    mae = float(mean_absolute_error(y_test_health, y_pred_health))
    rmse = float(np.sqrt(mean_squared_error(y_test_health, y_pred_health)))
    r2 = float(r2_score(y_test_health, y_pred_health))

    print(f"--- Health Score Regressor Evaluation (on {len(test_df)} test foods) ---")
    print(f"  Mean Absolute Error (MAE): {mae:.2f} points (scale 0-100)")
    print(f"  Root Mean Squared Error:   {rmse:.2f} points")
    print(f"  R2 Score:                  {r2:.4f}")

    # 4. Build Clean Healthier Alternatives Index
    print("\n[4/4] Indexing Whole Foods for Healthier Alternative Swaps...")
    clean_foods_df = train_df[
        (train_df["nova_group"] <= 2) & (train_df["health_score"] >= 75)
    ].copy()

    if len(clean_foods_df) < 100:
        clean_foods_df = train_df.sort_values(by="health_score", ascending=False).head(2000).copy()

    print(f"Found {len(clean_foods_df)} verified clean whole-food items for alternative matching.")
    X_clean = vectorizer.transform(clean_foods_df["ingredients_tokens"])

    knn_index = NearestNeighbors(n_neighbors=min(15, len(clean_foods_df)), metric="cosine")
    knn_index.fit(X_clean)

    clean_catalog_records = clean_foods_df[[
        "food_name", "brand", "category", "ingredients_text", "nova_group", "health_score",
        "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "sodium_mg", "data_source"
    ]].to_dict(orient="records")

    # 5. Persist Model Artifacts
    print(f"\nSaving model artifacts to {SAVED_MODELS_DIR}...")
    joblib.dump(vectorizer, os.path.join(SAVED_MODELS_DIR, "vectorizer.joblib"))
    joblib.dump(nova_clf, os.path.join(SAVED_MODELS_DIR, "nova_classifier.joblib"))
    joblib.dump(health_reg, os.path.join(SAVED_MODELS_DIR, "health_score_regressor.joblib"))
    joblib.dump(knn_index, os.path.join(SAVED_MODELS_DIR, "alternatives_index.joblib"))
    joblib.dump(clean_catalog_records, os.path.join(SAVED_MODELS_DIR, "product_catalog.joblib"))

    # 6. Save Comprehensive Metrics & Evaluation Report
    metrics_report = {
        "dataset_metadata": {
            "sources": ["USDA FoodData Central", "Open Food Facts"],
            "collection_date": "February 2026",
            "total_unique_records": len(train_df) + len(test_df),
            "training_samples": len(train_df),
            "test_samples": len(test_df),
            "split_ratio": "80% Train / 20% Test (Stratified)"
        },
        "nova_classifier_evaluation": {
            "model_type": "TF-IDF (25k n-grams) + Multinomial Logistic Regression",
            "accuracy": round(nova_acc, 4),
            "accuracy_percentage": f"{nova_acc * 100:.2f}%",
            "precision_weighted": round(nova_precision, 4),
            "recall_weighted": round(nova_recall, 4),
            "f1_score_weighted": round(nova_f1, 4),
            "classes": [int(c) for c in nova_clf.classes_],
            "confusion_matrix": cm
        },
        "health_score_regressor_evaluation": {
            "model_type": "TF-IDF + L2 Ridge Regression",
            "mean_absolute_error": round(mae, 2),
            "root_mean_squared_error": round(rmse, 2),
            "r2_score": round(r2, 4)
        },
        "alternatives_index": {
            "metric": "Cosine Distance",
            "indexed_clean_items": len(clean_catalog_records)
        },
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "vocabulary_size": vocab_size
    }

    metrics_path = os.path.join(SAVED_MODELS_DIR, "training_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_report, f, indent=2)

    print(f"Metrics written to {metrics_path}")
    print("===============================================================\n")
    return metrics_report


train_pipeline = train_models

if __name__ == "__main__":
    train_models()
