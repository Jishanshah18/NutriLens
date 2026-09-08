"""
NutriLens Model & Dataset Management Router.
Provides endpoints for inspecting model health, attaching datasets, and triggering model retraining.
"""

import os
import json
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, Optional

from ml.dataset_loader import get_dataset_summary, DATA_DIR
from ml.train import train_pipeline, MODELS_DIR
from services.model_service import reload_models, _models

router = APIRouter(prefix="/model", tags=["Model & Datasets"])


@router.get("/info")
async def get_model_info():
    """
    Get current machine learning model status, training metrics, and loaded weights info.
    """
    metrics_path = os.path.join(MODELS_DIR, "training_metrics.json")
    metrics_data = {}
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r", encoding="utf-8") as f:
                metrics_data = json.load(f)
        except Exception as e:
            metrics_data = {"error": f"Failed to read metrics file: {e}"}

    dataset_summary = get_dataset_summary()

    return {
        "status": "ready" if _models["is_loaded"] else "not_loaded",
        "models_in_memory": {
            "nova_classifier": _models["nova_classifier"] is not None,
            "health_score_regressor": _models["health_regressor"] is not None,
            "alternatives_index": _models["alternatives_index"] is not None,
            "product_catalog_size": len(_models["product_catalog"]) if _models["product_catalog"] else 0
        },
        "training_metrics": metrics_data,
        "attached_datasets": dataset_summary
    }


@router.get("/datasets")
async def list_attached_datasets():
    """
    List all attached datasets currently present in backend/ml/data/.
    """
    try:
        summary = get_dataset_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list datasets: {str(e)}")


@router.post("/train")
async def trigger_model_training():
    """
    Trigger training of the custom ML model on all attached datasets in backend/ml/data/.
    Automatically hot-reloads the newly trained weights into memory for instant live inference.
    """
    try:
        metrics = train_pipeline()
        reload_models()
        return {
            "status": "success",
            "message": "Model retrained and hot-reloaded successfully on all attached datasets.",
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")


@router.post("/attach-dataset")
async def attach_dataset(
    file: UploadFile = File(...),
    auto_retrain: bool = Query(True, description="Whether to automatically retrain the model after attaching")
):
    """
    Upload and attach a new dataset (.csv or .json) to backend/ml/data/.
    Supports Open Food Facts exports, Kaggle food ingredient sets, and custom CSV schemas.
    """
    if not (file.filename.endswith(".csv") or file.filename.endswith(".json")):
        raise HTTPException(status_code=400, detail="Only .csv and .json dataset files are supported.")

    os.makedirs(DATA_DIR, exist_ok=True)
    destination_path = os.path.join(DATA_DIR, file.filename)

    try:
        with open(destination_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded dataset: {str(e)}")

    retrain_result = None
    if auto_retrain:
        try:
            retrain_result = train_pipeline()
            reload_models()
        except Exception as e:
            return {
                "status": "attached_with_warning",
                "filename": file.filename,
                "message": f"Dataset attached successfully, but auto-retrain encountered an error: {str(e)}"
            }

    return {
        "status": "success",
        "filename": file.filename,
        "message": "Dataset attached and model retrained successfully." if auto_retrain else "Dataset attached successfully.",
        "training_metrics": retrain_result
    }
