-- ==============================================================================
-- NutriLens Supabase Database Schema & Row Level Security (RLS) Migration
-- ==============================================================================
-- This migration ensures persistent user-isolated storage for:
-- 1. scan_history (Stores only real food scans for the authenticated user)
-- 2. user_profiles (Stores user age, dietary preferences, allergies, conditions)
-- ==============================================================================

-- 1. Ensure 'user_profiles' Table has all required columns including 'age'
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    age INTEGER CHECK (age >= 1 AND age <= 120),
    health_conditions JSONB DEFAULT '[]'::jsonb,
    dietary_preferences JSONB DEFAULT '[]'::jsonb,
    allergies JSONB DEFAULT '[]'::jsonb,
    health_goals JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure age and new columns exist if table was previously created
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age >= 1 AND age <= 120);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS health_conditions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dietary_preferences JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS allergies JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS health_goals JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 2. Ensure 'scan_history' Table exists with clean food scan structure
CREATE TABLE IF NOT EXISTS public.scan_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    scanned_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    allergen_flags JSONB DEFAULT '[]'::jsonb,
    verdict_summary TEXT,
    ocr_text TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for high-performance recent scans retrieval ordered by newest first
CREATE INDEX IF NOT EXISTS idx_scan_history_user_scanned_at 
ON public.scan_history (user_id, scanned_at DESC);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable Row Level Security on both tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Policies for 'user_profiles'
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
CREATE POLICY "Users can delete own profile"
ON public.user_profiles
FOR DELETE
USING (auth.uid()::text = user_id::text);

-- ------------------------------------------------------------------------------
-- Policies for 'scan_history'
-- Enforces: auth.uid() = scan_history.user_id
-- Users can only insert, read, update, or delete their own scans.
-- Cross-user access is impossible at the PostgreSQL engine level.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own scans" ON public.scan_history;
CREATE POLICY "Users can view own scans"
ON public.scan_history
FOR SELECT
USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own scans" ON public.scan_history;
CREATE POLICY "Users can insert own scans"
ON public.scan_history
FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own scans" ON public.scan_history;
CREATE POLICY "Users can update own scans"
ON public.scan_history
FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own scans" ON public.scan_history;
CREATE POLICY "Users can delete own scans"
ON public.scan_history
FOR DELETE
USING (auth.uid()::text = user_id::text);
