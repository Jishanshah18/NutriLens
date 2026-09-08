from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from models.schemas import (
    AnalyzeRequest,
    AnalyzeImageRequest,
    AnalyzeResponse,
    AlternativeProduct,
    OcrExtractRequest,
    OcrExtractResponse
)
from services.model_service import analyze_ingredients, analyze_label_image, extract_text_from_image_base64
from services.history_service import save_scan_history

router = APIRouter(tags=["Analyze"])

@router.post("/extract-ocr", response_model=OcrExtractResponse)
async def extract_ocr_endpoint(request: OcrExtractRequest):
    """
    Extracts raw text from an uploaded or gallery image using high-speed local OCR.
    """
    try:
        text = extract_text_from_image_base64(request.image_base64)
        words = len(text.split()) if text else 0
        return OcrExtractResponse(
            extracted_text=text,
            words_count=words,
            success=len(text.strip()) > 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")


@router.post("/analyze-label", response_model=AnalyzeResponse)
async def analyze_label_endpoint(request: AnalyzeRequest):
    """
    Analyze food ingredients text using custom trained machine learning model against user preferences, allergies, and health goals.
    """
    try:
        response = analyze_ingredients(request.ocr_text, request.user_profile)
        # Automatically save to scan history
        user_id = request.user_profile.user_id if request.user_profile else "default_user"
        save_scan_history(response, request.ocr_text, user_id=user_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze label: {str(e)}")


@router.post("/analyze-image", response_model=AnalyzeResponse)
async def analyze_image_endpoint(request: AnalyzeImageRequest):
    """
    Analyze a food product ingredient label directly from an image using on-device processing and custom trained ML models.
    """
    try:
        response = analyze_label_image(request.image_base64, request.user_profile)
        user_id = request.user_profile.user_id if request.user_profile else "default_user"
        saved_text = response.ocr_text if response.ocr_text else "Image Scan"
        save_scan_history(response, saved_text, user_id=user_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


@router.get("/alternatives", response_model=List[AlternativeProduct])
async def get_alternatives(
    category: str = Query("snacks", description="Food category e.g. snacks, drinks, cereals")
):
    """
    Get recommended healthy alternative products.
    """
    return [
        AlternativeProduct(
            name="Organic Sprouted Pumpkin & Sunflower Seeds",
            reason="High in bioavailable magnesium, zinc, and healthy plant fats with zero refined carbohydrates.",
            estimated_health_score=96
        ),
        AlternativeProduct(
            name="Wild-Harvested Dried Blueberries & Almond Mix",
            reason="Rich in anthocyanin antioxidants with natural low sugar impact.",
            estimated_health_score=92
        ),
        AlternativeProduct(
            name="Cold-Pressed Unsweetened Coconut Water",
            reason="Natural electrolyte replenishment with no added sugars or artificial flavors.",
            estimated_health_score=90
        )
    ]
