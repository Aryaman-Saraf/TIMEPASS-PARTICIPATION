-- ==============================================================================
-- Candor AI Interview Platform — Supabase Production Database Schema
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Candidates Table
CREATE TABLE IF NOT EXISTS public.candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT DEFAULT 'Engineering',
  status TEXT DEFAULT 'ready',
  question_count INTEGER DEFAULT 4,
  job_description TEXT DEFAULT '',
  resume_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_candidates_role ON public.candidates(role);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates(email);

-- 2. Sessions & Evaluations Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  job_description TEXT DEFAULT '',
  resume_text TEXT DEFAULT '',
  overall_score INTEGER,
  recommendation TEXT,
  integrity_risk TEXT,
  raw_session JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_score ON public.sessions(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_role ON public.sessions(role);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);

-- 3. Authentication Users Table
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('recruiter', 'candidate', 'admin')),
  candidate_id TEXT REFERENCES public.candidates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access via API key for hackathon service
CREATE POLICY "Allow public select on candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Allow public insert on candidates" ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on candidates" ON public.candidates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on candidates" ON public.candidates FOR DELETE USING (true);

CREATE POLICY "Allow public select on sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sessions" ON public.sessions FOR UPDATE USING (true);

CREATE POLICY "Allow public select on app_users" ON public.app_users FOR SELECT USING (true);

-- 5. Seed Initial Roster if empty
INSERT INTO public.candidates (id, name, email, role, department, status, question_count, job_description, resume_text)
VALUES
  ('cand-001', 'Sarah Jenkins', 'sarah.jenkins@example.com', 'Senior Frontend Engineer', 'Platform Engineering', 'ready', 4, 
   'Senior Frontend Engineer specializing in React 18/19, TypeScript, Core Web Vitals optimization, and real-time state management.',
   'Sarah Jenkins - 6 years frontend engineering at FinTech Co. Led migration to Next.js 14, reduced LCP from 3.8s to 1.4s via lazy-loading and code splitting.'),
  ('cand-002', 'Alex Chen', 'alex.chen@example.com', 'Senior Backend Engineer', 'Infrastructure & Distributed Systems', 'ready', 4,
   'Distributed systems engineer experienced in high-throughput Node.js microservices, Postgres sharding, Redis caching, and incident RCA.',
   'Alex Chen - 7 years backend engineering at ScaleStream. Designed event-driven payment reconciliation pipeline processing 15k TPS with zero data loss.'),
  ('cand-003', 'Jordan Lee', 'jordan.lee@example.com', 'Full Stack AI Engineer', 'Conversational Applications', 'ready', 4,
   'Full Stack Engineer to build AI-powered conversational tools. Deep proficiency in modern JavaScript, REST/WebSocket APIs, responsive UI design.',
   'Jordan Lee - 4 years full stack experience at HealthAI. Built real-time clinician dashboard using WebRTC and Node.js. Optimized database query performance.')
ON CONFLICT (id) DO NOTHING;
