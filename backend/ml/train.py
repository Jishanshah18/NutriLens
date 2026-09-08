"""
NutriLens Model Training Pipeline.
Trains custom machine learning models on attached food datasets:
- NOVA Group Classifier (Predicts NOVA 1, 2, 3, or 4 from ingredient text)
- Health Score Regressor (Predicts 0-100 health score from ingredient composition)
- Healthier Alternatives Index (KNN similarity index recommending cleaner swaps)
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Ensure parent directory (backend) is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.neighbors import NearestNeighbors
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score

from ml.dataset_loader import load_all_datasets, DATA_DIR

MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")


def train_pipeline(data_dir: str = DATA_DIR, save_dir: str = MODELS_DIR) -> Dict[str, Any]:
    """
    Executes the complete machine learning training pipeline on all attached datasets.
    Saves trained models, vectorizers, alternative product catalog, and metrics.
    """
    print(f"\n=======================================================")
    print(f"   NutriLens Machine Learning Model Training Starting   ")
    print(f"=======================================================")
    print(f"Reading datasets from: {data_dir}")

    os.makedirs(save_dir, exist_ok=True)
    
    # 1. Load and merge datasets
    df = load_all_datasets(data_dir)
    print(f"Total processed dataset size: {len(df)} food products across {df['source_file'].nunique()} file(s).")
    print(f"NOVA Distribution:\n{df['nova_group'].value_counts().sort_index().to_dict()}")

    # 2. Text Feature Extraction via TF-IDF (word & character n-grams)
    print("Building TF-IDF Vectorizer on ingredient token spaces...")
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.98,
        sublinear_tf=True,
        token_pattern=r'(?u)\b[a-zA-Z0-9_-]+\b'
    )
    X = vectorizer.fit_transform(df["ingredients_text"])

    # 3. Train NOVA Group Classification Model
    print("Training NOVA Group Classifier...")
    y_nova = df["nova_group"].astype(int)

    # Train / Test split for validation metrics
    X_train_n, X_val_n, y_train_n, y_val_n = train_test_split(
        X, y_nova, test_size=0.2, random_state=42, stratify=y_nova if y_nova.nunique() > 1 else None
    )

    nova_clf = LogisticRegression(
        C=2.5,
        max_iter=1000,
        class_weight="balanced",
        solver="lbfgs"
    )
    nova_clf.fit(X_train_n, y_train_n)
    y_pred_n = nova_clf.predict(X_val_n)

    nova_acc = float(accuracy_score(y_val_n, y_pred_n))
    nova_f1 = float(f1_score(y_val_n, y_pred_n, average="weighted"))
    print(f"NOVA Classifier Validation - Accuracy: {nova_acc:.4f} | Weighted F1: {nova_f1:.4f}")

    # Retrain on full dataset for maximum production power
    nova_clf.fit(X, y_nova)

    # 4. Train Health Score Regressor Model
    print("Training Health Score Regressor...")
    y_health = df["health_score"].astype(float)
    X_train_h, X_val_h, y_train_h, y_val_h = train_test_split(
        X, y_health, test_size=0.2, random_state=42
    )

    health_reg = Ridge(alpha=1.0)
    health_reg.fit(X_train_h, y_train_h)
    y_pred_h = health_reg.predict(X_val_h)

    health_mae = float(mean_absolute_error(y_val_h, y_pred_h))
    health_r2 = float(r2_score(y_val_h, y_pred_h))
    print(f"Health Score Regressor Validation - MAE: {health_mae:.2f} points | R2 Score: {health_r2:.4f}")

    # Retrain on full dataset
    health_reg.fit(X, y_health)

    # 5. Build Healthier Alternatives Search Index
    print("Indexing food products for Healthier Alternative recommendations...")
    knn_index = NearestNeighbors(n_neighbors=min(25, len(df)), metric="cosine")
    knn_index.fit(X)

    catalog_records = df[[
        "product_name", "ingredients_text", "nova_group", "health_score",
        "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "sodium_mg"
    ]].to_dict(orient="records")

    # 6. Save Artifacts to Models Directory
    print(f"Saving trained model artifacts to {save_dir}...")
    joblib.dump(vectorizer, os.path.join(save_dir, "vectorizer.joblib"))
    joblib.dump(nova_clf, os.path.join(save_dir, "nova_classifier.joblib"))
    joblib.dump(health_reg, os.path.join(save_dir, "health_score_regressor.joblib"))
    joblib.dump(knn_index, os.path.join(save_dir, "alternatives_index.joblib"))
    joblib.dump(catalog_records, os.path.join(save_dir, "product_catalog.joblib"))

    # 7. Record Training Metrics & Metadata
    timestamp_str = datetime.now(timezone.utc).isoformat()
    metrics = {
        "status": "trained",
        "trained_at": timestamp_str,
        "total_training_samples": len(df),
        "source_files": list(df["source_file"].unique()),
        "nova_classifier": {
            "model_type": "TF-IDF + Multinomial Logistic Regression",
            "accuracy": round(nova_acc, 4),
            "f1_score": round(nova_f1, 4),
            "classes": [int(c) for c in nova_clf.classes_]
        },
        "health_score_regressor": {
            "model_type": "TF-IDF + Ridge Regression",
            "mae": round(health_mae, 2),
            "r2_score": round(health_r2, 4)
        },
        "vocabulary_size": len(vectorizer.vocabulary_)
    }

    metrics_path = os.path.join(save_dir, "training_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"Training successfully complete! Metrics written to {metrics_path}")
    print(f"=======================================================\n")
    return metrics


if __name__ == "__main__":
    train_pipeline()
