# NutriLens — AI Nutrition Intelligence & Food Scanner

NutriLens is a personalized nutrition intelligence and food scanning application powered by a hybrid architecture combining verified open datasets, trained machine learning models, clinical condition-based rules, and structured LLM explanations.

---

## 1. System Architecture

NutriLens avoids using a generic LLM as an ungrounded black-box. Instead, it employs a multi-tiered **Hybrid Architecture**:

```text
                    ┌──────────────────┐
                    │   User Account   │
                    └────────┬─────────┘
                             ↓
                    Saved Health Profile
                   (Diabetes, BP, etc.)
                             ↓
┌──────────────┐      ┌───────────────┐
│ Food Scanner  │ ───→ │ Product Input │
└──────────────┘      └───────┬───────┘
                              ↓
                  Nutrition Processing Engine
                              ↓
              Verified Catalog Search & Retrieval
                 (40,643 USDA + OFF Foods)
                              ↓
                  Health/Nutrition Rule Engine
                 (Clinical Thresholds & Macros)
                              ↓
                    Trained ML Models
              (NOVA Level Classifier: 94.10%
               Health Score Regressor: 5.55 MAE)
                              ↓
                 Structured Evidence Generation
                              ↓
                         LLM Layer
                   (Personalized Reasoning)
                              ↓
                       Result Screen
           (Recommendation, Completeness, Nutrients,
           Key Concerns, Alternatives, Disclaimers)
```

---

## 2. Dataset Sources & Attribution

NutriLens relies on a combined dataset collected around **February 2026**:

1. **USDA FoodData Central**
   - **Records**: ~40,000 foods
   - **Scope**: Foundation foods, Food and Nutrient Database for Dietary Studies (FNDDS), and branded products.
   - **License**: Public Domain.
   - **Website**: [https://fdc.nal.usda.gov/](https://fdc.nal.usda.gov/)

2. **Open Food Facts**
   - **Records**: ~5,000 packaged grocery items
   - **Scope**: Packaged food products with ingredients, allergens, Nutri-Score, NOVA processing groups, and Eco-Scores.
   - **License**: Open Database License (ODbL) and Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).
   - **Website**: [https://world.openfoodfacts.org/](https://world.openfoodfacts.org/)

---

## 3. Data Quality & Preprocessing Pipeline

The raw datasets are preprocessed and verified through `backend/ml/data_pipeline.py`:
- **Preservation of Raw Data**: Raw source files in `FINAL FOOD DATASET/Diet Nutrition/` remain untouched.
- **Directory Structure**:
  - `backend/data/raw/`
  - `backend/data/processed/combined_food_dataset.csv` (40,643 unique verified items after deduplication)
  - `backend/data/training/train_dataset.csv` (32,514 samples, 80%)
  - `backend/data/training/test_dataset.csv` (8,129 samples, 20%)
- **Normalized Units**:
  - Calories: `kcal`
  - Protein, Fat, Carbohydrates, Sugar, Fiber, Saturated Fat: `g`
  - Sodium: `mg`
- **Missing Value Handling**:
  - Missing values are **strictly preserved as unavailable** (`null`) rather than replaced with arbitrary numbers.
  - The AI never assumes missing equals zero:
    - $\text{null sugar} \neq 0\text{g sugar}$
    - $\text{null fiber} \neq 0\text{g fiber}$
    - $\text{null sodium} \neq 0\text{mg sodium}$
  - **Data Completeness Indicators**: Calculated for every food:
    - `High`: Core macronutrients + sugar + fiber + sodium are present.
    - `Partial`: 1 or 2 secondary nutrients missing; exact missing fields are explicitly reported to the user.

---

## 4. Machine Learning Models & Evaluation

Models were trained and evaluated on stratified train/test splits (8,129 unseen test foods) in `backend/ml/train.py`:

### A. NOVA Processing Level Classifier
- **Model**: TF-IDF (25,000 n-gram token features) + Multinomial Logistic Regression (L2 regularization, balanced weights).
- **Task**: Predict NOVA Group (1 = Unprocessed, 2 = Culinary, 3 = Processed, 4 = Ultra-Processed).
- **Evaluation Metrics (on 8,129 Test Foods)**:
  - **Accuracy**: **94.10%**
  - **Precision (Weighted)**: **0.9421**
  - **Recall (Weighted)**: **0.9410**
  - **F1 Score (Weighted)**: **0.9413**
- **Confusion Matrix**:
  ```text
  [[2360   75   30    9]
   [  39  553   23    8]
   [  54   52 2626   89]
   [  11    7   83 2110]]
  ```

### B. Health Score / Nutritional Integrity Regressor
- **Model**: TF-IDF + Ridge Regression.
- **Task**: Predict continuous 0–100 health purity score.
- **Evaluation Metrics**:
  - **Mean Absolute Error (MAE)**: **5.55 points** (on 0–100 scale)
  - **Root Mean Squared Error (RMSE)**: **8.05 points**
  - **$R^2$ Score**: **0.5730**

### C. Healthier Alternatives Search Index
- **Algorithm**: K-Nearest Neighbors with Cosine Distance on verified whole / minimally processed foods ($\text{NOVA} \le 2$ and $\text{Health Score} \ge 75$).
- Recommends clean, dietitian-approved food swaps.

---

## 5. Health Condition Mapping & Clinical Engine

NutriLens maps user conditions to specific nutritional factors:
- **Diabetes**: Evaluates simple sugars ($>10\text{g}$ flags high sugar), refined glycemic syrups (corn syrup, maltodextrin, dextrose), total carbs, and fiber ratio.
- **High Blood Pressure / Hypertension**: Evaluates sodium ($>400\text{mg}$ flags high sodium; $<140\text{mg}$ flags low sodium) and saturated fat.
- **High Cholesterol**: Evaluates saturated fat, trans fats, tropical/hydrogenated oils (palm oil, shortening), and soluble dietary fiber.
- **Obesity / Weight Management**: Evaluates caloric density, simple sugars, protein, and fiber for satiety.
- **Kidney Conditions**: Evaluates sodium, potassium, and inorganic phosphate additives (E338–E341).
- **Allergens**: Cross-references user allergies against dataset allergen flags and ingredient panels.

---

## 6. Structured LLM Integration

The LLM receives structured evidence rather than unorganized prompts:
```json
{
  "user_conditions": ["Diabetes", "High Blood Pressure"],
  "product": {
    "name": "Instant Oatmeal",
    "nutrition": {
      "calories": 160,
      "sugar_g": 12,
      "sodium_mg": 200,
      "fiber_g": 3
    }
  },
  "data_quality": {
    "data_completeness": "High",
    "missing_nutrients": [],
    "data_sources": ["Open Food Facts"],
    "last_verified": "February 2026"
  }
}
```

The LLM returns structured JSON matching our strict schema (`recommendation`, `summary`, `keyConcerns`, `positiveFactors`, `explanation`, `alternativeGuidance`), which the frontend renders natively.

---

## 7. Medical & Allergen Disclaimers

> **Medical Disclaimer**: NutriLens provides educational nutrition information and is not a substitute for professional medical advice, diagnosis, or treatment. Individual nutritional needs vary. Consult a qualified healthcare professional before making major dietary changes.

> **Allergen Notice**: Always verify allergen and ingredient information on the physical product packaging, especially if you have a severe food allergy.

---

## 8. Setup & Running Instructions

### Backend Setup
```powershell
cd backend
# Activate virtual environment
.\venv\Scripts\Activate.ps1
# Install requirements
pip install -r requirements.txt
# Run data preprocessing (if not already run)
python ml/data_pipeline.py
# Run model training (if not already run)
python ml/train.py
# Start FastAPI server on port 8000
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup
```powershell
cd frontend
# Start Expo Web dev server on port 8081
npx expo start --web
```
