# NutriLens - System Memory Bank & Context

## 1. Project Identity & Purpose
**NutriLens** is an AI-driven nutrition intelligence mobile app designed to help users instantly scan, decode, and evaluate food ingredient labels. It bridges complex chemical names with actionable, personalized health advice, allergen warnings, NOVA processing categories, and gamified health education.

---

## 2. Key Architectural Decisions

1. **Decoupled Client-Server Model**:
   - **Frontend**: Mobile app built with React Native and Expo (SDK 57+). Uses NativeWind / Tailwind for rapid visual design and Expo Router for file-based navigation.
   - **Backend**: Python FastAPI service providing low-latency REST endpoints and OpenAPI documentation (`/docs`).

2. **Dual-Layer Database Strategy**:
   - Primary target is **Supabase PostgreSQL**.
   - If Supabase environment variables (`SUPABASE_URL`, `SUPABASE_KEY`) are unconfigured or unavailable, the backend gracefully switches to an `InMemoryStore` singleton. This ensures zero friction for local dev setups and demonstration environments.

3. **Multimodal LLM Pipeline (Google Gemini)**:
   - Uses `google-generativeai` with `gemini-1.5-flash` or `gemini-2.0-flash`.
   - Supports raw text OCR parsing or direct image payload parsing.
   - System prompts strictly enforce JSON structure outputs. Response sanitizer strips triple backticks (` ```json `) to guarantee reliable parsing.

---

## 3. Directory & File Blueprint

```
Nutrilens App/
├── backend/
│   ├── database.py              # Supabase & InMemoryStore repository
│   ├── main.py                  # FastAPI app entry point & CORS
│   ├── models/                  # Pydantic data schemas
│   ├── routers/                 # API Endpoint routes
│   │   ├── analyze.py           # Ingredient scan endpoint
│   │   ├── engagement.py        # Streaks, quizzes, XP & badges
│   │   ├── history.py           # Scan archive lookups
│   │   └── user.py              # User profiles & dietary preferences
│   └── services/                # Business & LLM service logic
│       ├── engagement_service.py
│       ├── history_service.py
│       ├── llm_service.py       # Gemini AI prompt engine
│       └── user_service.py
├── frontend/
│   ├── app/                     # Expo Router pages
│   │   ├── _layout.tsx          # Main layout & theme provider
│   │   ├── index.tsx            # Onboarding & profile tag setup
│   │   ├── scanner.tsx          # Label scanner & text input interface
│   │   ├── results.tsx          # Health score & allergen analysis UI
│   │   └── engagement.tsx       # Streaks, quizzes, XP & badges screen
│   ├── package.json
│   └── tailwind.config.js
└── docs/                        # Complete System Documentation
    ├── prd.md                   # Product Requirements Document
    ├── architecture.md          # Technical Architecture & API specs
    ├── design.md                # UI/UX & Design Tokens
    ├── rules.md                 # Engineering Rules & Guidelines
    ├── phases.md                # Roadmap & Phase Milestones
    └── memory.md                # System Context & Memory Bank
```

---

## 4. Known Gotchas & System Workarounds

- **Expo Version**: The project is using Expo SDK 57+. Always follow version-specific routing guidelines from `https://docs.expo.dev/versions/v57.0.0/`.
- **JSON Markdown Cleaning**: Gemini responses can occasionally return formatted code block wrappers. The service in `services/llm_service.py` sanitizes raw strings before calling `json.loads`.
- **In-Memory Store Persistence**: When running without Supabase, stats and scan history reset upon backend server restart.
