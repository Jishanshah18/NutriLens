"""
Compatibility shim redirecting llm_service calls to the local machine learning model service.
Gemini API has been completely removed in favor of local dataset-trained ML models.
"""

from services.model_service import (
    analyze_ingredients,
    analyze_label_image,
    load_models,
    reload_models
)

__all__ = [
    "analyze_ingredients",
    "analyze_label_image",
    "load_models",
    "reload_models"
]
