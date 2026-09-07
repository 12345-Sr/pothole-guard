-- ==========================================================
-- POTHOLEGUARD POSTGRESQL / SUPABASE DATABASE SCHEMA
-- Includes Spatial Indexing, Row Level Security (RLS) & Realtime
-- ==========================================================

-- Enable PostGIS for geospatial indexing if available
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'citizen', -- 'citizen', 'inspector', 'admin'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Potholes Table
CREATE TABLE IF NOT EXISTS public.potholes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.85,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'confirmed', 'repaired', 'rejected')),
    road_name TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'India',
    image_url TEXT,
    detection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    vote_count INT DEFAULT 1,
    speed_at_detection REAL,
    heading REAL,
    gps_accuracy REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial & Composite Indexes for fast proximity queries
CREATE INDEX IF NOT EXISTS idx_potholes_coordinates ON public.potholes (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_potholes_status ON public.potholes (status);
CREATE INDEX IF NOT EXISTS idx_potholes_timestamp ON public.potholes (detection_timestamp DESC);

-- 3. Pothole Individual Reports Table
CREATE TABLE IF NOT EXISTS public.pothole_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pothole_id UUID REFERENCES public.potholes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    confidence REAL,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Pothole Confirmations & Community Votes
CREATE TABLE IF NOT EXISTS public.pothole_confirmations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pothole_id UUID REFERENCES public.potholes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('confirm', 'reject', 'repaired')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Scan Sessions Table
CREATE TABLE IF NOT EXISTS public.scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    detections_count INT DEFAULT 0,
    distance_travelled_km REAL DEFAULT 0.0
);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.potholes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pothole_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pothole_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;

-- Anonymous public read access for safety map
CREATE POLICY "Public read access to potholes" ON public.potholes
    FOR SELECT USING (true);

-- Authenticated citizen insertion policy
CREATE POLICY "Allow reporting potholes" ON public.potholes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow citizen confirmations" ON public.pothole_confirmations
    FOR INSERT WITH CHECK (true);

-- Enable Realtime Broadcast for Potholes
ALTER PUBLICATION supabase_realtime ADD TABLE public.potholes;
