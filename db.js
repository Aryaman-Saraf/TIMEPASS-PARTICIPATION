// db.js — Universal Database Adapter for Candor
// Supports Supabase PostgreSQL (via REST API) with automatic local filesystem fallback.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA = process.env.DATA_DIR || path.join(ROOT, 'data', 'sessions');
const CANDIDATES_FILE = path.join(ROOT, 'data', 'candidates.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const IS_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

// In-memory cache for ultra-fast response & busy lock coordination
const cacheCandidates = new Map();
const cacheSessions = new Map();

// Helper for Supabase REST API requests
async function sbFetch(endpoint, options = {}) {
  if (!IS_SUPABASE) return null;
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };
  try {
    const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Supabase ${res.status}] ${endpoint}: ${errText.slice(0, 150)}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return true;
  } catch (err) {
    console.warn(`[Supabase Error] ${endpoint}: ${err.message}`);
    return null;
  }
}

// ----------------- Candidate Operations -----------------

export async function listCandidates() {
  if (IS_SUPABASE) {
    const data = await sbFetch('candidates?select=*&order=created_at.desc');
    if (Array.isArray(data)) {
      cacheCandidates.clear();
      for (const c of data) {
        const mapped = mapCandidateFromDB(c);
        cacheCandidates.set(mapped.id, mapped);
      }
      return [...cacheCandidates.values()];
    }
  }
  return [...cacheCandidates.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function getCandidate(id) {
  if (!id) return null;
  if (IS_SUPABASE) {
    const data = await sbFetch(`candidates?id=eq.${encodeURIComponent(id)}&select=*`);
    if (Array.isArray(data) && data.length > 0) {
      const mapped = mapCandidateFromDB(data[0]);
      cacheCandidates.set(mapped.id, mapped);
      return mapped;
    }
  }
  return cacheCandidates.get(String(id)) || null;
}

export async function saveCandidate(candidate) {
  if (!candidate?.id) return null;
  cacheCandidates.set(candidate.id, candidate);

  // Sync to Supabase if configured
  if (IS_SUPABASE) {
    const row = mapCandidateToDB(candidate);
    await sbFetch('candidates', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row)
    });
  }

  // Persist locally
  await writeFile(CANDIDATES_FILE, JSON.stringify([...cacheCandidates.values()], null, 2)).catch(e => console.warn(`[saveCandidates] ${e.message}`));
  return candidate;
}

export async function deleteCandidate(id) {
  if (!id) return false;
  const deleted = cacheCandidates.delete(id);

  if (IS_SUPABASE) {
    await sbFetch(`candidates?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  await writeFile(CANDIDATES_FILE, JSON.stringify([...cacheCandidates.values()], null, 2)).catch(e => console.warn(`[deleteCandidate] ${e.message}`));
  return deleted;
}

// ----------------- Session Operations -----------------

export async function listSessions() {
  if (IS_SUPABASE) {
    const data = await sbFetch('sessions?select=id,candidate_name,role,status,created_at,overall_score,recommendation,integrity_risk&order=created_at.desc');
    if (Array.isArray(data)) {
      return data.map(r => ({
        id: r.id,
        candidateName: r.candidate_name,
        role: r.role,
        createdAt: r.created_at,
        status: r.status,
        overallScore: r.overall_score,
        recommendation: r.recommendation,
        integrityRisk: r.integrity_risk
      }));
    }
  }

  return [...cacheSessions.values()].map(s => ({
    id: s.id,
    candidateName: s.candidateName,
    role: s.role,
    createdAt: s.createdAt,
    status: s.status,
    overallScore: s.report?.overallScore ?? null,
    recommendation: s.report?.recommendation ?? null,
    integrityRisk: s.integrity?.captured ? s.integrity.riskLevel : null,
  })).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function getSession(id) {
  if (!id) return null;
  if (IS_SUPABASE) {
    const data = await sbFetch(`sessions?id=eq.${encodeURIComponent(id)}&select=*`);
    if (Array.isArray(data) && data.length > 0) {
      const full = mapSessionFromDB(data[0]);
      cacheSessions.set(full.id, full);
      return full;
    }
  }
  return cacheSessions.get(String(id)) || null;
}

export async function saveSession(session) {
  if (!session?.id) return;
  cacheSessions.set(session.id, session);

  if (IS_SUPABASE) {
    const row = mapSessionToDB(session);
    await sbFetch('sessions', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row)
    });
  }

  // Local persistence
  await writeFile(path.join(LOCAL_DATA, `${session.id}.json`), JSON.stringify(session, null, 1)).catch(e => console.warn(`[saveSession] ${e.message}`));
}

// ----------------- Automatic Recruiter Ranking Engine -----------------

export async function getRankings(filterRole = null) {
  const sessions = await listSessions();
  const evaluated = sessions.filter(s => s.status === 'evaluated' && typeof s.overallScore === 'number');

  let filtered = evaluated;
  if (filterRole && filterRole.trim() !== '' && filterRole.toLowerCase() !== 'all') {
    filtered = evaluated.filter(s => s.role?.toLowerCase().includes(filterRole.toLowerCase().trim()));
  }

  // Sort descending by overallScore
  filtered.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

  // Compute ranks and percentiles
  const total = filtered.length;
  const ranked = filtered.map((s, idx) => {
    const rank = idx + 1;
    const percentile = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100;
    return {
      rank,
      percentile,
      sessionId: s.id,
      candidateName: s.candidateName,
      role: s.role,
      createdAt: s.createdAt,
      overallScore: s.overallScore,
      recommendation: s.recommendation,
      integrityRisk: s.integrityRisk || 'low'
    };
  });

  // Calculate high-level pipeline stats
  const strongHireCount = ranked.filter(r => r.recommendation === 'Strong Hire').length;
  const hireCount = ranked.filter(r => r.recommendation === 'Hire').length;
  const leanHireCount = ranked.filter(r => r.recommendation === 'Lean Hire').length;
  const noHireCount = ranked.filter(r => r.recommendation === 'No Hire').length;
  const avgScore = total > 0 ? Math.round(ranked.reduce((a, b) => a + (b.overallScore || 0), 0) / total) : 0;

  return {
    totalEvaluated: total,
    averageScore: avgScore,
    stats: {
      strongHire: strongHireCount,
      hire: hireCount,
      leanHire: leanHireCount,
      noHire: noHireCount,
    },
    rankings: ranked
  };
}

// ----------------- Initialization & Pre-Seeding -----------------

export async function initDB() {
  await mkdir(LOCAL_DATA, { recursive: true });

  // 1. Load candidates from local JSON or initialize defaults
  try {
    const raw = await readFile(CANDIDATES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      for (const c of parsed) cacheCandidates.set(c.id, c);
    }
  } catch {
    // Default seed candidates if file does not exist
    const defaultCandidates = [
      {
        id: 'cand-001',
        name: 'Sarah Jenkins',
        email: 'sarah.jenkins@example.com',
        role: 'Senior Frontend Engineer',
        department: 'Platform Engineering',
        status: 'ready',
        questionCount: 4,
        jobDescription: 'Senior Frontend Engineer specializing in React 18/19, TypeScript, Core Web Vitals optimization, and real-time state management.',
        resumeText: 'Sarah Jenkins - 6 years frontend engineering at FinTech Co. Led migration to Next.js 14, reduced LCP from 3.8s to 1.4s via lazy-loading and code splitting.',
        createdAt: '2026-09-26T08:00:00.000Z'
      },
      {
        id: 'cand-002',
        name: 'Alex Chen',
        email: 'alex.chen@example.com',
        role: 'Senior Backend Engineer',
        department: 'Infrastructure & Distributed Systems',
        status: 'ready',
        questionCount: 4,
        jobDescription: 'Distributed systems engineer experienced in high-throughput Node.js microservices, Postgres sharding, Redis caching, and incident RCA.',
        resumeText: 'Alex Chen - 7 years backend engineering at ScaleStream. Designed event-driven payment reconciliation pipeline processing 15k TPS with zero data loss.',
        createdAt: '2026-09-26T08:15:00.000Z'
      },
      {
        id: 'cand-003',
        name: 'Jordan Lee',
        email: 'jordan.lee@example.com',
        role: 'Full Stack AI Engineer',
        department: 'Conversational Applications',
        status: 'ready',
        questionCount: 4,
        jobDescription: 'Full Stack Engineer to build AI-powered conversational tools. Deep proficiency in modern JavaScript, REST/WebSocket APIs, responsive UI design.',
        resumeText: 'Jordan Lee - 4 years full stack experience at HealthAI. Built real-time clinician dashboard using WebRTC and Node.js. Optimized database query performance.',
        createdAt: '2026-09-26T08:30:00.000Z'
      }
    ];
    for (const c of defaultCandidates) cacheCandidates.set(c.id, c);
    await writeFile(CANDIDATES_FILE, JSON.stringify(defaultCandidates, null, 2)).catch(() => {});
  }

  // 2. Load sessions from data/ and data/sessions/
  for (const dir of [path.join(ROOT, 'data'), LOCAL_DATA]) {
    try {
      const files = await readdir(dir);
      for (const f of files.filter(f => f.endsWith('.json') && f !== 'candidates.json')) {
        try {
          const s = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
          if (s?.id) cacheSessions.set(String(s.id), s);
        } catch {}
      }
    } catch {}
  }

  // 3. If Supabase is active, fetch cloud data and sync local if cloud is empty
  if (IS_SUPABASE) {
    console.log(`[db] Connected to Supabase Cloud: ${SUPABASE_URL}`);
    const cloudCands = await sbFetch('candidates?select=id');
    if (Array.isArray(cloudCands) && cloudCands.length === 0 && cacheCandidates.size > 0) {
      console.log(`[db] Seeding initial ${cacheCandidates.size} candidates to Supabase...`);
      for (const c of cacheCandidates.values()) {
        await saveCandidate(c);
      }
    }
  } else {
    console.log(`[db] Running in Local Storage Mode (${cacheCandidates.size} candidates, ${cacheSessions.size} sessions)`);
  }
}

// ----------------- DB Mappers -----------------

function mapCandidateToDB(c) {
  return {
    id: c.id,
    name: c.name,
    email: c.email || '',
    role: c.role,
    department: c.department || 'Engineering',
    status: c.status || 'ready',
    question_count: c.questionCount || 4,
    job_description: c.jobDescription || '',
    resume_text: c.resumeText || '',
    created_at: c.createdAt || new Date().toISOString()
  };
}

function mapCandidateFromDB(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    department: r.department,
    status: r.status,
    questionCount: r.question_count,
    jobDescription: r.job_description,
    resumeText: r.resume_text,
    createdAt: r.created_at
  };
}

function mapSessionToDB(s) {
  return {
    id: s.id,
    candidate_name: s.candidateName,
    role: s.role,
    status: s.status,
    job_description: s.jobDescription || '',
    resume_text: s.resumeText || '',
    overall_score: s.report?.overallScore ?? null,
    recommendation: s.report?.recommendation ?? null,
    integrity_risk: s.integrity?.captured ? s.integrity.riskLevel : null,
    raw_session: s,
    created_at: s.createdAt || new Date().toISOString()
  };
}

function mapSessionFromDB(r) {
  if (r.raw_session && typeof r.raw_session === 'object') {
    return r.raw_session;
  }
  return {
    id: r.id,
    candidateName: r.candidate_name,
    role: r.role,
    status: r.status,
    overallScore: r.overall_score,
    recommendation: r.recommendation,
    createdAt: r.created_at,
    turns: [],
    plan: []
  };
}

export { cacheCandidates, cacheSessions, IS_SUPABASE };
