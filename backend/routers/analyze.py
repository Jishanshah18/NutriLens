from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
import base64
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
        from services.model_service import get_last_ocr_debug
        text = extract_text_from_image_base64(request.image_base64)
        words = len(text.split()) if text else 0
        debug_msg = get_last_ocr_debug()
        return OcrExtractResponse(
            extracted_text=text or (f"[DEBUG: {debug_msg}]" if debug_msg else ""),
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
        # Only save valid food scans to history for authenticated users
        if response.is_food:
            user_id = request.user_profile.user_id if request.user_profile and request.user_profile.user_id else None
            if user_id and user_id not in ["guest", ""]:
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
        # Only save valid food scans to history for authenticated users
        if response.is_food:
            user_id = request.user_profile.user_id if request.user_profile and request.user_profile.user_id else None
            if user_id and user_id not in ["guest", ""]:
                saved_text = response.ocr_text if response.ocr_text else "Image Scan"
                save_scan_history(response, saved_text, user_id=user_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


@router.post("/analyze-label-image", response_model=AnalyzeResponse)
@router.post("/analyze-image-file", response_model=AnalyzeResponse)
async def analyze_label_image_file_endpoint(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    user_id: Optional[str] = Form("default_user")
):
    """
    Multipart/form-data image upload endpoint.
    Accepts raw food packaging photos up to 15MB, decodes them, and runs full ML/OCR analysis.
    """
    target_upload = image or file
    if not target_upload:
        raise HTTPException(
            status_code=400,
            detail="No image provided. Please upload an image using field name 'image' or 'file'."
        )

    try:
        contents = await target_upload.read()
    except Exception as read_err:
        raise HTTPException(status_code=400, detail=f"Failed to read image stream: {str(read_err)}")

    if not contents or len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")

    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image size exceeds maximum limit of 15 MB. Please upload a smaller photo."
        )

    try:
        image_b64 = base64.b64encode(contents).decode("utf-8")
        from services.user_service import get_user_profile
        profile = get_user_profile(user_id) if user_id and user_id != "guest" else None

        response = analyze_label_image(image_b64, profile)

        # Save valid food scans to history
        if response.is_food and user_id and user_id not in ["guest", ""]:
            saved_text = response.ocr_text if response.ocr_text else (response.product_name or "Image Scan")
            save_scan_history(response, saved_text, user_id=user_id)

        # If detected as non-food, return 422 with descriptive rejection reason
        if response.is_food is False:
            raise HTTPException(
                status_code=422,
                detail=response.rejection_reason or "Image unrecognized as food packaging. Please capture a food package label."
            )

        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process food image: {str(e)}")


@router.get("/barcode/{barcode}", response_model=AnalyzeResponse)
async def analyze_barcode_endpoint(barcode: str, user_id: str = "default_user"):
    """
    Directly lookup and analyze a food product by its EAN/UPC/GTIN barcode.
    Evaluates real product nutritional values against user dietary preferences.
    """
    try:
        from services.user_service import get_user_profile
        profile = get_user_profile(user_id)
        response = analyze_ingredients(f"Scanned Barcode GTIN: {barcode}", profile)
        if response.is_food and user_id and user_id not in ["guest", ""]:
            save_scan_history(response, f"Barcode GTIN: {barcode}", user_id=user_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Barcode analysis failed: {str(e)}")


@router.post("/barcode/scan-image", response_model=AnalyzeResponse)
async def analyze_barcode_image_endpoint(request: AnalyzeImageRequest):
    """
    Decodes barcode from an uploaded gallery image and performs nutritional analysis.
    """
    try:
        from services.barcode_service import decode_barcode_from_image
        from services.user_service import get_user_profile

        barcode = decode_barcode_from_image(request.image_base64, allow_ocr_fallback=True)
        profile = request.user_profile
        user_id = profile.user_id if profile and profile.user_id else "default_user"
        if not profile:
            profile = get_user_profile(user_id)

        if not barcode:
            return AnalyzeResponse(
                is_food=False,
                rejection_reason="No readable barcode lines or numbers could be detected in this photo. Please ensure the barcode is clearly visible, or enter the code manually below.",
                product_name="Barcode Not Detected",
                personalized_verdict="⚠️ Barcode Not Found: Please select a clear, well-lit photo of the barcode or enter the numbers directly.",
                health_score=0
            )

        response = analyze_ingredients(f"Scanned Barcode GTIN: {barcode}", profile)
        if response.is_food and user_id and user_id not in ["guest", ""]:
            save_scan_history(response, f"Barcode GTIN: {barcode}", user_id=user_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Barcode image analysis failed: {str(e)}")


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
