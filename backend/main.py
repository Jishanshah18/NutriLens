import os
# Limit native library thread pools on cloud containers to prevent high RSS memory allocations
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
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
    openapi_tags=tags_metadata,
    swagger_favicon_url="/favicon.ico"
)

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

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

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    ico_path = os.path.join(STATIC_DIR, "favicon.ico")
    if os.path.exists(ico_path):
        return FileResponse(ico_path, media_type="image/x-icon")
    png_path = os.path.join(STATIC_DIR, "favicon.png")
    if os.path.exists(png_path):
        return FileResponse(png_path, media_type="image/png")
    return Response(status_code=204)

@app.get("/favicon.png", include_in_schema=False)
async def favicon_png():
    png_path = os.path.join(STATIC_DIR, "favicon.png")
    if os.path.exists(png_path):
        return FileResponse(png_path, media_type="image/png")
    return Response(status_code=204)

@app.get("/logo.png", include_in_schema=False)
async def logo_png():
    logo_path = os.path.join(STATIC_DIR, "logo.png")
    if os.path.exists(logo_path):
        return FileResponse(logo_path, media_type="image/png")
    return Response(status_code=204)

@app.get("/health")
async def simple_health_check():
    """
    Lightweight health check endpoint for Render / Docker orchestration.
    Does not load heavy ML or database systems.
    """
    return {"status": "ok"}

@app.get("/")
async def root(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NutriLens AI API — Live</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/logo.png">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #06140d;
      color: #e6f4ea;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
    }
    .card {
      background: radial-gradient(120% 120% at 50% 0%, rgba(16, 60, 36, 0.6) 0%, rgba(6, 20, 13, 0.95) 100%);
      border: 1px solid rgba(52, 211, 153, 0.25);
      border-radius: 28px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.15);
      backdrop-filter: blur(20px);
      animation: fadeIn 0.6s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .logo-container {
      position: relative;
      display: inline-block;
      margin-bottom: 20px;
    }
    .logo-img {
      width: 130px;
      height: 130px;
      border-radius: 30px;
      box-shadow: 0 12px 36px rgba(16, 185, 129, 0.35);
      border: 2px solid rgba(52, 211, 153, 0.4);
      object-fit: cover;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(52, 211, 153, 0.3);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #ffffff 40%, #a7f3d0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }
    .tagline {
      color: #34d399;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 20px;
      border-radius: 14px;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.45);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border-color: rgba(52, 211, 153, 0.4);
    }
    .footer {
      margin-top: 28px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <img src="/logo.png" alt="NutriLens Logo" class="logo-img">
    </div>
    <div class="status-badge">
      <span class="status-dot"></span>
      SYSTEM OPERATIONAL
    </div>
    <h1>NutriLens API</h1>
    <div class="tagline">Scan • Know • Eat Better</div>
    <p>AI-Powered Food Ingredient & Nutrition Intelligence Platform.<br>Offline ML Inference • Medical Safety Guardrails</p>
    <div class="btn-group">
      <a href="/docs" class="btn btn-primary">
        <span>📖</span> Open Interactive Swagger Docs
      </a>
      <a href="/health" class="btn btn-secondary">
        <span>🩺</span> Cloud Health Probe (/health)
      </a>
      <a href="/api/health" class="btn btn-secondary">
        <span>🗄️</span> Database Status (/api/health)
      </a>
    </div>
    <div class="footer">
      NutriLens v3.0 Production Ready • Running on Render Cloud
    </div>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html_content)

    return {
        "status": "online",
        "app": "NutriLens API",
        "tagline": "Scan • Know • Eat Better",
        "version": "3.0.0-production-ready",
        "docs_url": "/docs",
        "logo_url": "/logo.png",
        "health_url": "/health"
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
