from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserProfile(BaseModel):
    user_id: str = "default_user"
    email: Optional[str] = None
    full_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=1, le=120, description="User age in years for tailored nutrition context")
    health_conditions: List[str] = Field(default_factory=list, description="e.g. Diabetes, High Blood Pressure, High Cholesterol, Obesity, Heart-related conditions, Kidney-related conditions, Gluten intolerance, Lactose intolerance")
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
    fiber_g: Optional[float] = None
    is_estimated: bool = Field(default=False, description="True if estimated from ingredients; False if extracted from label or verified database")
    source: Optional[str] = Field(default="Scanned Label", description="Source of nutrition facts (e.g. Scanned Label, OpenFoodFacts Database, or Calculated from Ingredients)")
    serving_size: Optional[str] = Field(default=None, description="Extracted serving size, e.g. '100g' or '1 bar (35g)'")


class AlternativeProduct(BaseModel):
    name: str
    reason: str
    estimated_health_score: int

class PersonalizedRecommendation(BaseModel):
    status: str = Field(..., description="Good Choice | Suitable | Moderately Suitable | Limit | Not Recommended")
    headline: str = Field(..., description="Clear recommendation summary headline")
    health_conditions_considered: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list, description="Why this recommendation was made for user's health conditions")
    key_concerns: List[str] = Field(default_factory=list, description="e.g. High Sugar (16g), High Sodium (420mg)")
    positive_notes: List[str] = Field(default_factory=list, description="e.g. Good Protein (8g), Good Fiber (4g)")
    better_alternative: Optional[str] = Field(default=None, description="What to look for instead")
    data_completeness: str = Field(default="High", description="'High', 'Partial', or 'Low' data completeness rating")
    missing_nutrients: List[str] = Field(default_factory=list, description="List of unavailable nutrient fields (null != 0)")
    data_sources: List[str] = Field(default_factory=lambda: ["USDA FoodData Central", "Open Food Facts"], description="Dataset sources")
    last_verified: str = Field(default="February 2026", description="Data verification timestamp")
    allergens_safety_note: Optional[str] = Field(
        default="Always verify allergen and ingredient information on the physical product packaging, especially if you have a severe food allergy.",
        description="Allergen safety guidance"
    )
    medical_disclaimer: str = Field(
        default="NutriLens provides educational nutrition information and is not a substitute for professional medical advice, diagnosis, or treatment.",
        description="Medical safety disclaimer"
    )

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

class PreferenceAudit(BaseModel):
    allergen_conflicts: List[str] = Field(default_factory=list, description="Allergens that conflict with user allergy profile")
    allergen_safe_notes: List[str] = Field(default_factory=list, description="Confirmed absence of user allergens")
    dietary_matches: List[str] = Field(default_factory=list, description="Dietary preferences satisfied (e.g. Vegan, Low Sugar)")
    dietary_conflicts: List[str] = Field(default_factory=list, description="Dietary preferences violated")
    goal_alignments: List[str] = Field(default_factory=list, description="Positive alignment with user health goals")
    goal_warnings: List[str] = Field(default_factory=list, description="Warnings regarding user health goals")
    is_safe_for_user: bool = True

class AnalyzeResponse(BaseModel):
    is_food: bool = Field(default=True, description="True if verified as food/beverage; False if non-food or foreign item")
    rejection_reason: Optional[str] = Field(default=None, description="Explanation if rejected as non-food")
    product_name: Optional[str] = "Scanned Food Product"
    brand: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    health_score: int = Field(default=0, ge=0, le=100, description="Overall health score out of 100")
    nova_group: Optional[int] = Field(default=None, description="Food processing classification (1-4)")
    allergen_flags: List[str] = Field(default_factory=list)
    ingredient_risks: List[str] = Field(default_factory=list)
    positive_attributes: List[str] = Field(default_factory=list)
    additives: List[AdditiveDetail] = Field(default_factory=list)
    nutrition_estimate: Optional[NutritionBreakdown] = None
    healthier_alternatives: List[AlternativeProduct] = Field(default_factory=list)
    personalized_verdict: str
    personalized_recommendation: Optional[PersonalizedRecommendation] = None
    data_completeness: str = Field(default="High", description="Data completeness indicator ('High', 'Partial', 'Low')")
    missing_nutrients: List[str] = Field(default_factory=list, description="Unavailable nutrients (null != 0)")
    data_sources: List[str] = Field(default_factory=lambda: ["USDA FoodData Central", "Open Food Facts"], description="Data sources")
    last_verified: str = Field(default="February 2026", description="Last verified date")
    allergens_safety_note: Optional[str] = None
    ocr_text: Optional[str] = None
    barcode: Optional[str] = None
    preference_audit: Optional[PreferenceAudit] = None

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

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    age: Optional[int] = None
    health_conditions: List[str] = Field(default_factory=list)
    dietary_preferences: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    health_goals: List[str] = Field(default_factory=list)

class UserPasswordUpdateRequest(BaseModel):
    user_id: Optional[str] = "default_user"
    new_password: str

class UserAuthResponse(BaseModel):
    success: bool
    user_id: str  
    email: str
    full_name: str
    token: str = "nutrilens_session_active"
    message: str
    profile: UserProfile

