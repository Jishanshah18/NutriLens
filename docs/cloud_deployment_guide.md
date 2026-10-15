# NutriLens Cloud Deployment Guide

This guide details how to deploy both the **NutriLens FastAPI Backend** and **NutriLens Expo React Native Web Frontend** to free cloud hosting platforms (Render / Railway for backend, Vercel / Netlify for frontend).

---

## 1. Deploy Backend (FastAPI Python Service)

### Option A: Render (Recommended - Free Tier Available)
1. Push your repository to GitHub / GitLab.
2. Log into [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** -> **Web Service**.
4. Connect your repository and select the root directory as `backend`.
5. Configuration settings:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add Environment Variables:
   - `SUPABASE_URL`: `https://llbithcfnwzgwubfuhfb.supabase.co`
   - `SUPABASE_KEY`: `sb_publishable_N-nO07iLpQAHtpwAj0oVqQ_K7yKQ0O8`
7. Click **Create Web Service**.
8. Note your public backend URL (e.g. `https://nutrilens-backend.onrender.com`).

---

### Option B: Railway / Docker Deployment
1. Log into [Railway.app](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your repository and choose the `backend` subfolder.
4. Railway will automatically detect `Dockerfile` or `Procfile`.
5. Set environment variables in Railway settings.

---

## 2. Deploy Frontend (Expo React Native Web)

### Option A: Vercel (Recommended - Free Hosting)
1. Log into [Vercel Dashboard](https://vercel.com/).
2. Click **Add New Project** -> Import your GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Add Environment Variable:
   - `EXPO_PUBLIC_API_URL`: `https://your-backend-url.onrender.com/api`
5. Click **Deploy**. Vercel will run `npm run build:web` (`expo export -p web`) using `vercel.json` and host your static app on a global CDN.

---

### Option B: Netlify
1. Log into [Netlify Dashboard](https://app.netlify.com/).
2. Click **Add new site** -> **Import an existing project**.
3. Set **Base directory**: `frontend`.
4. Set **Build command**: `npm run build:web`.
5. Set **Publish directory**: `frontend/dist`.
6. Add environment variable `EXPO_PUBLIC_API_URL` pointing to your deployed backend URL.

---

## 3. Local Quick-Start Testing Commands

If you want to run both backend & frontend locally on your machine right now:

```bash
# Terminal 1: Start Backend (FastAPI on Port 8000)
cd backend
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

# Terminal 2: Start Frontend (Expo Web on Port 8081)
cd frontend
npx expo start --web
```
