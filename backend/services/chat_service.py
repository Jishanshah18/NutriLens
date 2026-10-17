"""
NutriLens Intelligent Conversational Nutrition Engine.
Multi-lingual support:
- Hindi (hi): Pure Devanagari Hindi script with rich clinical vocabulary.
- Spanish (es): Standard Spanish nutrition guidance.
- French (fr): Standard French nutrition guidance.
- English (en): English clinical nutrition intelligence.
- Hinglish (Roman Hindi): Conversational Romanized Hindi when English mode detects local slang.
"""

import re
from typing import Dict, Any, List, Optional
from models.schemas import UserProfile
from ml.knowledge import ADDITIVES_DATABASE, ALLERGEN_TAXONOMY


def detect_language_mode(text: str, lang_code: str) -> str:
    """
    Determines output language mode: 'hi', 'es', 'fr', 'hinglish', or 'en'.
    User's explicitly selected language takes precedence.
    """
    code = (lang_code or "").strip().lower()
    if code in ("hi", "hindi"):
        return "hi"
    if code in ("es", "spanish", "espanol"):
        return "es"
    if code in ("fr", "french", "francais"):
        return "fr"

    # Check for Devanagari characters in text
    if re.search(r'[\u0900-\u097F]', text):
        return "hi"

    # If code is 'en' or unset, check if user is typing in conversational Hinglish
    hinglish_markers = {
        "kya", "hai", "hain", "karo", "kro", "kaise", "batao", "btao", "fayde", "fayda",
        "nuksan", "khaye", "khana", "seb", "kela", "doodh", "chawal", "roti", "subah",
        "nashta", "dopahar", "raat", "pet", "vajan", "motapa", "kam", "zyada", "namak",
        "tel", "meetha", "accha", "bura", "agr", "agar", "koi", "chahiye", "kr", "kar",
        "raha", "rahe", "hoga", "hogi", "shuru", "peena", "peene", "khau", "sakte", "wali"
    }
    tokens = set(re.findall(r'\b[a-zA-Z]+\b', text.lower()))
    if len(tokens.intersection(hinglish_markers)) >= 1:
        return "hinglish"

    return "en"


def generate_smart_nutrition_response(
    query: str,
    lang: str = "en",
    profile: Optional[UserProfile] = None,
    product_context: Optional[str] = None
) -> Dict[str, Any]:
    q_clean = query.strip()
    q_lower = q_clean.lower()
    mode = detect_language_mode(q_clean, lang)

    user_conditions = [c.lower() for c in (profile.health_conditions if profile else [])]
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
        p_name = p_data.get("product_name") or p_data.get("name") or "Scanned Product"
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

        is_asking_what_to_do = any(k in q_lower for k in [
            "kya", "karna", "krna", "chahiye", "kha", "khau", "khaye", "batao", "btao", "eat", "should", "safe",
            "explain", "tell me", "product", "verdict", "recommend", "advice", "dietitian", "action"
        ]) or len(q_clean) < 15 or "tell me what i should do" in q_lower

        is_asking_portion = any(k in q_lower for k in ["kitna", "quantity", "portion", "serving", "amount", "how much", "cuanto", "combien"])
        is_asking_sugar = any(k in q_lower for k in ["sugar", "meetha", "diabetes", "cheeni", "glucose", "azucar", "sucre"])
        is_asking_sodium = any(k in q_lower for k in ["namak", "salt", "sodium", "bp", "blood pressure", "hypertension", "sal", "sel"])
        is_asking_alt = any(k in q_lower for k in ["alternative", "swap", "badla", "doosra", "option", "vikalp", "alternativa"])

        # Sugar Inquiry
        if is_asking_sugar and sugar is not None:
            if mode == "hi":
                reply = (
                    f"🍬 **{p_name} में शुगर (शर्करा) की मात्रा:**\n\n"
                    f"• इस उत्पाद में लगभग **{sugar}g शुगर प्रति सर्विंग** है।\n"
                )
                if sugar > 10 or is_diabetic:
                    reply += (
                        f"⚠️ **डायबिटीज व ब्लड शुगर चेतावनी**: यह मात्रा अधिक है और रक्त शर्करा को तेजी से बढ़ा सकती है। "
                        f"डायबिटीज वाले व्यक्तियों को इसे नियमित रूप से नहीं खाना चाहिए।\n\n"
                        f"💡 **सलाह**: यदि खाना ही हो तो बहुत कम मात्रा लें, या बिना रिफाइंड चीनी वाले प्राकृतिक विकल्प चुनें।"
                    )
                else:
                    reply += "✓ इसमें शुगर की मात्रा सामान्य है और ब्लड शुगर पर अचानक कोई बड़ा प्रभाव नहीं पड़ेगा।"
                sq = [f"{p_name} की सुरक्षित मात्रा क्या है?", "एक स्वस्थ विकल्प बताएं", "क्या हाई बीपी में खा सकते हैं?"]
            elif mode == "es":
                reply = f"🍬 **Contenido de Azúcar en {p_name}:**\n\n• Contiene aproximadamente **{sugar}g de azúcar por porción**.\n"
                if sugar > 10 or is_diabetic:
                    reply += "⚠️ **Alerta Glucémica**: Supera el límite diario recomendado y puede disparar los niveles de glucosa en sangre.\n\n💡 **Consejo**: Limite su consumo o elija frutas frescas como alternativa."
                else:
                    reply += "✓ El nivel de azúcar es moderado y seguro dentro de los límites estándar."
                sq = [f"¿Porción segura de {p_name}?", "Sugerir alternativa saludable", "¿Apto para hipertensión?"]
            elif mode == "fr":
                reply = f"🍬 **Teneur en Sucre pour {p_name} :**\n\n• Contient environ **{sugar}g de sucre par portion**.\n"
                if sugar > 10 or is_diabetic:
                    reply += "⚠️ **Alerte Glycémique** : Cette quantité est élevée et peut provoquer un pic d'insuline.\n\n💡 **Conseil** : Limitez fortement la portion ou choisissez des alternatives sans sucre ajouté."
                else:
                    reply += "✓ La teneur en sucre est modérée et conforme aux recommandations."
                sq = [f"Portion sûre de {p_name} ?", "Alternative saine", "Adapté avec de l'hypertension ?"]
            elif mode == "hinglish":
                reply = f"🍬 **{p_name} Me Sugar Content:**\n\n• Is product me lagbhag **{sugar}g sugar per serving** hai.\n"
                if sugar > 10 or is_diabetic:
                    reply += f"⚠️ **Diabetes Alert**: Yeh sugar high hai. Ise regular khana munasib nahi hai.\n\n💡 **Advice**: Chhota portion lein ya natural fruits chunein."
                else:
                    reply += "✓ Isme sugar low matra me hai aur blood sugar spike nahi karega."
                sq = [f"{p_name} kitna khana safe hai?", "Healthy alternative suggest karo"]
            else:
                reply = f"🍬 **Sugar Evaluation for {p_name}:**\n\n• Contains approximately **{sugar}g sugar per serving**.\n"
                if sugar > 10 or is_diabetic:
                    reply += "⚠️ **Glycemic Impact Warning**: This exceeds recommended thresholds for blood glucose stability.\n\n💡 **Clinical Recommendation**: Minimize intake and pair with fiber or protein."
                else:
                    reply += "✓ Sugar level is moderate and safe within standard dietary allowances."
                sq = [f"What is a safe portion of {p_name}?", "Suggest a healthier alternative", "Can I eat this with High BP?"]

            return {
                "reply": reply,
                "suggested_questions": sq,
                "detected_additives": [],
                "safety_verdict": f"Sugar: {sugar}g"
            }

        # Comprehensive Product Action
        status_badge_hi = "🔴 अनुशंसित नहीं (Not Recommended)" if p_status == "Not Recommended" else "🟡 सीमित मात्रा में (Limit)" if p_status == "Limit" else "🟢 सुरक्षित विकल्प (Good Choice)"
        status_badge_en = "🔴 Not Recommended" if p_status == "Not Recommended" else "🟡 Limit / Moderate" if p_status == "Limit" else "🟢 Safe / Good Choice"

        if mode == "hi":
            reply = (
                f"📦 **{p_name} — AI पोषण विशेषज्ञ नैदानिक मार्गदर्शन**\n\n"
                f"• **हेल्थ स्कोर (Health Score)**: **{p_score}/100** ({status_badge_hi})\n"
            )
            if profile and profile.health_conditions:
                conds_str = ", ".join(profile.health_conditions)
                reply += f"• **आपकी सक्रिय स्वास्थ्य प्रोफ़ाइल**: {conds_str}\n\n"
            else:
                reply += "\n"

            reply += "💡 **आपको इस उत्पाद के साथ क्या करना चाहिए:**\n"
            if p_status == "Not Recommended":
                reply += (
                    "१. **नियमित सेवन से बचें**: आपके स्वास्थ्य मापदंडों के अनुसार यह उत्पाद उपयुक्त नहीं है।\n"
                    "२. **क्रेविंग कंट्रोल**: यदि बहुत इच्छा हो, तो केवल १-२ चम्मच (१५-२० ग्राम) ही चखें, इसे मुख्य आहार न बनाएं।\n"
                )
            elif p_status == "Limit":
                reply += (
                    "१. **सीमित मात्रा में लें**: इसे सप्ताह में १ बार से अधिक न लें और पोर्शन साइज छोटा रखें।\n"
                    "२. **संतुलन**: इसके सेवन के बाद अगले भोजन में ताजी हरी सलाद और फाइबर अवश्य लें।\n"
                )
            else:
                reply += (
                    "१. **सुरक्षित चयन**: यह उत्पाद आपकी स्वास्थ्य प्रोफ़ाइल के अनुकूल है।\n"
                    "२. **संतुलित आहार**: मानक सर्विंग साइज का पालन करें।\n"
                )

            if p_alt:
                reply += f"\n🔄 **बेहतर और स्वस्थ विकल्प**: **{p_alt}**\n"
            reply += "\n💬 *आप मुझसे पूछ सकते हैं: 'कितनी मात्रा खाएं?', 'डायबिटीज में क्या असर होगा?', या 'इसके हानिकारक तत्व क्या हैं?'*"
            sq = [f"{p_name} की सुरक्षित मात्रा क्या है?", "एक स्वस्थ विकल्प बताएं", "क्या डायबिटीज में सुरक्षित है?"]
        elif mode == "es":
            reply = (
                f"📦 **Evaluación Nutricional para {p_name}**\n\n"
                f"• **Puntuación de Salud**: **{p_score}/100** ({status_badge_en})\n"
            )
            reply += "💡 **Qué debe hacer con este producto:**\n"
            if p_status == "Not Recommended":
                reply += "1. **Evite el consumo regular**: Este producto entra en conflicto con sus objetivos nutricionales.\n2. **Consumo mínimo**: Si lo consume, limítelo a una porción de prueba (15-20g).\n"
            elif p_status == "Limit":
                reply += "1. **Consumo moderado**: Disfrútelo ocasionalmente, respetando el tamaño de porción.\n"
            else:
                reply += "1. **Buena elección**: Se adapta adecuadamente a sus requerimientos dietéticos.\n"
            if p_alt:
                reply += f"\n🔄 **Alternativa recomendada**: {p_alt}\n"
            sq = [f"¿Porción segura de {p_name}?", "Alternativas saludables"]
        elif mode == "fr":
            reply = (
                f"📦 **Évaluation Nutritionnelle pour {p_name}**\n\n"
                f"• **Score de Santé**: **{p_score}/100** ({status_badge_en})\n"
            )
            reply += "💡 **Que devriez-vous faire :**\n"
            if p_status == "Not Recommended":
                reply += "1. **Évitez la consommation régulière** : Ce produit ne correspond pas à vos objectifs de santé.\n2. **Dégustation occasionnelle** : Ne dépassez pas 15 à 20g en cas d'envie.\n"
            elif p_status == "Limit":
                reply += "1. **À consommer avec modération** : Réservez ce produit à des occasions ponctuelles.\n"
            else:
                reply += "1. **Choix sain** : Convient parfaitement à un équilibre alimentaire.\n"
            if p_alt:
                reply += f"\n🔄 **Alternative plus saine** : {p_alt}\n"
            sq = [f"Portion recommandée de {p_name} ?", "Trouver une alternative saine"]
        elif mode == "hinglish":
            reply = (
                f"📦 **{p_name} — AI Dietitian Guidance**\n\n"
                f"• **Health Score**: **{p_score}/100** ({status_badge_en})\n\n"
                f"💡 **Aapko Is Product Ke Saath Kya Karna Chahiye:**\n"
            )
            if p_status == "Not Recommended":
                reply += "1. **Khane Se Bachein**: Health ke hisab se yeh regular lene layak nahi hai.\n2. **Craving Control**: Sirf 15-20g chhota portion hi lein.\n"
            elif p_status == "Limit":
                reply += "1. **Limited Matra Me Lein**: Hafte me 1 baar se zyada na lein.\n"
            else:
                reply += "1. **Safe Choice**: Aapke profile ke mutabiq theek hai.\n"
            if p_alt:
                reply += f"\n🔄 **Behtar Healthy Swap**: {p_alt}\n"
            sq = [f"Kitna khana safe hai?", "Healthy alternative suggest karo"]
        else:
            reply = (
                f"📦 **Clinical Dietitian Decision for {p_name}**\n\n"
                f"• **Health Score**: **{p_score}/100** ({status_badge_en})\n\n"
                f"💡 **What You Should Do With This Product:**\n"
            )
            if p_status == "Not Recommended":
                reply += "1. **Avoid Regular Consumption**: Conflicts with health thresholds.\n2. **Tasting Only**: Keep to 15-20g occasional portion.\n"
            elif p_status == "Limit":
                reply += "1. **Strict Moderation**: Treat as an occasional snack.\n"
            else:
                reply += "1. **Safe Choice**: Fits appropriately within dietary parameters.\n"
            if p_alt:
                reply += f"\n🔄 **Recommended Healthy Swap**: {p_alt}\n"
            sq = [f"What is a safe portion of {p_name}?", "Suggest a healthier alternative"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [a.get("code") for a in p_data.get("additives", []) if isinstance(a, dict) and a.get("code")],
            "safety_verdict": f"Product Verdict: {p_status}"
        }

    # -------------------------------------------------------------
    # 1. E-CODE ADDITIVES LOOKUP
    # -------------------------------------------------------------
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

        if mode == "hi":
            reply = (
                f"🧪 **एडिटिव कोड: {code} — {name}**\n\n"
                f"• **सुरक्षा मूल्यांकन**: **{risk} जोखिम (Risk Level)**\n"
                f"• **वैज्ञानिक विवरण व प्रभाव**: {desc}\n\n"
                f"💡 **पोषण विशेषज्ञ सलाह**: "
            )
            if risk == "High":
                reply += "यह एडिटिव स्वास्थ्य के लिए हानिकारक माना जाता है (गट इन्फ्लेमेशन या मेटाबॉलिक तनाव)। ऐसे पैकेज्ड खाद्य पदार्थों से पूरी तरह बचें जिनके लेबल पर यह कोड हो।"
            elif risk == "Moderate":
                reply += "इसे सीमित मात्रा में ही लें। अत्यधिक सेवन से एलर्जी या पाचन संबंधी समस्याएं हो सकती हैं।"
            else:
                reply += "यह सामान्य आहार मात्रा में सुरक्षित माना जाता है।"
            sq = ["इस एडिटिव के प्राकृतिक विकल्प क्या हैं?", "किन सामान्य खाद्य पदार्थों में यह पाया जाता है?"]
        elif mode == "es":
            reply = (
                f"🧪 **Aditivo {code} — {name}**\n\n"
                f"• **Nivel de Riesgo**: **Riesgo {risk}**\n"
                f"• **Evaluación Toxicológica**: {desc}\n\n"
                f"💡 **Recomendación Clínica**: "
            )
            reply += "Se aconseja minimizar su consumo habitual." if risk == "High" else "Consumo seguro dentro de las dosis autorizadas."
            sq = ["¿En qué alimentos se encuentra?", "¿Alternativas naturales a este aditivo?"]
        elif mode == "fr":
            reply = (
                f"🧪 **Additif {code} — {name}**\n\n"
                f"• **Niveau de Risque**: **Risque {risk}**\n"
                f"• **Évaluation Toxicologique**: {desc}\n\n"
                f"💡 **Conseil Clinique**: "
            )
            reply += "Il est recommandé d'éviter la consommation régulière de ce produit." if risk == "High" else "Considéré comme sûr dans les doses recommandées."
            sq = ["Quels aliments en contiennent ?", "Existe-t-il des substituts naturels ?"]
        elif mode == "hinglish":
            reply = (
                f"🧪 **{code} — {name}**\n\n"
                f"• **Safety Verdict**: **{risk} Risk**\n"
                f"• **Impact**: {desc}\n\n"
                f"💡 **Advice**: Aise packaged foods se bachein jinke label par yeh code ho."
            )
            sq = ["Iska natural alternative kya hai?", "Packaged food me yeh kyun daalte hain?"]
        else:
            reply = (
                f"🧪 **{code} — {name}**\n\n"
                f"• **Risk Level**: **{risk} Risk**\n"
                f"• **Toxicological Assessment**: {desc}\n\n"
                f"💡 **Clinical Advice**: "
            )
            reply += "Health bodies recommend minimizing or avoiding regular intake due to inflammatory or cellular stress concerns." if risk == "High" else "Generally recognized as safe within standard nutritional thresholds."
            sq = ["Are there natural alternatives to this additive?", "Which everyday packaged foods contain this?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": detected_adds,
            "safety_verdict": f"{risk} Risk Additive"
        }

    # -------------------------------------------------------------
    # 2. SPECIFIC FOOD INQUIRIES: SEB / APPLE
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["seb", "apple", "sebb", "saeb", "manzana", "pomme"]):
        if mode == "hi":
            reply = (
                "🍎 **सेब (Apple) खाने के स्वास्थ्य लाभ और सही तरीका:**\n\n"
                "• **पेक्टिन घुलनशील फाइबर (Pectin Fiber)**: सेब में घुलनशील पेक्टिन फाइबर होता है जो आंतों के मित्र बैक्टीरिया को पोषण देता है और खराब कोलेस्ट्रॉल (LDL) को कम करने में मदद करता है।\n"
                "• **कम ग्लाइसेमिक इंडेक्स (GI ~36)**: सेब रक्त शर्करा (Blood Sugar) को तेजी से नहीं बढ़ाता। यह डायबिटीज रोगियों के लिए भी एक सुरक्षित फल है।\n"
                "• **हृदय स्वास्थ्य व एंटीऑक्सीडेंट्स**: इसमें मौजूद क्वेरसेटिन (Quercetin) और पॉलीफेनोल्स रक्त नलिकाओं को लचीला रखते हैं और सूजन को घटाते हैं।\n\n"
                "💡 **कब और कैसे खाएं?**\n"
                "१. **सुबह के समय**: सुबह खाली पेट या नाश्ते के बाद खाना सर्वोत्तम है।\n"
                "२. **छिलके सहित खाएं**: सेब का ५०% फाइबर उसके छिलके में होता है, अतः अच्छी तरह धोकर छिलके समेत खाएं।\n"
                "३. **जूस के बजाय पूरा फल खाएं**: जूस में फाइबर नष्ट हो जाता है और फ्रुक्टोज शुगर स्पाइक करता है।"
            )
            if is_diabetic:
                reply += "\n\n🛡️ *आपकी डायबिटीज प्रोफ़ाइल के अनुसार: रोजाना १ मध्यम आकार का सेब पूरी तरह सुरक्षित है।*"
            sq = ["क्या डायबिटीज में रोजाना सेब खा सकते हैं?", "सेब खाने का सबसे अच्छा समय क्या है?", "वजन घटाने के लिए सेब या केला?"]
        elif mode == "es":
            reply = (
                "🍎 **Evaluación Nutricional de la Manzana:**\n\n"
                "• **Fibra Soluble Pectina**: Ayuda a reducir el colesterol LDL y optimiza la microbiota intestinal.\n"
                "• **Bajo Índice Glucémico (IG ~36)**: Energía sostenida sin disparar los niveles de glucosa en sangre.\n"
                "• **Cardioprotector**: Rica en quercetina y flavonoides antioxidantes.\n\n"
                "💡 **Consejo**: Cómala entera con piel bien lavada para conservar el 100% de la fibra."
            )
            sq = ["¿Pueden los diabéticos comer manzana a diario?", "¿Mejor momento para comerla?"]
        elif mode == "fr":
            reply = (
                "🍎 **Évaluation Nutritionnelle de la Pomme :**\n\n"
                "• **Fibre Pectine Soluble** : Nourrit le microbiote intestinal et régule le cholestérol sanguin.\n"
                "• **Index Glycémique Faible (IG ~36)** : Libération d'énergie stable sans pic d'insuline.\n"
                "• **Antioxydants Protecteurs** : Riche en quercétine bénéfique pour la santé cardiovasculaire.\n\n"
                "💡 **Conseil** : Consommez-la entière avec la peau préalablement lavée."
            )
            sq = ["Pomme et diabète : quelle portion ?", "Quel est le meilleur moment pour en manger ?"]
        elif mode == "hinglish":
            reply = (
                "🍎 **Rozana Ek Seb (Apple) Khane Ke Fayde:**\n\n"
                "• **Pectin Soluble Fiber**: Seb ke chilke me pectin hota hai jo cholesterol kam karta hai aur gut health sudharta hai.\n"
                "• **Low Glycemic Index (GI ~36)**: Blood sugar spike nahi karta, diabetics ke liye safe hai.\n"
                "• **Quercetin Antioxidants**: Dil aur blood pressure ke liye bohot behtar hai.\n\n"
                "💡 **Tip**: Chhilke sahit khayein, juice na nikaalein."
            )
            sq = ["Diabetics seb roz kha sakte hain?", "Seb khane ka sahi time kya hai?"]
        else:
            reply = (
                "🍎 **Nutritional Evaluation of Apples (Seb):**\n\n"
                "• **Pectin Soluble Fiber**: Rich in soluble pectin (~4.4g per medium apple), which lowers LDL cholesterol and optimizes the gut microbiome.\n"
                "• **Low Glycemic Index (GI 36)**: Provides slow-release natural energy without inducing sharp glucose spikes.\n"
                "• **Cardioprotective Flavonoids**: Contains quercetin and catechin, which support vascular elasticity.\n\n"
                "💡 **Clinical Dietitian Tips**: Eat whole with skin for maximum dietary fiber and polyphenols."
            )
            sq = ["Can diabetics eat apples every day?", "What is the best time to eat an apple?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Nutritious Whole Food ✓"
        }

    # -------------------------------------------------------------
    # 3. KELA / BANANA INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["kela", "banana", "kele", "plátano", "platano", "banane"]):
        if mode == "hi":
            reply = (
                "🍌 **केला (Banana) के पोषण तथ्य और लाभ:**\n\n"
                "• **पोटेशियम का मुख्य स्रोत**: एक मध्यम केला लगभग ४००mg पोटेशियम देता है, जो शरीर में सोडियम के असर को घटाकर ब्लड प्रेशर नियंत्रित रखता है।\n"
                "• **त्वरित प्राकृतिक ऊर्जा (Natural Energy)**: कसरत, खेल या सुबह की थकान दूर करने के लिए केला तुरंत पचने वाले प्राकृतिक कार्बोहाइड्रेट प्रदान करता है।\n"
                "• **प्रतिरोधी स्टार्च (Resistant Starch)**: हल्का कच्चा (पीला-हरा) केला आंतों के बैक्टीरिया के लिए प्रीबायोटिक का कार्य करता है।\n\n"
                "💡 **डायबिटीज व वजन नियंत्रण टिप**: पका हुआ केला मध्यम-उच्च ग्लाइसेमिक फल है। डायबिटीज में इसे बादाम या अखरोट के साथ खाना चाहिए ताकि शुगर नियंत्रित रहे।"
            )
            sq = ["क्या हाई बीपी में केला फायदेमंद है?", "क्या डायबिटीज वाले केला खा सकते हैं?"]
        elif mode == "es":
            reply = (
                "🍌 **Evaluación Nutricional del Plátano:**\n\n"
                "• **Rico en Potasio (~400mg)**: Ayuda a regular la presión arterial y prevenir calambres musculares.\n"
                "• **Almidón Resistente**: Los plátanos ligeramente verdes actúan como prebióticos para la salud intestinal.\n"
                "• **Energía Inmediata**: Excelente antes de entrenar."
            )
            sq = ["¿Es bueno el plátano para la hipertensión?", "¿Puedo comer plátano con diabetes?"]
        elif mode == "fr":
            reply = (
                "🍌 **Évaluation Nutritionnelle de la Banane :**\n\n"
                "• **Riche en Potassium (~400mg)** : Régule la tension artérielle en compensant le sodium.\n"
                "• **Amidon Résistant** : Les bananes légèrement vertes soutiennent la flore intestinale.\n"
                "• **Énergie Naturelle** : Idéale avant un effort physique."
            )
            sq = ["La banane est-elle bonne pour la tension ?", "Banane et diabète : conseils"]
        elif mode == "hinglish":
            reply = (
                "🍌 **Kela (Banana) Ke Fayde & Facts:**\n\n"
                "• **Potassium Rich (~400mg)**: BP control aur muscle cramps rokne me madad karta hai.\n"
                "• **Instant Energy**: Workout se pehle khane se natural stamina milta hai.\n"
                "• **Gut Health**: Greenish-yellow kela gut bacteria ke liye prebiotic hota hai."
            )
            sq = ["BP me kela kyu accha hai?", "Diabetic mareez kela kha sakte hain?"]
        else:
            reply = (
                "🍌 **Nutritional Assessment of Bananas:**\n\n"
                "• **Potassium Rich (~400mg)**: Counters sodium-induced arterial pressure and supports muscular health.\n"
                "• **Prebiotic Resistant Starch**: Slightly unripe bananas feed beneficial gut bacteria.\n"
                "• **Glycemic Balance**: Moderate GI (51). Pair with healthy fats (almonds, walnuts) to blunt glucose spike."
            )
            sq = ["Is banana good for high blood pressure?", "Can diabetics eat bananas?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Natural Whole Fruit"
        }

    # -------------------------------------------------------------
    # 4. BREAKFAST & MORNING FOOD SUGGESTIONS
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["morning food", "breakfast", "nashta", "nashte", "subah ka khana", "morning meal", "subah kya khaye", "desayuno", "petit dejeuner", "petit-déjeuner"]):
        if mode == "hi":
            reply = (
                "🌅 **सुबह के स्वस्थ नाश्ते (Healthy Morning Breakfast) के सर्वश्रेष्ठ विकल्प:**\n\n"
                "नाश्ते का स्वर्णिम नियम: **उच्च प्रोटीन + उच्च फाइबर + कम ग्लाइसेमिक इंडेक्स**।\n\n"
                "🥣 **विकल्प १: ओट्स और चिया सीड्स (फाइबर पावर)**\n"
                "• रोल्ड ओट्स को पानी या दूध में पकाएं, ऊपर से चिया सीड्स, बादाम और ताजे फल मिलाएं (सफेद चीनी बिल्कुल न डालें)।\n\n"
                "🥞 **विकल्प २: मूंग दाल या बेसन का चीला (देशी प्रोटीन)**\n"
                "• पीली मूंग दाल या बेसन का चीला, जिसमें बारीक कटा प्याज, टमाटर और कद्दूकस किया हुआ पनीर भरा हो, साथ में पुदीने की हरी चटनी।\n\n"
                "🥚 **विकल्प ३: उबले अंडे / पनीर भुर्जी**\n"
                "• २-३ उबले अंडे या ताजे पनीर की भुर्जी के साथ १ मल्टीग्रेन रोटी।\n\n"
                "🥗 **विकल्प ४: अंकुरित मूंग चाट और ताजा दही**\n"
                "• अंकुरित मूंग, खीरा, टमाटर, नींबू का रस और १ कटोरी ताजा दही।\n\n"
                "⚠️ **सुबह इनसे बचें**: पैकेट वाले मीठे कॉर्नफ्लेक्स, मैदा टोस्ट/रस्क और अधिक तली हुई पूड़ी-कचौरी।"
            )
            if is_diabetic:
                reply += "\n\n🛡️ *डायबिटीज प्रोफ़ाइल के लिए: बेसन का चीला या वेजिटेबल दलिया सर्वोत्तम है क्योंकि यह शुगर स्पाइक नहीं करता।*"
            if is_hypertensive:
                reply += "\n\n🛡️ *हाई बीपी प्रोफ़ाइल के लिए: नाश्ते में नमक कम रखें और पोटेशियम के लिए १ केला या दही अवश्य शामिल करें।*"
            sq = ["१० मिनट में बनने वाले स्वस्थ नाश्ते", "वजन घटाने के लिए पोहा या ओट्स कौन सा बेहतर है?"]
        elif mode == "es":
            reply = (
                "🌅 **Opciones de Desayuno Nutritivo y Saludable:**\n\n"
                "Regla de oro: **Proteína + Fibra para aplanar la curva de glucosa y mantener la saciedad**.\n\n"
                "1. **Avena con Semillas de Chía**: Preparada con agua o bebida vegetal, nueces y frutos rojos.\n"
                "2. **Huevos Revueltos o Pochados**: Con tostada 100% integral y aguacate.\n"
                "3. **Yogur Griego Natural**: Con semillas de lino y fruta fresca picada.\n\n"
                "⚠️ **Evite**: Cereales ultraprocesados de caja y bollería industrial."
            )
            sq = ["¿Qué desayunar para bajar de peso?", "¿Cuánta proteína tomar por la mañana?"]
        elif mode == "fr":
            reply = (
                "🌅 **Options de Petit-Déjeuner Sain et Équilibré :**\n\n"
                "Règle clé : **Protéines + Fibres pour stabiliser la glycémie et prolonger la satiété**.\n\n"
                "1. **Flocons d'Avoine et Graines de Chia** : Avec du lait végétal, des noix et des baies fraîches.\n"
                "2. **Œufs Pochés et Pain Complet** : Accompagnés d'avocat et de légumes verts.\n"
                "3. **Fromage Blanc ou Yaourt Grec** : Sans sucre ajouté, avec des graines de lin et un fruit frais.\n\n"
                "⚠️ **À éviter** : Céréales industrielles sucrées et viennoiseries."
            )
            sq = ["Idées de petit-déjeuner minceur", "Combien de protéines au réveil ?"]
        elif mode == "hinglish":
            reply = (
                "🌅 **Swasth Subah Ka Nashta (Healthy Breakfast Guide):**\n\n"
                "Golden Rule: **High Protein + High Fiber + Low Glycemic Index**.\n\n"
                "• **Option 1**: Oats + Chia seeds + Almonds (Bina cheeni).\n"
                "• **Option 2**: Moong dal ya Besan ka Chilla paneer ke saath.\n"
                "• **Option 3**: Boiled eggs ya paneer bhurji + multigrain roti.\n"
                "• **Option 4**: Sprouted moong chaat + taaza dahi.\n\n"
                "⚠️ Cornflakes, maida toast aur fried puri se bachein."
            )
            sq = ["Subah sabse accha nashta kya hai?", "Poha vs Oats for weight loss"]
        else:
            reply = (
                "🌅 **Optimal Nutrient-Dense Breakfast Options:**\n\n"
                "The clinical rule: **Prioritize Protein + Fiber to flatten glucose spikes and sustain satiety**.\n\n"
                "1. **Steel-Cut Oats with Seeds**: Rolled oats with almond milk, chia seeds, walnuts, and fresh berries.\n"
                "2. **Moong Dal / Chickpea Protein Pancakes**: Complex plant protein and fiber with mint yogurt.\n"
                "3. **Eggs & Avocado on Sourdough**: 2 poached eggs with 100% whole grain sourdough and greens.\n"
                "4. **High-Protein Greek Yogurt Parfait**: Plain unsweetened yogurt with flaxseed and fresh fruit.\n\n"
                "⚠️ **Avoid**: Ultra-processed breakfast cereals, bakery croissants, and high-sugar juices."
            )
            sq = ["What are 5 quick 10-minute breakfast ideas?", "Is poha or oats better for weight loss?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Nutritious Meal Plan"
        }

    # -------------------------------------------------------------
    # 5. DOODH, DAHI & DAIRY INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["doodh", "milk", "dahi", "curd", "yogurt", "paneer", "chaas", "buttermilk", "leche", "lait"]):
        if mode == "hi":
            reply = (
                "🥛 **डेयरी उत्पाद (दूध, दही, पनीर) पोषण तथ्य व लाभ:**\n\n"
                "• **दही और छाछ (प्रोबायोटिक्स का राजा)**: दही में प्राकृतिक *लैक्टोबैसिलस* बैक्टीरिया होते हैं जो आंतों के माइक्रोबायोम को मजबूत करते हैं और एसिडिटी को तुरंत शांत करते हैं।\n"
                "• **पनीर (शुद्ध प्रोटीन)**: १०० ग्राम पनीर में लगभग १८ ग्राम उच्च जैविक मूल्य वाला प्रोटीन और प्रचुर कैल्शियम होता है, जो मांसपेशियों और हड्डियों की मजबूती के लिए उत्तम है।\n"
                "• **हल्दी वाला दूध**: रात में गुनगुना हल्दी वाला दूध पीने से शरीर की सूजन कम होती है और गहरी नींद आती है।\n\n"
                "⚠️ **ध्यान दें**: यदि आपको लैक्टोज से पेट फूलने (Bloating) की समस्या हो, तो सादे दूध के स्थान पर दही या बादाम का दूध चुनें।"
            )
            sq = ["क्या पाचन के लिए दूध से दही बेहतर है?", "रोजाना कितना पनीर खाना सुरक्षित है?"]
        elif mode == "es":
            reply = (
                "🥛 **Nutrición Láctea y Salud Intestinal:**\n\n"
                "• **Yogur Natural**: Probióticos naturales que refuerzan la barrera intestinal y mejoran la digestión.\n"
                "• **Queso Fresco**: Excelente fuente de proteína caseína de absorción lenta.\n"
                "• **Recomendación**: Evite los lácteos saborizados con azúcares añadidos."
            )
            sq = ["¿Es mejor el yogur que la leche para la digestión?", "¿Cuánto queso comer al día?"]
        elif mode == "fr":
            reply = (
                "🥛 **Nutrition Laitière et Microbiote :**\n\n"
                "• **Yaourt et Lait Fermenté** : Riches en probiotiques naturels pour une flore intestinale saine.\n"
                "• **Fromage Blanc** : Protéine de caséine idéale pour la récupération musculaire.\n"
                "• **Conseil** : Privilégiez les produits nature sans sucre ajouté."
            )
            sq = ["Le yaourt est-il plus digeste que le lait ?", "Quelle quantité de fromage par jour ?"]
        elif mode == "hinglish":
            reply = (
                "🥛 **Dairy Products (Doodh, Dahi, Paneer) Facts:**\n\n"
                "• **Dahi & Chaas**: Natural probiotics digestion aur gas ko theek karte hain.\n"
                "• **Paneer**: 100g paneer me ~18g quality protein hota hai.\n"
                "• **Haldi Doodh**: Inflammation kam karta hai aur neend achhi aati hai."
            )
            sq = ["Dahi doodh se behtar kyu hai?", "Paneer kitna khayein?"]
        else:
            reply = (
                "🥛 **Dairy Nutrition & Gut Health:**\n\n"
                "• **Yogurt & Kefir**: Natural probiotics that reinforce gut mucosal integrity and aid digestion.\n"
                "• **Cottage Cheese (Paneer)**: High biological value casein protein offering sustained amino acid release.\n"
                "• **Recommendation**: Choose fermented, unsweetened dairy over commercial flavored milks with hidden sugars."
            )
            sq = ["Is curd better than milk for digestion?", "How much paneer can I eat daily?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Dairy Nutrition"
        }

    # -------------------------------------------------------------
    # 6. WEIGHT LOSS / FAT LOSS / MOTAPA
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["weight loss", "vajan kam", "fat loss", "motapa", "belly fat", "pet kam", "patle hona", "perder peso", "perte de poids"]):
        if mode == "hi":
            reply = (
                "⚖️ **स्थायी वजन घटाने (Weight Loss) के ५ वैज्ञानिक नियम:**\n\n"
                "१. **कैलोरी डेफिसिट + उच्च प्रोटीन**: अपनी दैनिक आवश्यकता से ३००-४०० कैलोरी कम लें और हर भोजन में प्रोटीन (दालें, पनीर, अंडे, दही) शामिल करें ताकि मांसपेशियां सुरक्षित रहें।\n"
                "२. **तरल कैलोरी (Liquid Calories) बंद करें**: कोल्ड ड्रिंक्स, डिब्बाबंद जूस और मीठी चाय-कॉफी पूरी तरह बंद करें। इनमें केवल खाली शुगर होती है।\n"
                "३. **५०% सलाद का नियम**: अपनी थाली का आधा भाग हमेशा कच्ची ताजी सलाद (खीरा, टमाटर, गाजर) से भरें ताकि तृप्ति मिले।\n"
                "४. **अल्ट्रा-प्रोसेस्ड स्नैक्स हटाएं**: चिप्स और बिस्कुट की जगह भुने मखाने, भुने चने या रोस्टेड अलसी के बीज खाएं।\n"
                "५. **भरपूर पानी और गहरी नींद**: रोजाना ३ लीटर पानी पिएं और ७-८ घंटे की पूरी नींद लें, इससे स्ट्रेस हार्मोन कोर्टिसोल नियंत्रित रहता है।"
            )
            sq = ["१५०० कैलोरी का स्वस्थ भारतीय डाइट चार्ट", "वजन घटाने के लिए कौन से फल सबसे अच्छे हैं?"]
        elif mode == "es":
            reply = (
                "⚖️ **Principios Científicos para Perder Grasa:**\n\n"
                "• **Déficit Calórico Moderado (300-500 kcal)**: Pérdida sostenible sin ralentizar el metabolismo.\n"
                "• **Alta Proteína (1.6g/kg)**: Mantiene la masa muscular y aumenta la termogénesis.\n"
                "• **Fibra Saciente**: Avena, legumbres, semillas de chía y verduras crudas.\n"
                "• **Elimine Ultraprocesados**: Los emulsionantes y azúcares alteran las señales de saciedad."
            )
            sq = ["¿Qué frutas ayudan a bajar de peso?", "Plan de comidas bajo en calorías"]
        elif mode == "fr":
            reply = (
                "⚖️ **Principes Fondamentaux de la Perte de Poids :**\n\n"
                "• **Déficit Calorique Modéré (300-500 kcal)** : Perte de graisse durable sans carence.\n"
                "• **Apport Élevé en Protéines (1,6g/kg)** : Préserve la masse musculaire et stimule le métabolisme.\n"
                "• **Fibres Solubles et Eau** : Légumes, légumineuses et 2 à 3 litres d'eau par jour.\n"
                "• **Zéro Aliments Ultra-Transformés** : Éliminez les boissons sucrées et snacks industriels."
            )
            sq = ["Quels fruits privilégier pour mincir ?", "Programme alimentaire sain pour maigrir"]
        elif mode == "hinglish":
            reply = (
                "⚖️ **Healthy Weight Loss Ke 5 Golden Rules:**\n\n"
                "1. **Calorie Deficit + Protein**: 300-400 calories kam khayein aur har meal me dal/paneer/eggs lein.\n"
                "2. **Liquid Calories Band Karein**: Cold drinks aur meethi chai band karein.\n"
                "3. **50% Salad Rule**: Plate ka aadha hissa raw salad se bharein.\n"
                "4. **Clean Snacks**: Chips ki jagah makhana aur roasted chana khayein.\n"
                "5. **Pani & Neend**: 3L pani aur 7-8 ghante neend zaroor lein."
            )
            sq = ["1500 calorie diet plan suggest karo", "Weight loss ke best fruits"]
        else:
            reply = (
                "⚖️ **Evidence-Based Fat Loss Principles:**\n\n"
                "• **Moderate Caloric Deficit (300-500 kcal)**: Sustainable fat loss without metabolic adaptation.\n"
                "• **High Protein Intake (1.6g/kg)**: Maximizes thermogenesis and preserves lean muscle mass.\n"
                "• **Soluble Fiber Density**: Prioritize oats, legumes, chia seeds, and raw greens for satiety.\n"
                "• **Eliminate Ultra-Processed Foods**: Emulsifiers and maltodextrin disrupt leptin signaling."
            )
            sq = ["What is a clean 1500 calorie diet plan?", "Which fruits are best for weight loss?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Metabolic Optimization"
        }

    # -------------------------------------------------------------
    # 7. DIABETES & BLOOD SUGAR INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["diabet", "sugar", "insulin", "meetha", "glycemic", "glucose"]):
        if mode == "hi":
            reply = (
                "🩸 **डायबिटीज (रक्त शर्करा) नियंत्रण के लिए नैदानिक आहार मार्गदर्शन:**\n\n"
                "• **छिपे हुए शुगर्स से सावधान**: *माल्टोडेक्सट्रिन* (Maltodextrin, GI = 110!), कॉर्न सिरप और डेक्सट्रोज से बचें। ये सफेद चीनी से भी तेजी से ब्लड शुगर बढ़ाते हैं!\n"
                "• **फाइबर पेयरिंग नियम**: जब भी कार्बोहाइड्रेट (रोटी, चावल) खाएं, उससे पहले हरी सलाद या दाल/प्रोटीन खाएं। फाइबर ग्लूकोज के अवशोषण को धीमा कर देता है।\n"
                "• **उत्तम प्राकृतिक विकल्प**: स्टीविया (Stevia) पत्ती का अर्क बिना इंसुलिन बढ़ाए सुरक्षित मिठास देता है।\n"
                "• **लाभकारी खाद्य पदार्थ**: करेला, मेथी दाना, जौ/दलिया, जामुन और अमरूद इंसुलिन संवेदनशीलता को बढ़ाते हैं।"
            )
            sq = ["क्या माल्टोडेक्सट्रिन साधारण चीनी से अधिक हानिकारक है?", "डायबिटीज में कौन से फल सुरक्षित हैं?", "फास्टिंग ब्लड शुगर कैसे कम करें?"]
        elif mode == "es":
            reply = (
                "🩸 **Guía Clínica para el Control Glucémico:**\n\n"
                "• **Cuidado con Almidones Ocultos**: La *Maltodextrina* (IG ~110) eleva la insulina más rápido que el azúcar común.\n"
                "• **Regla de la Fibra**: Combine siempre carbohidratos con fibra y proteínas para aplanar la glucosa posprandial.\n"
                "• **Edulcorantes Limpios**: La Stevia pura y el fruto del monje ofrecen carga glucémica nula."
            )
            sq = ["¿Qué frutas tienen menor índice glucémico?", "¿Cómo regular el azúcar en ayunas?"]
        elif mode == "fr":
            reply = (
                "🩸 **Contrôle Glycémique et Diabète :**\n\n"
                "• **Attention aux Sucres Cachés** : La *Maltodextrine* (IG ~110) provoque un pic d'insuline supérieur au sucre blanc.\n"
                "• **Association avec les Fibres** : Consommez toujours vos glucides avec des fibres et des protéines.\n"
                "• **Édulcorants Sains** : La Stévia pure et le fruit du moine sont recommandés."
            )
            sq = ["Quels fruits ont l'indice glycémique le plus bas ?", "Comment faire baisser la glycémie matinale ?"]
        elif mode == "hinglish":
            reply = (
                "🩸 **Diabetes & Blood Sugar Control Guidance:**\n\n"
                "• **Maltodextrin Se Bachein**: Iska GI 110 hota hai jo sugar se bhi tez spike karta hai.\n"
                "• **Fiber Pairing**: Carbs khane se pehle salad ya dal lein.\n"
                "• **Best Sweeteners**: Stevia leaf extract use karein.\n"
                "• **Superfoods**: Karela, methi daana, daliya aur amrood sugar control karte hain."
            )
            sq = ["Maltodextrin kyu dangerous hai?", "Diabetic patients ke low GI fruits"]
        else:
            reply = (
                "🩸 **Clinical Glycemic Guidance for Blood Sugar Control:**\n\n"
                "• **Beware Hidden Starches**: Industrial stabilizers like *Maltodextrin* (GI ~110) spike insulin faster than pure sucrose.\n"
                "• **Carbohydrate Buffering**: Always pair carbohydrates with dietary fiber and healthy fats to flatten postprandial glucose curves.\n"
                "• **Clean Sugar Substitutes**: High-purity Stevia rebaudiana and Monk Fruit offer negligible glycemic loads."
            )
            sq = ["Is maltodextrin worse than standard sugar?", "Which fruits have the lowest glycemic index?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Glycemic Health"
        }

    # -------------------------------------------------------------
    # 8. HIGH BLOOD PRESSURE & HYPERTENSION
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["bp", "blood pressure", "hypertension", "namak", "sodium", "presion arterial", "tension"]):
        if mode == "hi":
            reply = (
                "💓 **उच्च रक्तचाप (High BP) नियंत्रण के लिए आहार मार्गदर्शन:**\n\n"
                "• **सोडियम की दैनिक सीमा (<1500mg/दिन)**: रोजाना १ छोटी चम्मच (५ ग्राम) से कम नमक लें। अचार, पापड़, डिब्बाबंद सूप और चिप्स में अत्यधिक छुपा हुआ सोडियम होता है।\n"
                "• **पोटेशियम युक्त आहार**: पोटेशियम सोडियम के दुष्प्रभाव को कम करता है। केला, पालक, नारियल पानी और ताजा दही इसके बेहतरीन प्राकृतिक स्रोत हैं।\n"
                "• **सेंधा नमक (Rock Salt)**: सादे टेबल नमक की तुलना में सेंधा नमक में मिनरल्स होते हैं, परंतु मात्रा दोनों में ही सीमित रखनी चाहिए।\n"
                "• **कच्चा लहसुन**: सुबह १-२ कली कच्चा लहसुन रक्त वाहिकाओं को शिथिल करने और बीपी कम करने में अत्यंत प्रभावी है।"
            )
            sq = ["सोडियम ब्लड प्रेशर को कैसे बढ़ाता है?", "हाई बीपी के लिए शीर्ष ५ पोटेशियम युक्त खाद्य पदार्थ", "क्या सेंधा नमक हाई बीपी में सुरक्षित है?"]
        elif mode == "es":
            reply = (
                "💓 **Control Nutricional de la Presión Arterial:**\n\n"
                "• **Límite de Sodio (<1500mg/día)**: Reduzca el consumo de embutidos, panes industriales, salsas y enlatados.\n"
                "• **Balance Potasio-Sodio**: Aumente el potasio con espinacas, plátanos, aguacate y agua de coco.\n"
                "• **Protocolo DASH**: Incorpore semillas ricas en magnesio (calabaza, chía) para favorecer la relajación vascular."
            )
            sq = ["¿Cómo afecta la sal a la presión arterial?", "Alimentos ricos en potasio para bajar el BP"]
        elif mode == "fr":
            reply = (
                "💓 **Gestion Diététique de la Tension Artérielle :**\n\n"
                "• **Plafond de Sodium (<1500mg/jour)** : Éliminez les plats préparés, charcuteries et chips.\n"
                "• **Équilibre Potassium-Sodium** : Privilégiez les épinards, bananes, avocats et l'eau de coco.\n"
                "• **Régime DASH** : Consommez des graines de courge et du magnésium pour assouplir les artères."
            )
            sq = ["Quels aliments riches en potassium pour l'hypertension ?", "Le sel rose est-il meilleur ?"]
        elif mode == "hinglish":
            reply = (
                "💓 **High BP (Hypertension) Me Namak Aur Diet Tips:**\n\n"
                "• **Sodium Limit (<1500mg/day)**: 1 chammach se kam namak lein. Achaar aur papad se bachein.\n"
                "• **Potassium Badhayein**: Kela, palak, nariyal paani sodium ke asar ko neutralize karte hain.\n"
                "• **Lehsun**: Subah 1-2 kali lehsun blood vessels ko relax karti hai."
            )
            sq = ["Sodium BP kaise badhata hai?", "High BP ke best potassium foods"]
        else:
            reply = (
                "💓 **Clinical Sodium & Arterial Pressure Protocol:**\n\n"
                "• **Sodium Ceiling (<1500mg/day)**: Eliminate hidden sodium in bread, cured meats, pickles, and MSG.\n"
                "• **Potassium-Sodium Balance**: Elevate dietary potassium via leafy greens, bananas, avocados, and coconut water.\n"
                "• **DASH Framework**: Emphasize magnesium-rich seeds (pumpkin, chia) to support vascular relaxation."
            )
            sq = ["How does sodium raise blood pressure?", "What are the top 5 potassium-rich foods for BP?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Cardiovascular Advice"
        }

    # -------------------------------------------------------------
    # 9. DIGESTION / PET / ACIDITY / GAS / CONSTIPATION
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["pet", "digest", "gas", "acidity", "kabz", "constipation", "bloating", "pachan", "chhati me jalan", "digestión", "digestion"]):
        if mode == "hi":
            reply = (
                "🌿 **पेट की समस्या (गैस, एसिडिटी, कब्ज) का संपूर्ण समाधान:**\n\n"
                "• **प्रोबायोटिक्स (ताजा दही / छाछ)**: भोजन के साथ ताजा दही या भुना जीरा युक्त छाछ पिएं। यह आंतों के बैक्टीरिया को संतुलित कर गैस को तुरंत रोकती है।\n"
                "• **कब्ज से राहत**: पका हुआ पपीता, रात में भीगे हुए अंजीर और रोजाना २५-३० ग्राम फाइबर लें। रात को गुनगुना पानी पीना लाभदायक है।\n"
                "• **एसिडिटी से बचाव**: खाली पेट चाय या कॉफी न पिएं। भोजन करने के तुरंत बाद न सोएं—कम से कम २ घंटे का अंतर रखें।\n"
                "• **सौंफ और अजवाइन**: भोजन के बाद थोड़ी सौंफ और अजवाइन चबाने से पाचक रस सक्रिय होते हैं।"
            )
            sq = ["पुरानी एसिडिटी को कैसे ठीक करें?", "कब्ज के लिए प्राकृतिक घरेलू उपाय", "इमल्सीफायर्स पेट को कैसे नुकसान पहुंचाते हैं?"]
        elif mode == "es":
            reply = (
                "🌿 **Salud Digestiva y Microbiota:**\n\n"
                "• **Probióticos Naturales**: Yogur sin azúcar y alimentos fermentados reparan la barrera digestiva.\n"
                "• **Fibra Prebiótica**: Papaya madura, higos secos y salvado de avena para el tránsito regular.\n"
                "• **Prevenir Reflujo**: Deje al menos 2 horas entre la cena y el sueño; evite café en ayunas."
            )
            sq = ["¿Cómo curar la acidez crónica?", "Remedios naturales para el estreñimiento"]
        elif mode == "fr":
            reply = (
                "🌿 **Santé Digestive et Microbiote Intestinal :**\n\n"
                "• **Probiotiques Actifs** : Yaourt fermenté et kéfir renforcent la muqueuse intestinale.\n"
                "• **Fibres Prébiotiques** : Papaye mûre, figues réhydratées et psyllium pour réguler le transit.\n"
                "• **Prévention des Brûlures d'Estomac** : Attendez au moins 2 heures après le dîner avant de vous coucher."
            )
            sq = ["Comment soigner l'acidité gastrique ?", "Remèdes naturels contre la constipation"]
        elif mode == "hinglish":
            reply = (
                "🌿 **Pet Ki Samasya (Gas, Acidity, Kabz) Ka Samadhan:**\n\n"
                "• **Probiotics (Dahi / Chaas)**: Khane ke saath bhuna jeera dahi pijiye, gas turant rukti hai.\n"
                "• **Kabz**: Paka papita aur bheega anjeer lijiye, raat ko gunguna paani pijiye.\n"
                "• **Acidity**: Khali pet chai na pijiye aur khana khane ke 2 ghante baad soyein.\n"
                "• **Saunf & Ajwain**: Khane ke baad chabane se pachan ras active hote hain."
            )
            sq = ["Chronic acidity kaise thik karein?", "Kabz ke gharelu nuskhe"]
        else:
            reply = (
                "🌿 **Gastrointestinal & Gut Microbiome Protocol:**\n\n"
                "• **Active Probiotic Reinforcement**: Unpasteurized yogurt and fermented buttermilk restore mucosal barriers.\n"
                "• **Prebiotic Fiber for Motility**: Ripe papaya, soaked figs, and psyllium husk.\n"
                "• **Preventing GERD & Acid Reflux**: Maintain a minimum 2.5-hour gap between meal and sleep; avoid empty-stomach caffeine."
            )
            sq = ["How to permanently cure chronic acidity?", "What are natural home remedies for constipation?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Digestive Health"
        }

    # -------------------------------------------------------------
    # 10. CHAI / TEA / COFFEE INQUIRY
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["chai", "tea", "coffee", "green tea", "café", "cafe"]):
        if mode == "hi":
            reply = (
                "☕ **चाय और कॉफी से जुड़े पोषण तथ्य:**\n\n"
                "• **खाली पेट चाय से बचें**: सुबह खाली पेट चाय पीने से गैस्ट्रिक एसिड बढ़ता है और भोजन से आयरन का अवशोषण ६०% तक बाधित हो जाता है।\n"
                "• **चीनी का प्रभाव**: १ कप चाय में २ चम्मच चीनी = लगभग ४०-५० अनावश्यक कैलोरी। चीनी की मात्रा घटाएं या फीकी चाय की आदत डालें।\n"
                "• **ग्रीन टी (Green Tea)**: इसमें शक्तिशाली EGCG एंटीऑक्सीडेंट्स होते हैं जो मेटाबॉलिज्म बढ़ाते हैं। इसे भोजन के १ घंटे बाद पीना सर्वोत्तम है।"
            )
            sq = ["क्या चाय पीने से आयरन की कमी होती है?", "दिन में कितने कप चाय पीना सुरक्षित है?"]
        elif mode == "es":
            reply = (
                "☕ **Cafeína, Polifenoles y Fisiología Digestiva:**\n\n"
                "• **Evite Té o Café en Ayunas**: Los taninos irritan la mucosa e inhiben la absorción de hierro.\n"
                "• **Azúcar Añadido**: El café dulce añade calorías líquidas de alto impacto glucémico.\n"
                "• **Té Verde**: Rico en antioxidantes EGCG; ideal consumirlo 1 hora después de comer."
            )
            sq = ["¿El té inhibe la absorción de hierro?", "¿Cuántas tazas de café al día son saludables?"]
        elif mode == "fr":
            reply = (
                "☕ **Caféine, Polyphénols et Digestion :**\n\n"
                "• **Évitez le Café ou Thé à Jeun** : Les tanins irritent l'estomac et bloquent l'assimilation du fer.\n"
                "• **Sucre Caché** : Le thé au lait sucré apporte des calories liquides inutiles.\n"
                "• **Thé Vert** : Riche en antioxydants EGCG ; à boire 1 heure après le repas."
            )
            sq = ["Le thé bloque-t-il le fer ?", "Combien de tasses de café par jour ?"]
        elif mode == "hinglish":
            reply = (
                "☕ **Chai & Coffee Ke Nutrition Facts:**\n\n"
                "• **Khali Pet Chai Se Bachein**: Gastric acid badhta hai aur iron absorption 60% tak rukta hai.\n"
                "• **Sugar Ka Khel**: 1 cup chai me 2 chammach cheeni = 40-50 khali calories.\n"
                "• **Green Tea**: EGCG antioxidants hote hain jo metabolism boost karte hain."
            )
            sq = ["Chai se iron kam hota hai kya?", "Din me kitni chai peena theek hai?"]
        else:
            reply = (
                "☕ **Caffeine, Polyphenols & Digestive Physiology:**\n\n"
                "• **Avoid Fasted Chai/Coffee**: Tannins can irritate stomach lining and inhibit iron absorption by up to 60%.\n"
                "• **Added Sugar Warning**: Standard milk tea with 2 tsp sugar adds unnecessary high-glycemic liquid calories.\n"
                "• **Green Tea**: High in epigallocatechin gallate (EGCG); ideal consumed 1 hour post-meal."
            )
            sq = ["Does tea inhibit iron absorption?", "How many cups of chai is healthy per day?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Beverage Health"
        }

    # -------------------------------------------------------------
    # 11. COOKING OILS & GHEE
    # -------------------------------------------------------------
    if any(k in q_lower for k in ["tel", "oil", "ghee", "mustard oil", "refined oil", "butter", "aceite", "huile"]):
        if mode == "hi":
            reply = (
                "🫒 **कुकिंग ऑयल बनाम देशी घी — कौन सा सबसे अच्छा है?**\n\n"
                "• **रिफाइंड तेल से बचें**: सोयाबीन, सूरजमुखी और पाम रिफाइंड तेल रासायनिक विलायकों और अत्यधिक तापमान पर बनते हैं, जिससे इनमें सूजन बढ़ाने वाले ओमेगा-६ फैटी एसिड अधिक होते हैं।\n"
                "• **शुद्ध देशी गाय का घी (A2 Ghee)**: घी में *ब्यूटायरेट (Butyric Acid)* होता है जो आंतों की सेहत और रोग प्रतिरोधक क्षमता के लिए सर्वोत्तम है। इसका स्मोक पॉइंट अधिक होने से यह भारतीय पकाने के लिए सुरक्षित है।\n"
                "• **कच्ची घानी (Cold-Pressed) तेल**: सरसों का तेल, नारियल तेल या एक्स्ट्रा वर्जिन ऑलिव ऑयल बिना रसायनों के बनते हैं और हृदय के लिए सबसे लाभकारी हैं।"
            )
            sq = ["क्या हाई कोलेस्ट्रॉल में देशी घी सुरक्षित है?", "भारतीय पकाने के लिए कौन सा तेल सबसे अच्छा है?"]
        elif mode == "es":
            reply = (
                "🫒 **Ghee vs Aceites Vegetales Refinados:**\n\n"
                "• **Evite Aceites Refinados**: Los aceites de soja o palma pasan por altas temperaturas y solventes.\n"
                "• **Ghee Tradicional**: Rico en butirato y vitaminas liposolubles con un punto de humo alto.\n"
                "• **Aceites Prensados en Frío**: Aceite de oliva virgen extra y de sésamo conservan sus antioxidantes."
            )
            sq = ["¿Es seguro el ghee con colesterol alto?", "¿Cuál es el mejor aceite para cocinar?"]
        elif mode == "fr":
            reply = (
                "🫒 **Ghee vs Huiles Végétales Raffinées :**\n\n"
                "• **Évitez les Huiles Raffinées** : Les huiles de tournesol ou de palme raffinées contiennent trop d'oméga-6 oxydés.\n"
                "• **Ghee Traditionnel (Beurre Clarifié)** : Riche en butyrate, très stable à haute température.\n"
                "• **Huiles Pressées à Froid** : L'huile d'olive extra vierge et l'huile de colza sont optimales."
            )
            sq = ["Le ghee est-il bon pour le cholestérol ?", "Quelle est la meilleure huile de cuisson ?"]
        elif mode == "hinglish":
            reply = (
                "🫒 **Cooking Oil vs Desi Ghee — Konsa Behtar Hai?**\n\n"
                "• **Refined Oils Se Bachein**: Heat extraction se bante hain aur inflammatory hote hain.\n"
                "• **Desi Cow Ghee (A2)**: Butyric acid gut health ke liye best hai, high smoke point hai.\n"
                "• **Kacchi Ghani Oils**: Sarson ka tel ya Cold-pressed coconut oil heart ke liye behtar hain."
            )
            sq = ["High cholesterol me ghee kha sakte hain?", "Indian cooking ke liye best oil"]
        else:
            reply = (
                "🫒 **Lipid Science: Ghee vs Industrial Seed Oils:**\n\n"
                "• **Minimize Refined Seed Oils**: Solvent-extracted refined oils undergo intense bleaching and produce oxidized aldehydes.\n"
                "• **Traditional Grass-Fed Ghee**: Rich in butyrate and fat-soluble vitamins (A, D, E, K2) with a very high smoke point (485°F).\n"
                "• **Cold-Pressed / Expeller Oils**: Cold-pressed mustard, sesame, and extra virgin olive oils preserve natural tocopherols."
            )
            sq = ["Is Desi Ghee safe for high cholesterol?", "Which cooking oil is best for Indian cooking?"]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Healthy Fats Guide"
        }

    # -------------------------------------------------------------
    # 12. GENERAL GREETINGS (handles typos like 'hrllo', 'hlo', 'hlw')
    # -------------------------------------------------------------
    greeting_patterns = [
        "hi", "hello", "hrllo", "hllo", "hlo", "helo", "hlw", "hey",
        "namaste", "namaskar", "pranam", "hola", "bonjour", "salut", "kaise ho", "kaisa hai"
    ]
    if any(g in q_lower for g in greeting_patterns):
        if mode == "hi":
            reply = (
                "नमस्ते! 🙏 मैं आपका **NutriLens AI पोषण विशेषज्ञ (Nutritionist)** हूँ।\n\n"
                "आप मुझसे किसी भी खाद्य पदार्थ (जैसे सेब, केला, दूध, ओट्स), स्वास्थ्य समस्याओं (डायबिटीज, हाई बीपी, वजन नियंत्रण, पाचन), "
                "सुबह के नाश्ते, या पैकेज्ड फूड प्रिजर्वेटिव्स (E-codes) के बारे में अपनी भाषा में पूछ सकते हैं!"
            )
            sq = [
                "सुबह का स्वस्थ नाश्ता बताएं",
                "क्या डायबिटीज में सेब खा सकते हैं?",
                "अल्ट्रा-प्रोसेस्ड फूड्स (NOVA 4) क्या हैं?",
                "हाई बीपी के लिए सबसे अच्छे आहार"
            ]
        elif mode == "es":
            reply = (
                "¡Hola! 👋 Soy tu **Nutricionista IA de NutriLens**.\n\n"
                "¡Pregúntame sobre cualquier alimento (manzanas, avena, plátanos), problemas de salud (diabetes, hipertensión, pérdida de peso, digestión), "
                "desayunos saludables o aditivos de alimentos procesados (códigos E)!"
            )
            sq = [
                "¿Qué desayunar para bajar de peso?",
                "¿Qué son los alimentos ultraprocesados (NOVA 4)?",
                "Mejores alimentos para la diabetes y la presión arterial"
            ]
        elif mode == "fr":
            reply = (
                "Bonjour ! 👋 Je suis votre **Nutritionniste IA NutriLens**.\n\n"
                "Posez-moi vos questions sur n'importe quel aliment (pommes, avoine, bananes), problèmes de santé (diabète, hypertension, perte de poids, digestion), "
                "petits-déjeuners équilibrés ou additifs alimentaires (codes E) !"
            )
            sq = [
                "Idées de petit-déjeuner sain et rapide",
                "Qu'est-ce qu'un aliment ultra-transformé (NOVA 4) ?",
                "Meilleurs aliments contre le diabète et l'hypertension"
            ]
        elif mode == "hinglish":
            reply = (
                "Namaste! 🙏 Main aapka **NutriLens AI Nutritionist** hoon.\n\n"
                "Aap mujhse kisi bhi khadya padarth (Seb, Kela, Doodh, Oats), bimari ke parhez (Diabetes, BP, Weight Loss, Digestion), "
                "subah ke nashte, ya packaged food E-code preservative ke baare me pooch sakte hain!"
            )
            sq = [
                "morning food suggest kro",
                "agr koi seb kha rha hai to",
                "What is E621 (MSG) and is it safe?",
                "Best foods for diabetes and high BP"
            ]
        else:
            reply = (
                "Hello! 👋 I am your **NutriLens AI Nutrition Intelligence Assistant**.\n\n"
                "Ask me about any whole food (Apples, Oats, Bananas), condition-specific guidance (Diabetes, High BP, Weight Loss, Gut Health), "
                "healthy breakfast ideas, or packaged food additive E-codes!"
            )
            sq = [
                "Suggest a healthy morning breakfast",
                "Can diabetics eat apples every day?",
                "What is E621 (MSG) and is it safe?",
                "Best foods for diabetes and high BP"
            ]

        return {
            "reply": reply,
            "suggested_questions": sq,
            "detected_additives": [],
            "safety_verdict": "Informational"
        }

    # -------------------------------------------------------------
    # 13. CONTEXTUAL INTELLIGENT FALLBACK
    # -------------------------------------------------------------
    if mode == "hi":
        reply = (
            f"💡 **'{q_clean}' के लिए NutriLens पोषण विशेषज्ञ मार्गदर्शन:**\n\n"
            f"१. **प्राकृतिक और संपूर्ण आहार (Whole Foods First)**: किसी भी भोजन में प्रोसेस्ड फूड्स के मुकाबले ताज़ी हरी सब्ज़ियाँ, दालें, फल और साबुत अनाज को प्राथमिकता दें।\n"
            f"२. **रासायनिक एडिटिव्स से सावधान (Chemical Additives)**: पैकेज्ड सामान पर ५ से अधिक तत्व या कृत्रिम E-codes (स्टेबलाइजर्स, प्रिजर्वेटिव्स, रंग) होने पर वह अल्ट्रा-प्रोसेस्ड (NOVA 4) बन जाता है।\n"
            f"३. **मेटाबॉलिक संतुलन (Metabolic Balance)**: अपने भोजन में हमेशा प्रोटीन और फाइबर का संतुलन रखें ताकि ब्लड शुगर और ऊर्जा का स्तर स्थिर रहे।\n\n"
            f"आप स्मार्ट स्कैनर (Smart Scanner) टैब से किसी भी फूड पैकेट का लेबल स्कैन करके उसका विस्तृत न्यूट्रिशनल ऑडिट देख सकते हैं!"
        )
        sq = [
            "सुबह का स्वस्थ नाश्ता बताएं",
            "अल्ट्रा-प्रोसेस्ड फूड्स (NOVA 4) क्या हैं?",
            "पैकेट के लेबल पर हानिकारक सामग्री कैसे पहचानें?"
        ]
    elif mode == "es":
        reply = (
            f"💡 **Guía Nutricional de NutriLens para '{q_clean}':**\n\n"
            f"1. **Priorice Alimentos Integrales**: Base su dieta en alimentos frescos, legumbres, frutas y verduras en lugar de ultraprocesados.\n"
            f"2. **Cuidado con los Aditivos Químicos**: Si un producto contiene más de 5 ingredientes o conservantes artificiales (códigos E), es ultraprocesado (NOVA 4).\n"
            f"3. **Control Metabólico**: Combine carbohidratos con proteínas y fibra para regular la glucosa y la energía.\n\n"
            f"¡Puede escanear cualquier producto desde la pestaña Escáner para ver su auditoría nutricional completa!"
        )
        sq = [
            "¿Qué desayunar para bajar de peso?",
            "¿Qué son los alimentos ultraprocesados (NOVA 4)?",
            "Cómo leer la lista de ingredientes de un producto"
        ]
    elif mode == "fr":
        reply = (
            f"💡 **Conseils Nutritionnels NutriLens pour '{q_clean}' :**\n\n"
            f"1. **Priorité aux Aliments Bruts** : Privilégiez les légumes frais, légumineuses, fruits et céréales complètes par rapport aux produits ultra-transformés.\n"
            f"2. **Attention aux Additifs Chimiques** : Un emballage contenant plus de 5 ingrédients ou des conservateurs artificiels (codes E) relève des ultra-transformés (NOVA 4).\n"
            f"3. **Équilibre Métabolique** : Associez toujours les glucides à des protéines et des fibres pour stabiliser la glycémie.\n\n"
            f"Scannez n'importe quel emballage alimentaire depuis l'onglet Scanner pour obtenir son audit nutritionnel détaillé !"
        )
        sq = [
            "Idées de petit-déjeuner sain et équilibré",
            "Qu'est-ce qu'un aliment ultra-transformé (NOVA 4) ?",
            "Comment décrypter les étiquettes alimentaires ?"
        ]
    elif mode == "hinglish":
        reply = (
            f"💡 **NutriLens Clinical Guidance for '{q_clean}':**\n\n"
            f"1. **Prakritik & Whole Foods First**: Processed foods ke mukable taaza sabziyan, daal, fruits aur whole grains ko tarjeeh dein.\n"
            f"2. **Chemical Additives Se Savdhan**: Packaged items par 5 se zyada ingredients ya E-codes hone par wo ultra-processed (NOVA 4) ban jata hai.\n"
            f"3. **Metabolic Balance**: Apne khane me protein aur fiber ka balance rakhein taaki blood sugar stable rahe.\n\n"
            f"Aap Smart Scanner tab se kisi bhi packet ka label scan karke uski exact nutritional audit dekh sakte hain!"
        )
        sq = [
            "morning food suggest kro",
            "What are ultra-processed foods (NOVA 4)?",
            "How to check clean ingredients on a food label?"
        ]
    else:
        reply = (
            f"💡 **NutriLens Clinical Nutritionist Guidance on '{q_clean}':**\n\n"
            f"• **Prioritize Whole-Food Density**: Base your diet on minimally processed, single-ingredient whole foods rich in micronutrients and bioavailable fiber.\n"
            f"• **Label Transparency Rule**: When selecting packaged foods, avoid items containing industrial emulsifiers, artificial sweeteners, or synthetic colorings.\n"
            f"• **Satiety & Metabolic Control**: Pair carbohydrates with lean protein and healthy fats to stabilize insulin response and avoid energy crashes.\n\n"
            f"You can scan any packaged food product from the Smart Scanner tab to perform an instant toxicological and nutritional audit!"
        )
        sq = [
            "Suggest a healthy morning breakfast",
            "What are ultra-processed foods (NOVA 4)?",
            "How to check clean ingredients on a food label?"
        ]

    return {
        "reply": reply,
        "suggested_questions": sq,
        "detected_additives": [],
        "safety_verdict": "General Nutrition"
    }
