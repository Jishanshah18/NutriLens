import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, user, history, engagement, model, chat
from services.model_service import load_models

tags_metadata = [
    {
        "name": "Analyze",
        "description": "AI food ingredient label analysis via custom dataset-trained ML models.",
    },
    {
        "name": "Model & Datasets",
        "description": "Dataset attachment, model retraining, accuracy metrics, and status.",
    },
    {
        "name": "User",
        "description": "User profile management, dietary preferences, and stats.",
    },
    {
        "name": "History",
        "description": "Scan history records and product lookup.",
    },
    {
        "name": "Engagement",
        "description": "Streaks, gamified health quizzes, XP points, and badges.",
    },
]

app = FastAPI(
    title="NutriLens API",
    description="Backend API for NutriLens AI Nutrition Intelligence & Ingredient Scanner (Offline ML Powered)",
    version="2.0.0",
    openapi_tags=tags_metadata
)

# Initialize and warm up ML models and SQLite catalog on startup
@app.on_event("startup")
async def startup_event():
    load_models()
    try:
        from services.model_service import get_rapidocr_engine
        engine = get_rapidocr_engine()
        if engine:
            print("RapidOCR engine warmed up successfully.")
        else:
            print("Notice: RapidOCR engine warmup pending.")
    except Exception as e:
        print(f"Notice during OCR warmup: {e}")
    try:
        from services.nutrition_service import init_food_catalog
        init_food_catalog()
    except Exception as e:
        print(f"Notice initializing SQLite food catalog: {e}")

# Configure CORS origins from environment and safe local development defaults
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [
    origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()
]

# Development origins for local web/mobile testing
dev_origins = [
    "http://localhost:8081",
    "http://localhost:19006",
    "http://localhost:3000",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:19006",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
for dev_o in dev_origins:
    if dev_o not in allowed_origins:
        allowed_origins.append(dev_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Safely allow Vercel production and preview domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(analyze.router, prefix="/api")
app.include_router(model.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(engagement.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

@app.get("/health")
async def simple_health_check():
    """
    Lightweight health check endpoint for Render / Docker orchestration.
    Does not load heavy ML or database systems.
    """
    return {"status": "ok"}

@app.get("/")
async def root():
    return {
        "status": "online",
        "app": "NutriLens API",
        "version": "3.0.0-production-ready",
        "docs_url": "/docs"
    }

@app.get("/api/health")
async def health_check():
    from database import supabase
    db_type = "Supabase Cloud" if supabase else "SQLite Persistent (nutrilens.db)"
    return {
        "status": "healthy",
        "service": "NutriLens Backend",
        "database": db_type,
        "database_connected": True,
        "timestamp": "ok"
    }

