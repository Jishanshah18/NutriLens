# NutriLens - Design System & UI/UX Guidelines

## 1. Design Philosophy & Vision

The NutriLens visual language is designed to feel **fresh, trustworthy, modern, and engaging**. Nutrition and health data can often feel intimidating or complex; NutriLens transforms raw chemistry labels into clean, visually delightful, and digestible cards.

### Core Pillars
1. **Visual Clarity First**: Important health alerts (allergens, high sugar, nova group) must be identifiable in under 2 seconds.
2. **Vibrant & Restorative Palette**: Natural emerald greens paired with crisp white backgrounds and soft tinted container cards.
3. **Micro-Interactions & Gamification**: Interactive score wheels, animated progress bars, confetti unlock moments, and responsive tab buttons.

---

## 2. Color System & Design Tokens

### 2.1 Primary Brand Colors
- **Brand Green (Primary)**: `#10B981` (Emerald 500) — Represents health, vitality, and safety.
- **Brand Dark Green**: `#047857` (Emerald 700) — High contrast text and primary container headers.
- **Brand Light Green**: `#D1FAE5` (Emerald 100) — Soft pill backgrounds and subtle cards.

### 2.2 Alert & Status Colors
- **High Health Score (80–100)**: `#10B981` (Emerald) — Safe / Excellent.
- **Moderate Score (50–79)**: `#F59E0B` (Amber) — Caution / Processed elements.
- **Low Score (0–49)**: `#EF4444` (Rose / Red) — High warning / Harmful additives or allergen conflict.

### 2.3 Neutral Palette
- **Primary Background**: `#FFFFFF` (Pure White).
- **Secondary Background**: `#F9FAFB` (Gray 50).
- **Card Background**: `#F3F4F6` (Gray 100).
- **Text Main**: `#111827` (Gray 900).
- **Text Secondary**: `#4B5563` (Gray 600).
- **Text Muted**: `#9CA3AF` (Gray 400).

---

## 3. Typography Scale

Tailwind & NativeWind type standards:

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display Header** | `text-4xl` (36px) | Bold (`font-bold`) | `leading-tight` | Screen titles & Brand logo |
| **Title 1** | `text-2xl` (24px) | Bold / Semibold | `leading-snug` | Section titles & Score text |
| **Title 2** | `text-xl` (20px) | Semibold | `leading-normal` | Card headers |
| **Body Large** | `text-lg` (18px) | Medium | `leading-normal` | Button text & Subheaders |
| **Body Regular** | `text-base` (16px) | Regular | `leading-relaxed` | Ingredient descriptions & summaries |
| **Caption / Muted** | `text-sm` (14px) | Regular / Medium | `leading-normal` | Tags, tooltips, timestamps |

---

## 4. Key UI Components & Layout Specs

### 4.1 Health Score Gauge (0–100)
- Circular gauge or large centered pill container.
- Color dynamically adapts based on score bracket:
  - `80+`: Soft green ring with emerald text.
  - `50–79`: Soft yellow ring with amber text.
  - `0–49`: Soft red ring with danger text.

### 4.2 Ingredient Chip & Allergen Badges
- **Pill Style**: Fully rounded borders (`rounded-full`).
- **Allergen Alert Pill**: Red tint (`bg-red-50 border-red-200 text-red-700`) with shield icon 🛡️.
- **Healthy Ingredient Pill**: Green tint (`bg-green-50 border-green-200 text-green-700`) with leaf icon 🍃.

### 4.3 Engagement Cards (Streaks & Quizzes)
- Floating card containers with soft shadow elevation (`shadow-md shadow-gray-200`).
- Streak Flame Widget 🔥 featuring dynamic streak count and daily progress markers.
- Quiz Option Buttons: Interactive cards that highlight green on correct choice and amber/red on wrong choice.

---

## 5. Screen Navigation & Flow

```
[Onboarding & Profile] (/app/index.tsx)
          │
          ▼
   [Scanner Screen] (/app/scanner.tsx)
          │
          ▼
   [Results Dashboard] (/app/results.tsx)
          │
          ▼
 [Engagement & Gamification] (/app/engagement.tsx)
```

1. **Onboarding Screen (`/`)**: Welcomes user, configures dietary tags (Diabetic, Lactose Intolerant, etc.), CTA to scan.
2. **Scanner Screen (`/scanner`)**: Live camera framing or raw text ingredient pasting interface.
3. **Results Screen (`/results`)**: Displays calculated Health Score, verdict summary, ingredient categorization, and allergen warnings.
4. **Engagement Screen (`/engagement`)**: Streaks counter, XP points dashboard, daily quizzes, and achievement badges.
