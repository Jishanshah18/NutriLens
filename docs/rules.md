# NutriLens - Engineering Rules & Coding Standards

## 1. Core Engineering Principles

1. **Explicit Code Architecture**: Never infer API logic, schemas, or paths. Inspect full source files before modifying or invoking functions.
2. **Zero-Assumption Debugging**: Inspect exact error logs and stack traces before attempting fixes. Never swallow exceptions or mask symptoms with dummy fallbacks.
3. **Decoupled Architecture**: Maintain clear boundaries between routers, services, database interfaces, and UI screens.

---

## 2. Backend Guidelines (FastAPI & Python)

### 2.1 Code Structure & PEP 8
- Adhere strictly to PEP 8 style formatting and type annotations across all function signatures.
- Place all API endpoints inside clean router modules (`routers/`) and business logic inside service modules (`services/`).

### 2.2 LLM & Vision Service Standards
- All LLM outputs must request strict JSON format.
- Always strip markdown backticks (` ```json ` and ` ``` `) from LLM output before passing to `json.loads()`.
- Provide fallback default values if individual fields are missing in the LLM response.

### 2.3 Database Interface & Fallbacks
- Check Supabase client initialization. If credentials are missing or connection fails, seamlessly utilize `InMemoryStore`.
- Never throw unhandled 500 errors to the client due to database connectivity issues.

---

## 3. Frontend Guidelines (React Native, Expo & TypeScript)

### 3.1 Framework & Version Compliance
- Target **Expo v57+** conventions.
- Use `expo-router` for file-based navigation (`app/_layout.tsx`, `app/index.tsx`, etc.).
- Never use deprecated Expo or React Native components.

### 3.2 Styling Standards (NativeWind & Tailwind)
- Use NativeWind utility classes (`className="bg-brand-green p-4 rounded-2xl"`).
- Maintain project color tokens defined in `tailwind.config.js` and `global.css`.
- Ensure responsive spacing across various mobile device screens.

### 3.3 TypeScript & State Management
- Set `strict: true` in `tsconfig.json`.
- Define explicit interfaces for scan results, user profiles, quiz options, and API responses.
- Handle loading, success, and error states explicitly in all UI screens.

---

## 4. Testing & Verification Rules

1. **Runtime Verification**: Never mark a feature or fix complete without running verification (e.g. testing FastAPI endpoints or running Expo build checks).
2. **Lint & Type Checks**: Code edits must build without breaking lint rules or unresolved imports.
3. **Log Integrity**: Always inspect real terminal logs when diagnosing bugs.

---

## 5. Documentation Maintenance
- Update `architecture.md` when API endpoints or data models change.
- Update `design.md` when new color tokens or reusable UI components are added.
- Maintain inline docstrings for complex AI prompt builders and repository methods.
