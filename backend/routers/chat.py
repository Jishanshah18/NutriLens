"""
NutriLens AI Nutritionist Chat Router.
Provides fast, offline-capable conversational nutrition intelligence
backed by the local toxicological additives database, allergen taxonomy, and ML models.
"""

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from models.schemas import UserProfile
from ml.knowledge import ADDITIVES_DATABASE, ALLERGEN_TAXONOMY, RISK_PATTERNS, BENEFICIAL_PATTERNS

from services.chat_service import generate_smart_nutrition_response

router = APIRouter(tags=["AI Nutritionist Chat"])


class ChatRequest(BaseModel):
    message: str
    language: str = Field(default="en", description="Language code: en, hi, es, fr")
    user_profile: Optional[UserProfile] = None
    product_context: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    suggested_questions: List[str]
    detected_additives: List[str] = []
    safety_verdict: Optional[str] = None


@router.post("/chat", response_model=ChatResponse)
async def chat_with_nutritionist(req: ChatRequest):
    """
    Interact with NutriLens AI Nutritionist Bot.
    Runs locally and offline with full knowledge of toxic additives, NOVA groups, allergens,
    breakfast/meal recommendations, specific foods, and local Hindi/Hinglish query comprehension.
    """
    try:
        data = generate_smart_nutrition_response(
            query=req.message,
            lang=req.language,
            profile=req.user_profile,
            product_context=req.product_context
        )
        return ChatResponse(
            reply=data["reply"],
            suggested_questions=data["suggested_questions"],
            detected_additives=data["detected_additives"],
            safety_verdict=data.get("safety_verdict")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Nutritionist Chat Error: {str(e)}")
