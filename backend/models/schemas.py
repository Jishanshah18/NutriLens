from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserProfile(BaseModel):
    user_id: str = "default_user"
    dietary_preferences: List[str] = Field(default_factory=list, description="e.g. Vegan, Keto, Gluten-Free, Low-Sodium, Diabetic-Friendly")
    allergies: List[str] = Field(default_factory=list, description="e.g. Peanuts, Lactose, Gluten, Soy, Tree Nuts, Shellfish")
    health_goals: List[str] = Field(default_factory=list, description="e.g. Weight Loss, Muscle Gain, Heart Health, Diabetic Care, Low Sugar")

class AdditiveDetail(BaseModel):
    code: str
    name: str
    risk_level: str  # Low, Moderate, High
    description: str

class NutritionBreakdown(BaseModel):
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None

class AlternativeProduct(BaseModel):
    name: str
    reason: str
    estimated_health_score: int

class AnalyzeRequest(BaseModel):
    ocr_text: str = Field(..., description="Extracted OCR text from the ingredient label")
    user_profile: Optional[UserProfile] = None

class AnalyzeImageRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image string of ingredient label")
    user_profile: Optional[UserProfile] = None

class OcrExtractRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image string to perform OCR on")

class OcrExtractResponse(BaseModel):
    extracted_text: str
    words_count: int
    success: bool

class AnalyzeResponse(BaseModel):
    product_name: Optional[str] = "Scanned Food Product"
    health_score: int = Field(..., ge=0, le=100, description="Overall health score out of 100")
    nova_group: Optional[int] = Field(default=4, ge=1, le=4, description="Food processing classification (1-4)")
    allergen_flags: List[str] = Field(default_factory=list)
    ingredient_risks: List[str] = Field(default_factory=list)
    positive_attributes: List[str] = Field(default_factory=list)
    additives: List[AdditiveDetail] = Field(default_factory=list)
    nutrition_estimate: Optional[NutritionBreakdown] = None
    healthier_alternatives: List[AlternativeProduct] = Field(default_factory=list)
    personalized_verdict: str
    ocr_text: Optional[str] = None

class ScanHistoryItem(BaseModel):
    id: str
    product_name: str
    scanned_at: datetime
    health_score: int
    allergen_flags: List[str]
    verdict_summary: str
    ocr_text: str

class BadgeItem(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    unlocked: bool
    unlocked_at: Optional[str] = None

class QuizQuestion(BaseModel):
    id: str
    type: str  # "myth_vs_fact" or "multiple_choice"
    title: str
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str
    xp_reward: int = 50

class QuizSubmitRequest(BaseModel):
    quiz_id: str
    user_answer: str

class QuizSubmitResponse(BaseModel):
    is_correct: bool
    explanation: str
    xp_earned: int
    total_xp: int
    new_streak: int

class UserStatsResponse(BaseModel):
    user_id: str
    current_streak: int
    scans_today: int
    total_scans: int
    xp: int
    level: int
    badges: List[BadgeItem]
