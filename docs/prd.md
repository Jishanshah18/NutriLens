# NutriLens - Product Requirements Document (PRD)

## 1. Product Overview & Vision
**NutriLens** is an AI-powered nutrition intelligence and food ingredient label scanner mobile application. It enables health-conscious consumers, individuals with dietary restrictions, diabetics, and allergy sufferers to scan food labels or enter ingredient lists to receive instant, personalized health insights.

By leveraging multimodal AI (Google Gemini LLM & Vision), NutriLens decodes complex chemical ingredient names, flags harmful additives, calculates an easy-to-understand Health Score (0–100), and provides actionable dietary guidance tailored to the user's health profile.

---

## 2. Target Audience & User Personas

| Persona | Description | Key Need |
| :--- | :--- | :--- |
| **Allergy Shield User** | Individuals with severe food allergies (peanuts, gluten, dairy, soy). | Immediate allergen detection and warning highlights. |
| **Diabetic & Chronic Health Care** | People managing diabetes, high blood pressure, or heart conditions. | Sugar content detection, glycemic impact warning, NOVA food processing status. |
| **Health & Fitness Enthusiast** | Users tracking clean eating, whole foods, and micro-nutrients. | Ingredient quality evaluation and NOVA Group classification. |
| **Gamified Health Learner** | Users motivated by streaks, badges, and health trivia. | Engaging daily quizzes, streak maintenance, level progression. |

---

## 3. Core Features & Functional Requirements

### 3.1 AI Food & Label Scanning
- **Input Modes**:
  - **Camera Vision Scan**: Snap a photo of a physical nutrition/ingredient label.
  - **OCR / Manual Text Input**: Paste raw text or list ingredients manually.
- **AI Analysis Engine**:
  - **Health Score**: 0 to 100 score based on nutritional balance, artificial additives, and NOVA rating.
  - **Safety Verdict**: Clear verdict summary (e.g., "Excellent Choice", "Moderate Caution", "Avoid").
  - **Ingredient Classification**: Categorize items into Whole/Natural, Processing Additives, Preservatives, and Artificial Colors/Sweeteners.
  - **NOVA Classification**: Group 1 (Unprocessed) through Group 4 (Ultra-processed).

### 3.2 Personalized Health & Allergen Matching
- User preference configuration (e.g., Diabetic-Friendly, Low Sugar, Lactose Intolerant, Gluten-Free, Peanut Allergy).
- Automated cross-referencing between detected ingredients and user dietary flags.
- Instant alert badges highlighting potential allergen cross-contamination or dietary conflicts.

### 3.3 Scan History & Tracking
- Chronological archive of all past food label scans.
- Searchable scan records with quick access to previous score breakdowns.
- Visual status indicators for quick past product lookups.

### 3.4 Gamified Engagement & Health Literacy
- **Daily Streak Tracking**: Encourages daily scanning habits and app retention.
- **Interactive Quizzes**:
  - **Myth vs. Fact**: Debunk common nutritional misconceptions.
  - **Multiple Choice**: Nova group classifications, ingredient trivia.
- **XP & Leveling System**: Earn experience points (XP) upon completing scans and quizzes.
- **Achievement Badges**: Unlockable rewards (e.g., *Avocado Lover*, *Allergy Defender*, *Streak Master*).

---

## 4. Non-Functional Requirements

### 4.1 Performance & Response Time
- **API Processing Time**: Sub-2-second response time for ingredient analysis via Gemini LLM.
- **Mobile Smoothness**: 60fps UI transitions using React Native and Expo Router.

### 4.2 Security & Data Privacy
- Secure API key isolation (`.env`).
- Minimal PII collection; health profiles stored securely with user permission.
- CORS restricted to authorized frontend application origins in production.

### 4.3 Reliability & Availability
- High availability via FastAPI containerized backend.
- Fallback architecture: If database connectivity (Supabase) fails, the app seamlessly switches to an `InMemoryStore` repository without crashing.

---

## 5. Key Success Metrics (KPIs)
- **Active Scans per User**: Average scans completed per active user per week.
- **7-Day Retention Rate**: Percentage of users maintaining a 7+ day streak.
- **Quiz Completion Rate**: Daily health quiz participation percentage.
- **Scanning Accuracy Rate**: Accuracy score on OCR ingredient extraction and allergen identification.
