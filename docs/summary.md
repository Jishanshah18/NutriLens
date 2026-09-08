# NutriLens - Markdown Documentation Summary

## 📑 File Summaries

### 1. Product Requirements Document
- **Product Vision**: NutriLens is an AI-driven nutrition scanner that allows users to scan food labels or paste ingredient lists to receive instant health insights, allergen alerts, and NOVA food processing ratings.
- **Target Personas**:
  - *Allergy Shield Users*: Need immediate allergen flagging (peanuts, gluten, dairy, etc.).
  - *Diabetic & Chronic Care*: Need sugar content & glycemic impact warnings.
  - *Fitness Enthusiasts*: Look for clean food quality ratings & NOVA processing tiers.
  - *Gamified Learners*: Retained through streaks, quizzes, XP, and badges.
- **Core Requirements**:
  - Dual camera/OCR input scanning powered by Google Gemini.
  - 0–100 Health Score calculation with safety verdict and ingredient breakdowns.
  - Personalized dietary matching against user preferences.
  - Scan history archives.
  - Daily streaks, quizzes (Myth vs. Fact, Multiple Choice), XP leveling system, and achievement badges.
- **KPIs**: Sub-2s API response time, 60fps UI smoothness, 7-day user retention, high scanning accuracy.

---

### 2. — System Architecture & Technical Specifications
- **System Architecture**: Decoupled client-server model using Expo/React Native on the frontend and Python FastAPI on the backend.
- **Technology Stack**:
  - *Frontend*: React Native, Expo SDK 57+, `expo-router`, NativeWind (Tailwind), TypeScript.
  - *Backend*: FastAPI, Uvicorn, Pydantic v2, CORS middleware.
  - *AI Engine*: Google Gemini LLM & Vision (`gemini-1.5-flash` / `gemini-2.0-flash`).
  - *Database*: Supabase PostgreSQL with `InMemoryStore` zero-config dev fallback.
- **Data Models**: Defined Pydantic JSON structures for User Profile, Scan History, and User Stats/Gamification.
- **API Endpoints**:
  - `POST /api/analyze` — Multimodal image base64 & OCR text ingredient evaluation.
  - `GET/POST /api/user/*` — User profiles & streak/XP stats.
  - `GET /api/history/*` — Chronological scan history logs.
  - `GET/POST /api/engagement/*` — Quizzes, streak updates, and badges.

---

### 3.— Design System & UI/UX Guidelines
- **Visual Identity**: Fresh, trustworthy, modern aesthetic built with emerald greens and soft container cards. Key warnings identifiable in under 2 seconds.
- **Color System**:
  - *Primary Brand*: Emerald 500 (`#10B981`), Emerald 700 (`#047857`), Emerald 100 (`#D1FAE5`).
  - *Health Score Tiers*: Green (80–100), Amber (50–79), Red (0–49).
  - *Neutrals*: White (`#FFFFFF`), Gray 50, Gray 100, Gray 900.
- **Typography & Components**: NativeWind utility scales (`text-4xl` display to `text-sm` captions). Dynamic health score circular gauge, rounded allergen pills with icons, floating engagement card widgets.
- **Navigation Flow**: `Onboarding (/)` ➔ `Scanner (/scanner)` ➔ `Results (/results)` ➔ `Engagement (/engagement)`.

---

### 4.— System Memory Bank & Context
- **Purpose**: Central system memory bank detailing architectural rationale, code layout, and known gotchas.
- **Key Decisions**:
  - Decoupled architecture for independent scaling.
  - Dual-layer database strategy (Supabase cloud DB + `InMemoryStore` dev fallback).
  - Gemini LLM prompt JSON formatting with markdown backtick strip utility.
- **Directory Structure**: Complete file blueprint mapping `backend/`, `frontend/`, and `docs/`.
- **Gotchas**: Expo SDK 57+ router requirements, markdown sanitization requirements, in-memory data resetting on server restart.

---

### 5. — Development Phases & Product Roadmap
- **Roadmap Overview**:
  - **Phase 1 (Completed ✅)**: Core MVP — FastAPI, Gemini LLM scanner, Expo Router UI, `InMemoryStore`.
  - **Phase 2 (Active 🚧)**: Database & Auth — Supabase PostgreSQL schema, Supabase Auth (JWT/OAuth), Cloud storage.
  - **Phase 3 (Planned 📅)**: Advanced AI — Barcode scanning (EAN/UPC via Open Food Facts API), AI healthier product recommendations.
  - **Phase 4 (Future 🚀)**: Gamification & Social — Community leaderboards, shareable scan cards, custom dietary groups.

---

### 6.— Engineering Rules & Coding Standards
- **Core Principles**: Explicit architecture inspection, zero-assumption log-based debugging, decoupled components.
- **Backend Rules**: PEP 8 style formatting, strict JSON schema output enforcement from Gemini with backtick sanitization, graceful `InMemoryStore` fallback.
- **Frontend Rules**: Target Expo v57+ standards, use NativeWind styles based on project color tokens, strict TypeScript interfaces.
- **Verification Rules**: Always perform empirical runtime testing before declaring work finished; check real execution logs.

---

### 7.— Agent Directive for Expo v57+
- **Instruction**: Instructs AI coding agents to reference the official versioned Expo documentation at `https://docs.expo.dev/versions/v57.0.0/` when writing or refactoring mobile application code.

---

### 8.— Agent Rule Pointer
- **Instruction**: Contains `@AGENTS.md` reference to ensure assistant tools follow Expo v57+ documentation rules.

---

### 9. — Expo Local Directory Info
- **Instruction**: Explains that `.expo/` is created by `expo start` to store local device configurations (`devices.json`), server settings (`settings.json`), and CLI log files (`dev/logs/`), and should remain ignored in `.gitignore`.
