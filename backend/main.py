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

# Initialize and warm up ML models on startup
@app.on_event("startup")
async def startup_event():
    load_models()

# Configure CORS for React Native / Expo / Web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://.*",
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

@app.get("/")
async def root():
    return {
        "status": "online",
        "app": "NutriLens API",
        "version": "1.0.0",
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

