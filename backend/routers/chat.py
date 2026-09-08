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


def generate_nutritionist_response(
    query: str,
    lang: str = "en",
    profile: Optional[UserProfile] = None,
    product_context: Optional[str] = None
) -> ChatResponse:
    q_lower = query.lower().strip()
    detected_adds = []
    safety = "Safe / Informational"

    # Detect any E-codes or additives mentioned
    e_code_matches = re.findall(r'\b[Ee][-\s]?([0-9]{3,4}[a-z]?)\b', query)
    for num in e_code_matches:
        code = f"E{num.upper()}"
        if code in ADDITIVES_DATABASE:
            detected_adds.append(code)

    for code, info in ADDITIVES_DATABASE.items():
        name_clean = info["name"].lower().split("(")[0].strip()
        if (len(name_clean) > 3 and name_clean in q_lower) or code.lower() in q_lower:
            if code not in detected_adds:
                detected_adds.append(code)

    user_allergies = [a.lower() for a in (profile.allergies if profile else [])]
    user_goals = [g.lower() for g in (profile.health_goals if profile else [])]

    # Check for allergen concerns
    triggered_allergens = []
    for allergen, kws in ALLERGEN_TAXONOMY.items():
        for kw in kws:
            if kw in q_lower:
                triggered_allergens.append(allergen)
                if any(allergen.lower() in ua or ua in allergen.lower() for ua in user_allergies):
                    safety = "CRITICAL ALLERGEN WARNING"
                break

    # Build response based on intent and language
    # 1. Additive specific inquiry
    if detected_adds:
        code = detected_adds[0]
        info = ADDITIVES_DATABASE[code]
        risk = info["risk_level"]
        name = info["name"]
        desc = info["description"]

        if lang == "hi":
            reply = f"**{code} ({name})** ek khadya additive hai jiska risk level **{risk}** hai. {desc}"
            if risk == "High":
                reply += " Yeh additive sharir par nakaratmak asar daal sakta hai, ise kam se kam khane ki salah di jaati hai."
        elif lang == "es":
            reply = f"**{code} ({name})** es un aditivo alimentario con un nivel de riesgo **{risk}**. {desc}"
        elif lang == "fr":
            reply = f"**{code} ({name})** est un additif alimentaire de niveau de risque **{risk}**. {desc}"
        else:
            reply = f"**{code} ({name})** has a **{risk} Risk** rating. {desc}"
            if risk == "High":
                reply += " Health experts recommend avoiding regular consumption of this substance due to potential inflammatory or metabolic impacts."
            elif risk == "Moderate":
                reply += " Consume with caution in moderated amounts."
            else:
                reply += " Generally recognized as safe in standard dietary quantities."

        suggested = [
            "Are there natural alternatives to this additive?",
            "What food categories usually hide this ingredient?",
            "How does this additive affect blood sugar?"
        ]
        return ChatResponse(
            reply=reply,
            suggested_questions=suggested,
            detected_additives=detected_adds,
            safety_verdict=f"{risk} Risk Additive"
        )

    # 2. Food processing level / ultra-processed food inquiry
    if any(k in q_lower for k in ["nova", "processed", "processing", "upf", "whole food"]):
        if lang == "hi":
            reply = (
                "**Food Processing Levels** khane ko 4 vargon me baant-ta hai:\n"
                "• **Level 1**: Prakritik & Asanshodhit bhojan (jaise taaza phal, sabziyan, daal, dry fruits).\n"
                "• **Level 2**: Culinary ingredients (tel, makkhan, namak).\n"
                "• **Level 3**: Sadharan sanshodhit bhojan (canned sabziyan, fresh cheese).\n"
                "• **Level 4**: **Ultra-Processed Foods (UPFs)** — jisme artificial flavors, preservative E-codes, aur refined oils hote hain. Inse bachein!"
            )
        elif lang == "es":
            reply = (
                "**Niveles de Procesamiento de Alimentos:**\n"
                "• **Nivel 1**: Alimentos naturales o mínimamente procesados.\n"
                "• **Nivel 2**: Ingredientes culinarios procesados (aceites, sal).\n"
                "• **Nivel 3**: Alimentos procesados (quesos, conservas).\n"
                "• **Nivel 4**: **Ultraprocesados** con aditivos industriales y azúcares añadidos."
            )
        else:
            reply = (
                "The **Food Processing Classification System** categorizes foods by degree of industrial processing:\n\n"
                "🌿 **Level 1 (Unprocessed / Whole Foods)**: Fresh produce, whole grains, raw nuts, legumes.\n"
                "🧈 **Level 2 (Culinary Ingredients)**: Olive oil, butter, vinegar, natural salt.\n"
                "🍞 **Level 3 (Moderately Processed Foods)**: Fresh artisanal bread, canned beans, simple cheeses.\n"
                "⚠️ **Level 4 (Ultra-Processed Formulations)**: Packaged snacks, soda, instant noodles with stabilizers, artificial flavors, and refined fats. Aim to minimize Level 4 foods!"
            )
        suggested = [
            "How can I replace ultra-processed snacks?",
            "Is 100% whole wheat bread considered minimally processed?",
            "What are the worst ingredients in ultra-processed foods?"
        ]
        return ChatResponse(reply=reply, suggested_questions=suggested, safety_verdict="Educational")

    # 3. Allergen inquiry
    if triggered_allergens:
        al_str = ", ".join(triggered_allergens)
        if safety == "CRITICAL ALLERGEN WARNING":
            if lang == "hi":
                reply = f"⚠️ **CRITICAL ALLERGY ALERT**: Isme **{al_str}** hai jo aapki saved profile allergy ke khilaaf hai! Ise bilkul na khayein."
            else:
                reply = f"⚠️ **CRITICAL ALLERGEN WARNING**: This item or query involves **{al_str}**, which directly conflicts with your saved allergy profile! Please inspect labels thoroughly."
        else:
            if lang == "hi":
                reply = f"Yeh **{al_str}** se sambandhit hai. Agar aapko isse allergy hai toh ingredient label ko dhyan se check karein."
            else:
                reply = f"This relates to **{al_str}**. Cross-contamination or hidden derivatives often appear under alternate chemical names on packaged labels."

        return ChatResponse(
            reply=reply,
            suggested_questions=["What alternate names does this allergen hide under?", "Show clean allergen-free swaps"],
            safety_verdict=safety
        )

    # 4. Diabetic / Low Sugar / Weight Loss inquiry
    if any(k in q_lower for k in ["diabetic", "sugar", "sweetener", "glucose", "weight", "keto"]):
        if lang == "hi":
            reply = (
                "**Blood Sugar & Weight Care Salah:**\n"
                "• High Fructose Corn Syrup (HFCS), Maltodextrin, aur Dextrose se bachein kyunki yeh insulin spike karte hain.\n"
                "• Unrefined fiber-rich foods jaise oats, almonds, aur chia seeds blood sugar ko stable rakhte hain.\n"
                "• Sugar ke safe natural vikalp hain Stevia aur Monk Fruit."
            )
        else:
            reply = (
                "**Smart Glycemic & Metabolic Guidance:**\n\n"
                "• **Hidden Sugar Traps**: Watch out for *Maltodextrin* (GI = 110, higher than pure glucose!), *High Fructose Corn Syrup*, and *Dextrose*.\n"
                "• **Clean Sweetener Swaps**: Pure Stevia leaf extract, Monk fruit, and Erythritol offer low glycemic response.\n"
                "• **Fiber Pairing**: Always pair carbohydrates with healthy fats (nuts, seeds) or protein to flatten the post-meal glucose curve."
            )
        return ChatResponse(
            reply=reply,
            suggested_questions=[
                "Is maltodextrin worse than white sugar?",
                "What are the best low-carb snack swaps?",
                "How to spot hidden sugars on ingredients lists?"
            ],
            safety_verdict="Metabolic Advice"
        )

    # 5. General Greeting or Nutrition question
    if any(g in q_lower for g in ["hi", "hello", "hey", "namaste", "hola", "bonjour"]):
        if lang == "hi":
            reply = "Namaste! Main aapka NutriLens AI Nutritionist hoon. Kisi bhi khadya padarth, E-code preservative, allergen, ya swasth khane ke baare me puchiye!"
        elif lang == "es":
            reply = "¡Hola! Soy tu Nutricionista NutriLens IA. Pregúntame sobre cualquier ingrediente, código E, alérgenos o alternativas saludables."
        elif lang == "fr":
            reply = "Bonjour! Je suis votre nutritionniste NutriLens IA. Posez-moi des questions sur les additifs, les allergènes ou les aliments sains."
        else:
            reply = "Hello! I am your NutriLens AI Nutrition Intelligence Assistant. Ask me about any ingredient, preservative E-code, allergen safety, or healthier clean-label swaps!"
        return ChatResponse(
            reply=reply,
            suggested_questions=[
                "What is E621 (MSG) and is it dangerous?",
                "Which food additives are banned in Europe?",
                "What should I look for on a clean food label?"
            ]
        )

    # 6. Fallback thoughtful AI nutritionist response
    if lang == "hi":
        reply = (
            f"Aapne pucha: '{query}'.\n"
            "NutriLens offline intelligence ke anusar: Hamesha short ingredient list wale products chuniye. "
            "Agar kisi label par 5 se zyada chemical naam ya E-codes hain, toh wo aamtaur par ultra-processed hota hai."
        )
    else:
        reply = (
            f"Regarding '{query}':\n\n"
            "When evaluating food quality, prioritize items with **short, recognizable ingredient lists** (whole foods). "
            "Be cautious of products containing more than 5 ingredients where industrial stabilizers (emulsifiers like polysorbate 80, carrageenan) "
            "or artificial colors (E102, E129) are prominent. Check the Smart Scanner tab anytime to audit a product in real time!"
        )

    return ChatResponse(
        reply=reply,
        suggested_questions=[
            "How do emulsifiers affect gut microbiome?",
            "What does a healthy daily macro balance look like?",
            "Give me 5 clean whole food breakfast ideas"
        ],
        safety_verdict="General Nutrition"
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_nutritionist(req: ChatRequest):
    """
    Interact with NutriLens AI Nutritionist Bot.
    Runs locally and offline with full knowledge of toxic additives, NOVA groups, and allergens.
    """
    try:
        return generate_nutritionist_response(
            query=req.message,
            lang=req.language,
            profile=req.user_profile,
            product_context=req.product_context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Nutritionist Chat Error: {str(e)}")
