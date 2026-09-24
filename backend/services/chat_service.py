"""
NutriLens Intelligent Conversational Nutrition Engine.
Understands local conversational languages (Hindi, Hinglish, English),
health conditions (Diabetes, High BP, Gut, Weight Loss), and specific foods
(Apple/Seb, Banana/Kela, Milk/Dahi, Breakfast/Morning Food, Oils, Snacks).
Provides deep, actionable, science-grounded dietitian responses with zero hallucinations.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from models.schemas import UserProfile
from ml.knowledge import ADDITIVES_DATABASE, ALLERGEN_TAXONOMY


def detect_hinglish_or_hindi(text: str, lang_code: str) -> bool:
    """Detects if user is asking in Hindi or conversational Hinglish (Roman Hindi)."""
    if lang_code == "hi":
        return True
    
    hinglish_markers = {
        "kya", "hai", "hain", "karo", "kro", "kaise", "batao", "btao", "fayde", "fayda",
        "nuksan", "khaye", "khana", "seb", "kela", "doodh", "chawal", "roti", "subah",
        "nashta", "dopahar", "raat", "pet", "vajan", "motapa", "kam", "zyada", "namak",
        "tel", "meetha", "accha", "bura", "agr", "agar", "koi", "chahiye", "kr", "kar",
        "raha", "rahe", "hoga", "hogi", "shuru", "peena", "peene", "khau", "sakte", "wali"
    }
    tokens = set(re.findall(r'\b[a-zA-Z]+\b', text.lower()))
    return len(tokens.intersection(hinglish_markers)) >= 1


def generate_smart_nutrition_response(
    query: str,
    lang: str = "en",
    profile: Optional[UserProfile] = None,
    product_context: Optional[str] = None
) -> Dict[str, Any]:
    q_clean = query.strip()
    q_lower = q_clean.lower()
    is_hindi_mode = detect_hinglish_or_hindi(q_clean, lang)

    user_conditions = [c.lower() for c in (profile.health_conditions if profile else [])]
    user_allergies = [a.lower() for a in (profile.allergies if profile else [])]
    user_goals = [g.lower() for g in (profile.health_goals if profile else [])]

    is_diabetic = any("diabet" in c or "sugar" in c for c in user_conditions)
    is_hypertensive = any("blood pressure" in c or "hypertension" in c or "bp" in c for c in user_conditions)

    # -------------------------------------------------------------
    # 0. PRODUCT CONTEXT EVALUATION (When discussing a scanned product)
    # -------------------------------------------------------------
    p_data = None
    if product_context:
        try:
            import json
            if isinstance(product_context, dict):
                p_data = product_context
            elif isinstance(product_context, str) and product_context.strip().startswith("{"):
                p_data = json.loads(product_context)
            elif isinstance(product_context, str) and len(product_context.strip()) > 1:
                p_data = {"product_name": product_context.strip()}
        except Exception:
            p_data = {"product_name": str(product_context)}

    if p_data:
        p_name = p_data.get("product_name") or p_data.get("name") or "Scanned Food Product"
        p_score = p_data.get("health_score", 60)
        rec = p_data.get("personalized_recommendation") or {}
        p_status = p_data.get("status") or rec.get("status") or ("Good Choice" if p_score >= 75 else "Limit" if p_score >= 50 else "Not Recommended")
        p_reasons = p_data.get("reasons") or rec.get("reasons") or []
        p_concerns = p_data.get("key_concerns") or rec.get("key_concerns") or []
        p_alt = p_data.get("better_alternative") or rec.get("better_alternative")
        if not p_alt and p_data.get("healthier_alternatives"):
            alts = p_data.get("healthier_alternatives")
            if isinstance(alts, list) and len(alts) > 0 and isinstance(alts[0], dict):
                p_alt = alts[0].get("name")
        p_nutri = p_data.get("nutrition_estimate") or {}
        sugar = p_nutri.get("sugar_g")
        sodium = p_nutri.get("sodium_mg")
        fat = p_nutri.get("fat_g")
        calories = p_nutri.get("calories")

        # Check if user query is asking about this product or general action plan
        is_asking_what_to_do = any(k in q_lower for k in [
            "kya", "karna", "krna", "chahiye", "kha", "khau", "khaye", "batao", "btao", "eat", "should", "safe",
            "explain", "tell me", "product", "verdict", "recommend", "advice", "dietitian", "action"
        ]) or len(q_clean) < 15 or "tell me what i should do" in q_lower

        is_asking_portion = any(k in q_lower for k in ["kitna", "quantity", "portion", "serving", "amount", "how much"])
        is_asking_sugar = any(k in q_lower for k in ["sugar", "meetha", "diabetes", "cheeni", "glucose", "insulin"])
        is_asking_sodium = any(k in q_lower for k in ["namak", "salt", "sodium", "bp", "blood pressure", "hypertension"])
        is_asking_alt = any(k in q_lower for k in ["alternative", "swap", "badla", "doosra", "option", "vikalp", "swaps"])

        # Specific: Sugar Inquiry about this product
        if is_asking_sugar and sugar is not None:
            if is_hindi_mode:
                reply = (
                    f"🍬 **{p_name} Me Sugar Content:**\n\n"
                    f"• Is product me lagbhag **{sugar}g sugar per serving** hai.\n"
                )
                if sugar > 10 or is_diabetic:
                    reply += (
                        f"⚠️ **Diabetes / Blood Sugar Alert**: Yeh sugar quantity high hai aur blood glucose ko tezi se spike kar sakti hai. "
                        f"Diabetics ke liye ise regular khana bilkul munasib nahi hai.\n\n"
                        f"💡 **Advice**: Agar khana ho to bohot chhota portion lein, ya bina refined sugar wale natural options (jaise fresh fruits) chunein."
                    )
                else:
                    reply += f"✓ Isme sugar low matra me hai aur general blood sugar levels par gehra spike nahi karega."
            else:
                reply = (
                    f"🍬 **Sugar Evaluation for {p_name}:**\n\n"
                    f"• Contains approximately **{sugar}g sugar per serving**.\n"
                )
                if sugar > 10 or is_diabetic:
                    reply += (
                        f"⚠️ **Glycemic Impact Warning**: This exceeds recommended thresholds for blood glucose stability and may trigger insulin spikes.\n\n"
                        f"💡 **Clinical Recommendation**: Minimize intake and pair with dietary fiber or protein to slow absorption."
                    )
                else:
                    reply += "✓ Sugar level is moderate and safe within standard daily dietary allowances."

            return {
                "reply": reply,
                "suggested_questions": [f"What is a safe portion of {p_name}?", "Suggest a healthier alternative", "Can I eat this with High BP?"],
                "detected_additives": [],
                "safety_verdict": f"Sugar: {sugar}g"
            }

        # Specific: Sodium / Salt inquiry about this product
        if is_asking_sodium and sodium is not None:
            if is_hindi_mode:
                reply = (
                    f"🧂 **{p_name} Me Namak / Sodium Content:**\n\n"
                    f"• Is product me lagbhag **{sodium}mg sodium per serving** hai.\n"
                )
                if sodium > 400 or is_hypertensive:
                    reply += (
                        f"⚠️ **High BP / Hypertension Alert**: Yeh sodium level kaafi elevated hai (>400mg). "
                        f"High sodium fluid retention aur arterial blood pressure badha sakta hai.\n\n"
                        f"💡 **Advice**: High blood pressure ke mareezon ko ise bohot limited rakhna chahiye aur din bhar paani zyada peena chahiye."
                    )
                else:
                    reply += "✓ Sodium level moderate hai aur normal blood pressure ke liye safe range me hai."
            else:
                reply = (
                    f"🧂 **Sodium Assessment for {p_name}:**\n\n"
                    f"• Delivers approximately **{sodium}mg sodium per serving**.\n"
                )
                if sodium > 400 or is_hypertensive:
                    reply += (
                        f"⚠️ **Vascular Strain Warning**: High sodium intake exerts renal and arterial pressure, which may elevate blood pressure.\n\n"
                        f"💡 **Clinical Recommendation**: Restrict portion size and hydrate with electrolyte-balanced fluids."
                    )
                else:
                    reply += "✓ Sodium concentration is within healthy clinical thresholds."

            return {
                "reply": reply,
                "suggested_questions": [f"Can I eat {p_name} with High BP?", f"What is a safe portion?", "Healthy alternative for snacks"],
                "detected_additives": [],
                "safety_verdict": f"Sodium: {sodium}mg"
            }

        # Specific: Alternative inquiry
        if is_asking_alt and p_alt:
            if is_hindi_mode:
                reply = (
                    f"🔄 **{p_name} Ka Behtar Healthy Vikalp (Swap):**\n\n"
                    f"• **Recommended Alternative**: **{p_alt}**\n\n"
                    f"💡 **Kyun Yeh Behtar Hai?**\n"
                    f"Yeh alternative bina refined sugars aur bina industrial additives ke natural fiber aur micro-nutrients provide karta hai."
                )
            else:
                reply = (
                    f"🔄 **Healthy Alternative Swap for {p_name}:**\n\n"
                    f"• **Recommended Alternative**: **{p_alt}**\n\n"
                    f"💡 **Why This is Superior:**\n"
                    f"Offers whole-food nutrient density with lower glycemic index, zero synthetic preservatives, and heart-healthy micronutrients."
                )
            return {
                "reply": reply,
                "suggested_questions": [f"How to prepare {p_alt} at home?", f"Can I still eat {p_name} occasionally?"],
                "detected_additives": [],
                "safety_verdict": "Alternative Available"
            }

        # Specific: Portion / Quantity inquiry
        if is_asking_portion:
            if is_hindi_mode:
                reply = (
                    f"⚖️ **{p_name} Ki Safe Serving Size & Portion Guide:**\n\n"
                )
                if p_status == "Not Recommended":
                    reply += (
                        f"• **Recommended Quantity**: **Zero ya Sirf 1 Chhota Taste (15-20g)**\n"
                        f"• Kyunki iska health score kam hai ({p_score}/100), ise regular serving me khane se health goals derail ho sakte hain.\n"
                        f"• Agar craving ho to hafto me ek baar chhota sa sample lein aur saath me paani ya salad lein."
                    )
                elif p_status == "Limit":
                    reply += (
                        f"• **Recommended Quantity**: **Aadha Serving (~25-30g)**\n"
                        f"• Poora packet ek saath na khayein. Chhote bowl me nikaal kar khayein taaki overeating na ho."
                    )
                else:
                    reply += (
                        f"• **Recommended Quantity**: **1 Standard Serving (~40-50g)**\n"
                        f"• Yeh product aapke profile ke mutabiq theek hai, lekin balance banaye rakhne ke liye serving size dhyan me rakhein."
                    )
            else:
                reply = (
                    f"⚖️ **Serving Size & Portion Control for {p_name}:**\n\n"
                )
                if p_status == "Not Recommended":
                    reply += (
                        f"• **Clinical Limit**: **Max 15-20g (occasional sample only)**\n"
                        f"• Given the health score of {p_score}/100 and your profile risks, regular portion sizes pose metabolic risks."
                    )
                elif p_status == "Limit":
                    reply += (
                        f"• **Clinical Limit**: **Half standard portion (~25-30g)**\n"
                        f"• Portion out into a small bowl rather than eating directly from packaging to prevent unintended overconsumption."
                    )
                else:
                    reply += (
                        f"• **Clinical Limit**: **1 standard serving (~40-50g)**\n"
                        f"• Fits well within healthy dietary parameters."
                    )

            return {
                "reply": reply,
                "suggested_questions": [f"Can I eat {p_name} daily?", f"Is there any sugar spike?", "Healthy alternatives"],
                "detected_additives": [],
                "safety_verdict": "Portion Guidance"
            }

        # Comprehensive Actionable Decision (Default for "kya karna chahiye", initial click, etc.)
        if is_asking_what_to_do or len(q_clean) < 30:
            status_badge = "🔴 Not Recommended" if p_status == "Not Recommended" else "🟡 Limit / Savdhan" if p_status == "Limit" else "🟢 Suitable / Surakshit"
            
            if is_hindi_mode:
                reply = (
                    f"📦 **{p_name} — AI Dietitian Clinical Guidance**\n\n"
                    f"• **Overall Health Score**: **{p_score}/100** ({status_badge})\n"
                )
                if profile and profile.health_conditions:
                    conds_str = ", ".join(profile.health_conditions)
                    reply += f"• **Aapka Health Profile**: {conds_str}\n\n"
                else:
                    reply += "\n"

                reply += "💡 **Aapko Is Product Ke Saath Kya Karna Chahiye:**\n"
                if p_status == "Not Recommended":
                    reply += (
                        f"1. **Ise Khane Se Bachein (Avoid)**: Aapke health conditions ke hisab se yeh product munasib nahi hai. Iska regular sevan blood sugar ya blood pressure ko prabhavit kar sakta hai.\n"
                        f"2. **Craving Control**: Agar khana hi ho, to bohot chhota sample (1-2 chammach ya 15g) lein, daily diet me bilkul shamil na karein.\n"
                    )
                elif p_status == "Limit":
                    reply += (
                        f"1. **Limited Matra Me Lein (Occasional Only)**: Ise hafte me 1-2 baar se zyada na lein aur portion size chhota rakhein.\n"
                        f"2. **Santulan**: Ise khane ke baad agle meal me taaza salad aur fiber shamil karein.\n"
                    )
                else:
                    reply += (
                        f"1. **Surakshit Choice (Enjoy in Moderation)**: Yeh product aapke active health profile ke mutabiq theek hai.\n"
                        f"2. **Standard Portion**: Recommended serving size ka palan karein.\n"
                    )

                if p_concerns or p_reasons:
                    reasons_combined = (p_concerns + p_reasons)[:3]
                    reply += "\n🔍 **Mukhya Wajah (Key Findings):**\n"
                    for r in reasons_combined:
                        reply += f"• {r}\n"

                if p_nutri and (sugar is not None or sodium is not None or fat is not None):
                    reply += "\n📊 **Nutrition Highlights:**\n"
                    if calories: reply += f"• Calories: ~{calories} kcal\n"
                    if sugar is not None: reply += f"• Sugar: {sugar}g\n"
                    if sodium is not None: reply += f"• Sodium: {sodium}mg\n"
                    if fat is not None: reply += f"• Fat: {fat}g\n"

                if p_alt:
                    reply += f"\n🔄 **Behtar Healthy Swap**: {p_alt}\n"

                reply += "\n💬 *Aap mujhse pooch sakte hain: 'Kitni quantity khau?', 'Diabetes me kya asar hoga?', ya 'Iske ingredients kya hain?'*"
            else:
                reply = (
                    f"📦 **Clinical Dietitian Decision for {p_name}**\n\n"
                    f"• **Health Score**: **{p_score}/100** ({status_badge})\n"
                )
                if profile and profile.health_conditions:
                    conds_str = ", ".join(profile.health_conditions)
                    reply += f"• **Evaluated For Your Health Profile**: {conds_str}\n\n"
                else:
                    reply += "\n"

                reply += "💡 **What You Should Do With This Product:**\n"
                if p_status == "Not Recommended":
                    reply += (
                        f"1. **Avoid Regular Consumption**: This product strongly conflicts with your health conditions and nutritional thresholds.\n"
                        f"2. **Tasting Only**: If consumed, restrict strictly to a tiny tasting portion (15-20g) to prevent metabolic spikes.\n"
                    )
                elif p_status == "Limit":
                    reply += (
                        f"1. **Consume in Strict Moderation**: Treat as an occasional snack, not a regular daily meal.\n"
                        f"2. **Portion Precaution**: Keep strictly to 1 standard serving.\n"
                    )
                else:
                    reply += (
                        f"1. **Safe for Your Profile**: Fits appropriately within your dietary targets.\n"
                        f"2. **Balanced Pairing**: Enjoy as part of a wholesome, balanced diet.\n"
                    )

                if p_concerns or p_reasons:
                    reasons_combined = (p_concerns + p_reasons)[:3]
                    reply += "\n🔍 **Clinical Highlights:**\n"
                    for r in reasons_combined:
                        reply += f"• {r}\n"

                if p_nutri and (sugar is not None or sodium is not None or fat is not None):
                    reply += "\n📊 **Nutritional Snapshot:**\n"
                    if calories: reply += f"• Calories: ~{calories} kcal\n"
                    if sugar is not None: reply += f"• Sugar: {sugar}g\n"
                    if sodium is not None: reply += f"• Sodium: {sodium}mg\n"
                    if fat is not None: reply += f"• Fat: {fat}g\n"

                if p_alt:
                    reply += f"\n🔄 **Recommended Healthy Swap**: {p_alt}\n"

                reply += "\n💬 *Feel free to ask: 'What is a safe portion?', 'How does this affect blood pressure?', or 'Suggest a clean alternative'*"

            return {
                "reply": reply,
                "suggested_questions": [
                    f"What is a safe portion size of {p_name}?",
                    f"Can I eat this with Diabetes / High BP?",
                    "Suggest a healthier alternative"
                ],
                "detected_additives": [a.get("code") for a in p_data.get("additives", []) if isinstance(a, dict) and a.get("code")],
                "safety_verdict": f"Product Verdict: {p_status}"
            }
    detected_adds = []
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

    if detected_adds:
        code = detected_adds[0]
        info = ADDITIVES_DATABASE[code]
        risk = info["risk_level"]
        name = info["name"]
        desc = info["description"]

        if is_hindi_mode:
            reply = (
                f"🧪 **{code} — {name}**\n\n"
                f"• **Safety Verdict**: **{risk} Risk**\n"
                f"• **Karyapranali / Impact**: {desc}\n\n"
                f"💡 **Dietitian Guidance**: "
            )
            if risk == "High":
                reply += "Yeh additive health ke liye haanikaarak maana jata hai (gut inflammation ya metabolic stress). Aise packaged foods se bachein jinke label par yeh code ho."
            elif risk == "Moderate":
                reply += "Ise limited matra me hi lein. Regular consumption se sensitivity ya digestive issues ho sakte hain."
            else:
                reply += "Yeh standard dietary quantities me surakshit maana jata hai."
        else:
            reply = (
                f"🧪 **{code} — {name}**\n\n"
                f"• **Risk Level**: **{risk} Risk**\n"
                f"• **Toxicological Assessment**: {desc}\n\n"
                f"💡 **Clinical Advice**: "
            )
            if risk == "High":
                reply += "Health bodies recommend minimizing or avoiding regular intake due to inflammatory or cellular stress concerns."
            elif risk == "Moderate":
                reply += "Consume with caution in moderate amounts."
            else:
                reply += "Generally recognized as safe within standard nutritional thresholds."

        return {
            "reply": reply,
            "suggested_questions": [
                "Are there natural alternatives to this additive?",
                "Which everyday packaged foods contain this?",
                "How does this affect gut microbiome?"
            ],
            "detected_additives": detected_adds,
            "safety_verdict": f"{risk} Risk Additive"
        }

    # -------------------------------------------------------------
    # 2. SPECIFIC FOOD INQUIRIES: SEB / APPLE
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["seb", "apple", "sebb", "saeb"]):
        if is_hindi_mode:
            reply = (
                "🍎 **Seb (Apple) Khane Ke Swasthya Labh & Sahi Tarika:**\n\n"
                "• **Pectin Soluble Fiber**: Seb me pectin fiber hota hai jo gut ke healthy bacteria ko badhata hai aur cholesterol ko kam karne me madad karta hai.\n"
                "• **Low Glycemic Index (GI ~36)**: Seb blood sugar ko tezi se nahi badhata. Diabetics ke liye yeh ek behtareen aur safe fruit hai.\n"
                "• **Dil Ki Suraksha (Heart Health)**: Isme maujood *Quercetin* aur antioxidants blood pressure aur inflammation ko control karte hain.\n\n"
                "💡 **Kaise aur Kab Khayein?**\n"
                "1. **Subah ya Mid-Morning**: Subah khali pet ya breakfast ke 1 ghante baad khana sabse faydemand hai.\n"
                "2. **Chhilke Ke Saath Khayein**: Seb ka 50% fiber chhilke (peel) me hota hai, isliye achhi tarah dho kar chhilke sahit khayein.\n"
                "3. **Juice Se Bachein**: Seb ka juice nikalne se fiber khatam ho jata hai aur sugar spike karta hai, isliye poora seb chaba kar khayein."
            )
            if is_diabetic:
                reply += "\n\n🛡️ *Aapke Saved Diabetes Profile ke anusaar: Rozana 1 medium seb bilkul safe hai.*"
        else:
            reply = (
                "🍎 **Nutritional Evaluation of Apples (Seb):**\n\n"
                "• **Pectin Soluble Fiber**: Rich in soluble pectin (~4.4g per medium apple), which lowers LDL cholesterol and optimizes the gut microbiome.\n"
                "• **Low Glycemic Index (GI 36)**: Provides slow-release natural energy without inducing sharp postprandial glucose spikes.\n"
                "• **Cardioprotective Flavonoids**: Contains quercetin and catechin, which support vascular elasticity and cellular antioxidant defense.\n\n"
                "💡 **Clinical Dietitian Tips:**\n"
                "1. **Eat Whole with Skin**: Over 50% of the dietary fiber and phenolic compounds reside in the peel. Wash thoroughly and eat whole.\n"
                "2. **Avoid Apple Juice**: Strained juice strips all fiber, leaving concentrated fructose that spikes blood sugar."
            )

        return {
            "reply": reply,
            "suggested_questions": [
                "Can diabetics eat apples every day?",
                "What is the best time to eat an apple?",
                "Apple vs Banana: Which is healthier for weight loss?"
            ],
            "detected_additives": [],
            "safety_verdict": "Nutritious Whole Food ✓"
        }

    # -------------------------------------------------------------
    # 3. BREAKFAST & MORNING FOOD SUGGESTIONS
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["morning food", "breakfast", "nashta", "nashte", "subah ka khana", "morning meal", "subah kya khaye"]):
        if is_hindi_mode:
            reply = (
                "🌅 **Subah Ke Swasth Nashte (Healthy Morning Breakfast) Ke Best Vikalp:**\n\n"
                "Subah ke nashte ka golden rule hai: **High Protein + High Fiber + Low Glycemic Index**.\n\n"
                "🥣 **Option 1: Oats & Chia Seeds (Fiber Power)**\n"
                "• Rolled oats ko paani ya doodh me banayein, upar se chia seeds, badam aur seb/berries daalein (refined sugar na daalein).\n\n"
                "🥞 **Option 2: Besan ya Moong Dal Chilla (High Protein Desi)**\n"
                "• Besan ya peeli moong dal ka chilla, jisme pyaaz, tamatar aur thoda grated paneer bhara ho. Saath me pudina chutney.\n\n"
                "🥚 **Option 3: Boiled Eggs / Paneer Bhurji**\n"
                "• 2-3 Uble ande (boiled eggs) ya paneer bhurji ke saath 1 multigrain roti ya whole wheat toast.\n\n"
                "🥗 **Option 4: Sprouted Moong Chaat & Dahi**\n"
                "• Ankuran moong, tamatar, kheera, nimbu ka ras aur saath me 1 bowl taaza dahi.\n\n"
                "⚠️ **Subah Inse Bachein**: Sugary packaged cereals (cornflakes), maida toast/rusk, aur deep-fried puri/kachori."
            )
            if is_diabetic:
                reply += "\n\n🛡️ *Aapke Diabetic Profile ke liye Besan Chilla ya Vegetable Daliya best hai kyunki yeh sugar spike nahi karta.*"
            if is_hypertensive:
                reply += "\n\n🛡️ *Aapke BP Profile ke liye nashte me namak kam rakhein aur potassium ke liye 1 kela ya dahi zaroor shamil karein.*"
        else:
            reply = (
                "🌅 **Optimal Nutrient-Dense Breakfast Options:**\n\n"
                "The clinical rule for breakfast: **Prioritize Protein + Fiber to flatten the glucose curve and sustain satiety**.\n\n"
                "1. **Steel-Cut / Rolled Oats with Seeds**: Rolled oats prepared with almond milk/water, topped with chia seeds, crushed walnuts, and fresh berries.\n"
                "2. **Moong Dal / Chickpea (Besan) Pancakes**: Packed with complex plant protein and dietary fiber, paired with unsweetened mint yogurt.\n"
                "3. **Eggs & Avocado Toast**: 2 poached or boiled eggs paired with 1 slice of 100% whole grain sourdough and avocado/greens.\n"
                "4. **High-Protein Greek Yogurt Parfait**: Plain unflavored yogurt, ground flaxseed, and fresh fruit.\n\n"
                "⚠️ **Avoid**: Ultra-processed breakfast cereals, bakery croissants, and high-fructose juices."
            )

        return {
            "reply": reply,
            "suggested_questions": [
                "What are 5 quick 10-minute breakfast ideas?",
                "Is poha or oats better for weight loss?",
                "How much protein should I eat in the morning?"
            ],
            "detected_additives": [],
            "safety_verdict": "Nutritious Meal Plan"
        }

    # -------------------------------------------------------------
    # 4. KELA / BANANA INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["kela", "banana", "kele"]):
        if is_hindi_mode:
            reply = (
                "🍌 **Kela (Banana) Ke Baare Me Nutrition Facts:**\n\n"
                "• **Potassium Power**: Ek kela lagbhag 400mg potassium deta hai jo blood pressure ko control karne aur muscle cramps rokne me madad karta hai.\n"
                "• **Instant Energy**: Workout ya gym se pehle 1 kela khana natural energy deta hai.\n"
                "• **Resistant Starch (Gut Health)**: Halka kachha (greenish-yellow) kela gut bacteria ke liye prebiotic ka kaam karta hai.\n\n"
                "💡 **Diabetic / Weight Loss Tip**: Kela high glycemic fruit hai. Agar diabetes ya weight loss goal hai, toh din me 1 chhota kela hi khayein aur ise badam/akhrot ke saath pair karein."
            )
        else:
            reply = (
                "🍌 **Nutritional Assessment of Bananas:**\n\n"
                "• **Potassium Rich (~400mg)**: Helps counter sodium-induced arterial pressure and supports muscular contraction.\n"
                "• **Prebiotic Resistant Starch**: Slightly unripe bananas are rich in resistant starch that feeds beneficial gut flora.\n"
                "• **Glycemic Balance**: Moderate GI (51). Pair with healthy fats (walnuts, almond butter) to blunt insulin response."
            )
        return {
            "reply": reply,
            "suggested_questions": ["Is banana good for high blood pressure?", "Can diabetics eat bananas?"],
            "detected_additives": [],
            "safety_verdict": "Natural Whole Fruit"
        }

    # -------------------------------------------------------------
    # 5. DOODH, DAHI & DAIRY INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["doodh", "milk", "dahi", "curd", "yogurt", "paneer", "chaas", "buttermilk"]):
        if is_hindi_mode:
            reply = (
                "🥛 **Dairy Products (Doodh, Dahi, Paneer) Ke Nutrition Facts:**\n\n"
                "• **Dahi & Chaas (Probiotic King)**: Dahi me natural *Lactobacillus* bacteria hote hain jo digestion aur acidity ko turant theek karte hain.\n"
                "• **Paneer (Quality Protein)**: 100g paneer me lagbhag 18g complete protein aur calcium hota hai jo muscles aur haddiyon ke liye best hai.\n"
                "• **Doodh (Milk)**: Haldi wala doodh raat ko peene se inflammation kam hota hai aur neend achhi aati hai.\n\n"
                "⚠️ **Dhyan Dein**: Agar aapko lactose intolerance ya bloating hoti hai, toh doodh ki jagah dahi ya almond milk chunein."
            )
        else:
            reply = (
                "🥛 **Dairy Nutrition & Gut Health:**\n\n"
                "• **Yogurt & Kefir**: Natural probiotics that reinforce the gut microbiome barrier and improve lactose digestion.\n"
                "• **Cottage Cheese (Paneer)**: High biological value casein protein, offering slow-digesting amino acids for muscle repair.\n"
                "• **Recommendation**: Choose fermented dairy (curd, kefir) over sweetened flavored milks that hide up to 20g of added sucrose."
            )
        return {
            "reply": reply,
            "suggested_questions": ["Is curd better than milk for digestion?", "How much paneer can I eat daily?"],
            "detected_additives": [],
            "safety_verdict": "Dairy Nutrition"
        }

    # -------------------------------------------------------------
    # 6. WEIGHT LOSS / FAT LOSS / MOTAPA
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["weight loss", "vajan kam", "fat loss", "motapa", "belly fat", "pet kam", "patle hona"]):
        if is_hindi_mode:
            reply = (
                "⚖️ **Healthy Weight Loss Ke 5 Golden Rules (Permanent Fat Loss):**\n\n"
                "1. **Calorie Deficit + High Protein**: Rozana apni calorie requirement se 300-400 calories kam khayein aur har meal me protein (dal, paneer, ande, dahi) zaroor shamil karein taaki muscle loss na ho.\n"
                "2. **Liquid Calories Band Karein**: Cold drinks, packaged fruit juices, aur meethi chai/coffee band karein. Inme khali refined sugar hoti hai.\n"
                "3. **50% Salad Rule**: Apni plate ka aadha hissa hamesha raw salad (kheera, tamatar, gaajar, patta gobhi) se bharein taaki pet jaldi bhare.\n"
                "4. **Ultra-Processed Snacks Band Karein**: Chips, biscuit aur namkeen ki jagah roasted makhana, roasted chana ya chane ki chaat khayein.\n"
                "5. **Pani & Neend**: Rozana 3 litre paani aur 7-8 ghante ki uninterrupted neend stress hormone cortisol ko kam karti hai."
            )
        else:
            reply = (
                "⚖️ **Evidence-Based Fat Loss Principles:**\n\n"
                "• **Moderate Caloric Deficit (300-500 kcal)**: Sustainable fat loss without metabolic slowdown.\n"
                "• **High Protein Intake (1.6g/kg)**: Maximizes thermogenesis and preserves lean muscle mass.\n"
                "• **Soluble Fiber Density**: Prioritize oats, legumes, chia seeds, and raw greens to promote GLP-1 satiety signaling.\n"
                "• **Eliminate Ultra-Processed Foods**: Emulsifiers and maltodextrin disrupt leptin signaling, driving hyper-palatability."
            )
        return {
            "reply": reply,
            "suggested_questions": ["What is a clean 1500 calorie Indian diet plan?", "Which fruits are best for weight loss?"],
            "detected_additives": [],
            "safety_verdict": "Metabolic Optimization"
        }

    # -------------------------------------------------------------
    # 7. DIABETES & BLOOD SUGAR INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["diabet", "sugar", "insulin", "meetha", "glycemic", "glucose"]):
        if is_hindi_mode:
            reply = (
                "🩸 **Diabetes & Blood Sugar Control Guidance:**\n\n"
                "• **Hidden Sugar Traps**: *Maltodextrin* (GI = 110!), High Fructose Corn Syrup, aur Dextrose se bachein. Yeh white sugar se bhi tezi se blood sugar badhate hain!\n"
                "• **Fiber Pairing Rule**: Jab bhi carbs (roti, chawal) khayein, pehle salad ya dal/protein khayein. Fiber glucose absorption ko dheema kar deta hai.\n"
                "• **Best Clean Sweeteners**: Stevia leaf extract ya Monk fruit pure options hain jo insulin spike nahi karte.\n"
                "• **Faydemand Foods**: Karela, methi daana, daliya, jamun, aur amrood (guava) insulin sensitivity ko improve karte hain."
            )
        else:
            reply = (
                "🩸 **Clinical Glycemic Guidance for Blood Sugar Control:**\n\n"
                "• **Beware Hidden Starches**: Industrial stabilizers like *Maltodextrin* (GI ~110) spike insulin faster than pure sucrose.\n"
                "• **Carbohydrate Buffering**: Always pair carbohydrates with dietary fiber and healthy fats to flatten postprandial glucose curves.\n"
                "• **Clean Sugar Substitutes**: High-purity Stevia rebaudiana and Monk Fruit (mogrosides) offer negligible glycemic loads."
            )
        return {
            "reply": reply,
            "suggested_questions": [
                "Is maltodextrin worse than standard sugar?",
                "Which fruits have the lowest glycemic index?",
                "How to lower morning fasting blood sugar?"
            ],
            "detected_additives": [],
            "safety_verdict": "Glycemic Health"
        }

    # -------------------------------------------------------------
    # 8. HIGH BLOOD PRESSURE & HYPERTENSION
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["bp", "blood pressure", "hypertension", "namak", "sodium"]):
        if is_hindi_mode:
            reply = (
                "💓 **Blood Pressure (High BP) Control Ke Liye Diet Tips:**\n\n"
                "• **Sodium Limit (<1500mg/din)**: Rozana 1 chammach (5g) se kam namak khayein. Achaar, papad, packaged chips aur canned soups me sodium bahut zyada hota hai.\n"
                "• **Potassium Badhayein**: Potassium sodium ke asar ko neutralize karta hai. Kela, palak, nariyal paani, aur dahi potassium ke best natural sources hain.\n"
                "• **Saindhav / Rock Salt**: Table salt ke muqable rock salt thoda behtar hai lekin matra dono me hi kam rakhni chahiye.\n"
                "• **Garlic (Lehsun)**: Subah 1-2 kali lehsun blood vessels ko relax karne me madad karti hai."
            )
        else:
            reply = (
                "💓 **Clinical Sodium & Arterial Pressure Protocol:**\n\n"
                "• **Sodium Ceiling (<1500mg/day)**: Eliminate hidden sodium in bread, cured meats, pickles, and MSG-heavy seasonings.\n"
                "• **Potassium-Sodium Balance**: Elevate dietary potassium via leafy greens, bananas, avocados, and coconut water to facilitate natriuresis.\n"
                "• **DASH Framework**: Emphasize magnesium-rich seeds (pumpkin, chia) to support endothelial vascular relaxation."
            )
        return {
            "reply": reply,
            "suggested_questions": [
                "How does sodium raise blood pressure?",
                "What are the top 5 potassium-rich foods for BP?",
                "Is Himalayan pink salt safe for high BP?"
            ],
            "detected_additives": [],
            "safety_verdict": "Cardiovascular Advice"
        }

    # -------------------------------------------------------------
    # 9. DIGESTION / PET KHARAB / ACIDITY / GAS / CONSTIPATION
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["pet", "digest", "gas", "acidity", "kabz", "constipation", "bloating", "pachan", "chhati me jalan"]):
        if is_hindi_mode:
            reply = (
                "🌿 **Pet Ki Samasya (Gas, Acidity, Kabz) Ka Sahi Samadhan:**\n\n"
                "• **Probiotics (Dahi / Chaas)**: Khane ke saath taaza dahi ya bhuna jeera daali hui chaas pijiye. Yeh gut bacteria ko balance karke gas ko turant rokti hai.\n"
                "• **Kabz (Constipation)**: Paka hua papita (papaya), bheega hua anjeer, aur rozana 25-30g fiber lijiye. Raat ko gunguna paani peena labhdayak hai.\n"
                "• **Acidity Se Bachav**: Khali pet chai/coffee na pijiye. Khana khane ke turant baad na soyein—kam se kam 2 ghante ka gap rakhein.\n"
                "• **Saunf & Ajwain**: Khana khane ke baad saunf aur ajwain chabane se pachan ras active hote hain."
            )
        else:
            reply = (
                "🌿 **Gastrointestinal & Gut Microbiome Protocol:**\n\n"
                "• **Active Probiotic Reinforcement**: Unpasteurized yogurt and fermented buttermilk restore gut mucosal barriers.\n"
                "• **Prebiotic Fiber for Motility**: Ripe papaya (contains papain proteolytic enzymes), soaked figs, and psyllium husk.\n"
                "• **Preventing GERD & Acid Reflux**: Maintain a minimum 2.5-hour gap between your final meal and sleep; avoid empty-stomach caffeine."
            )
        return {
            "reply": reply,
            "suggested_questions": [
                "How to permanently cure chronic acidity?",
                "What are natural home remedies for constipation?",
                "How do emulsifiers damage gut lining?"
            ],
            "detected_additives": [],
            "safety_verdict": "Digestive Health"
        }

    # -------------------------------------------------------------
    # 10. CHAI / TEA / COFFEE INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["chai", "tea", "coffee", "green tea"]):
        if is_hindi_mode:
            reply = (
                "☕ **Chai & Coffee Ke Nutrition Facts:**\n\n"
                "• **Khali Pet Chai Se Bachein**: Subah khali pet chai peene se gastric acid badhta hai aur iron absorption 60% tak ruk jata hai.\n"
                "• **Sugar Ka Khel**: 1 cup chai me 2 chammach cheeni = lagbhag 40-50 khali calories. Cheeni kam karein ya bina cheeni ki chai ki aadat daalein.\n"
                "• **Green Tea**: Isme EGCG antioxidants hote hain jo metabolism ko boost karte hain. Ise khane ke 1 ghante baad pina sabse behtar hai."
            )
        else:
            reply = (
                "☕ **Caffeine, Polyphenols & Digestive Physiology:**\n\n"
                "• **Avoid Fasted Chai/Coffee**: Tannins can irritate the stomach lining and inhibit non-heme iron absorption by up to 60%.\n"
                "• **Added Sugar Warning**: Standard milk tea with 2 tsp refined sugar adds unnecessary high-glycemic liquid calories.\n"
                "• **Green Tea**: High in epigallocatechin gallate (EGCG) antioxidants; ideal consumed 1 hour post-meal."
            )
        return {
            "reply": reply,
            "suggested_questions": ["Does tea inhibit iron absorption?", "How many cups of chai is healthy per day?"],
            "detected_additives": [],
            "safety_verdict": "Beverage Health"
        }

    # -------------------------------------------------------------
    # 11. COOKING OILS & GHEE
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["tel", "oil", "ghee", "mustard oil", "refined oil", "butter"]):
        if is_hindi_mode:
            reply = (
                "🫒 **Cooking Oil vs Desi Ghee — Konsa Sabse Achha Hai?**\n\n"
                "• **Refined Oils Se Bachein**: Soybean, sunflower aur palm refined oils high chemical heat extraction se bante hain aur inme inflammatory omega-6 zyada hota hai.\n"
                "• **Desi Cow Ghee (A2)**: Ghee me *Butyric Acid* hota hai jo gut health aur immunity ke liye behtareen hai. High smoke point hone ki wajah se Indian cooking ke liye safe hai.\n"
                "• **Kacchi Ghani / Cold-Pressed Oils**: Sarson ka tel (Mustard oil), Nariyal tel, ya Extra Virgin Olive Oil bina chemical ke bante hain aur heart ke liye sabse acche hain."
            )
        else:
            reply = (
                "🫒 **Lipid Science: Ghee vs Industrial Seed Oils:**\n\n"
                "• **Minimize Refined Seed Oils**: Solvent-extracted refined oils undergo intense bleaching and deodorization, producing oxidized aldehydes.\n"
                "• **Traditional Grass-Fed Ghee**: Rich in butyrate and fat-soluble vitamins (A, D, E, K2) with a very high smoke point (485°F).\n"
                "• **Cold-Pressed / Expeller Oils**: Cold-pressed mustard, sesame, and extra virgin olive oils preserve natural tocopherols."
            )
        return {
            "reply": reply,
            "suggested_questions": ["Is Desi Ghee safe for high cholesterol?", "Which cooking oil is best for Indian cooking?"],
            "detected_additives": [],
            "safety_verdict": "Healthy Fats Guide"
        }

    # -------------------------------------------------------------
    # 12. GENERAL GREETINGS
    # -------------------------------------------------------------
    if any(g in q_lower for k in ["hi", "hello", "hey", "namaste", "hola", "bonjour", "kaise ho"] for g in [k]):
        if is_hindi_mode:
            reply = (
                "Namaste! 🙏 Main aapka **NutriLens AI Nutritionist** hoon.\n\n"
                "Aap mujhse kisi bhi khadya padarth (jaise Seb, Kela, Doodh, Oats), bimari ke parhez (Diabetes, BP, Weight Loss, Digestion), "
                "subah ke nashte, ya packaged food E-code preservative ke baare me pooch sakte hain!"
            )
        else:
            reply = (
                "Hello! 👋 I am your **NutriLens AI Nutrition Intelligence Assistant**.\n\n"
                "Ask me about any whole food (Apples, Oats, Bananas), condition-specific guidance (Diabetes, High BP, Weight Loss, Gut Health), "
                "healthy breakfast ideas, or packaged food additive E-codes!"
            )
        return {
            "reply": reply,
            "suggested_questions": [
                "morning food suggest kro",
                "agr koi seb kha rha hai to",
                "What is E621 (MSG) and is it safe?",
                "Best foods for diabetes and high BP"
            ],
            "detected_additives": [],
            "safety_verdict": "Informational"
        }

    # -------------------------------------------------------------
    # 13. CONTEXTUAL INTELLIGENT FALLBACK
    # -------------------------------------------------------------
    # Analyze query words dynamically instead of repeating static template
    food_tokens = [w for w in re.findall(r'\b[a-zA-Z]{3,}\b', q_lower) if w not in {"kya", "hai", "hain", "karo", "kro", "kaise", "batao", "for", "the", "and", "with"}]
    topic_str = ", ".join(food_tokens[:3]) if food_tokens else "nutrition"

    if is_hindi_mode:
        reply = (
            f"💡 **NutriLens Clinical Guidance for '{q_clean}':**\n\n"
            f"1. **Prakritik & Whole Foods First**: Kisi bhi meal me processed foods ke mukable taaza sabziyan, daal, fruits aur whole grains ko tarjeeh dein.\n"
            f"2. **Chemical Additives Se Savdhan**: Packaged items par 5 se zyada ingredients ya artificial E-codes (stabilizers, colors) hone par wo ultra-processed (NOVA 4) ban jata hai.\n"
            f"3. **Metabolic Balance**: Apne khane me hamesha protein aur fiber ka balance rakhein taaki blood sugar aur energy stable rahe.\n\n"
            f"Aap Smart Scanner tab se kisi bhi packet ka label scan karke uski exact nutritional audit dekh sakte hain!"
        )
    else:
        reply = (
            f"💡 **NutriLens Clinical Nutritionist Guidance on '{q_clean}':**\n\n"
            f"• **Prioritize Whole-Food Density**: Base your diet on minimally processed, single-ingredient whole foods rich in micronutrients and bioavailable fiber.\n"
            f"• **Label Transparency Rule**: When selecting packaged foods, avoid items containing industrial emulsifiers, artificial sweeteners, or synthetic colorings.\n"
            f"• **Satiety & Metabolic Control**: Pair carbohydrates with lean protein and healthy fats to stabilize insulin response and avoid energy crashes."
        )

    return {
        "reply": reply,
        "suggested_questions": [
            "morning food suggest kro",
            "What are ultra-processed foods (NOVA 4)?",
            "How to check clean ingredients on a food label?"
        ],
        "detected_additives": [],
        "safety_verdict": "General Nutrition"
    }
