# NutriLens - Development Phases & Product Roadmap

## 1. Roadmap Overview

The development of NutriLens is structured into four strategic phases, progressing from the initial core MVP scanner to advanced AI barcode lookup and social gamification.

```mermaid
gantt
    title NutriLens Product Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Core MVP
    FastAPI & Expo Setup       :done, p1_1, 2026-07-01, 2026-07-15
    Gemini OCR & Analysis       :done, p1_2, 2026-07-16, 2026-07-31
    In-Memory Store Repository  :done, p1_3, 2026-08-01, 2026-08-10
    section Phase 2: DB & Auth
    Supabase Schema & Client   :active, p2_1, 2026-08-11, 2026-08-25
    User Auth (JWT/Supabase)   :p2_2, 2026-08-26, 2026-09-10
    Cloud Image Storage        :p2_3, 2026-09-11, 2026-09-25
    section Phase 3: Advanced AI
    Barcode Database (OpenFood):p3_1, 2026-09-26, 2026-10-15
    Healthier Swaps Recs       :p3_2, 2026-10-16, 2026-11-01
    section Phase 4: Social
    Leaderboards & Challenges  :p4_1, 2026-11-02, 2026-11-30
```

---

## 2. Detailed Phase Breakdowns

### Phase 1: Foundation & Core Scanner MVP (Status: Completed ✅)
- **Objectives**: Build core client-server architecture, multimodal label scanner, and gamification screens.
- **Deliverables**:
  - [x] FastAPI backend setup with Modular Routers (`/analyze`, `/user`, `/history`, `/engagement`).
  - [x] Google Gemini LLM Service integration for ingredient safety scoring and allergen extraction.
  - [x] React Native Expo frontend with `expo-router` (`/index`, `/scanner`, `/results`, `/engagement`).
  - [x] `InMemoryStore` fallback repository pattern.

---

### Phase 2: Database Integration & Production Hardening (Status: Active 🚧)
- **Objectives**: Transition from development mock store to production cloud database with user authentication.
- **Deliverables**:
  - [ ] Complete Supabase PostgreSQL table setup (`profiles`, `scan_history`, `user_stats`, `badges`, `quizzes`).
  - [ ] Implement Supabase Auth (Email/Password & Social OAuth).
  - [ ] Raw scan photo uploading to Supabase Storage bucket.
  - [ ] Production API CORS restrict strategy & Rate Limiting middleware.

---

### Phase 3: Advanced AI & Product Recommendations (Status: Planned 📅)
- **Objectives**: Enhance product identification speed via barcode scanning and provide healthier alternative product suggestions.
- **Deliverables**:
  - [ ] Real-time Barcode Camera Reader (EAN/UPC format).
  - [ ] Open Food Facts API integration for instant product lookup without LLM latency.
  - [ ] AI-driven "Healthier Alternative Swap" recommendations for low-scoring foods.
  - [ ] Offline scanning queue & synchronization.

---

### Phase 4: Gamification & Social Community (Status: Future 🚀)
- **Objectives**: Drive viral retention and social engagement through challenges, community scores, and shareable health cards.
- **Deliverables**:
  - [ ] Weekly Community Nutrition Challenges & Leaderboards.
  - [ ] Shareable Social Graphic Cards ("My Scan Summary").
  - [ ] Custom Dietary Groups (e.g., Keto, Vegan, Halal, Kosher verification tags).
