// HTTP server (Teammate 2): §4 API routes, static files from public/, JSON session persistence, per-session busy lock.
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { startInterview, chatTurn, evaluate, llmStatus, httpError } from './engine.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 1 << 20; // 1 MB
const PUBLIC = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data', 'sessions');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export const sessions = new Map();
export const busy = new Set();
export const candidates = new Map([
  ['cand-001', {
    id: 'cand-001',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@example.com',
    role: 'Senior Frontend Engineer',
    department: 'Platform Engineering',
    status: 'ready',
    questionCount: 4,
    jobDescription: 'Senior Frontend Engineer specializing in React 18/19, TypeScript, Core Web Vitals optimization, and real-time state management. Experience with high-traffic enterprise design systems and WebSockets required.',
    resumeText: 'Sarah Jenkins - 6 years frontend engineering at FinTech Co. Led migration to Next.js 14, reduced LCP from 3.8s to 1.4s via lazy-loading and code splitting. Authored enterprise component library used across 12 product teams.',
    createdAt: '2026-09-26T08:00:00.000Z'
  }],
  ['cand-002', {
    id: 'cand-002',
    name: 'Alex Chen',
    email: 'alex.chen@example.com',
    role: 'Senior Backend Engineer',
    department: 'Infrastructure & Distributed Systems',
    status: 'ready',
    questionCount: 4,
    jobDescription: 'Distributed systems engineer experienced in high-throughput Node.js microservices, Postgres sharding, Redis caching, and incident RCA. Must demonstrate strong concurrency control and API design.',
    resumeText: 'Alex Chen - 7 years backend engineering at ScaleStream. Designed event-driven payment reconciliation pipeline processing 15k TPS with zero data loss. Implemented distributed Redis locks and multi-region failover.',
    createdAt: '2026-09-26T08:15:00.000Z'
  }],
  ['cand-003', {
    id: 'cand-003',
    name: 'Jordan Lee',
    email: 'jordan.lee@example.com',
    role: 'Full Stack AI Engineer',
    department: 'Conversational Applications',
    status: 'ready',
    questionCount: 4,
    jobDescription: 'Full Stack Engineer to build AI-powered conversational tools. Deep proficiency in modern JavaScript, REST/WebSocket APIs, responsive UI design, and cloud deployments.',
    resumeText: 'Jordan Lee - 4 years full stack experience at HealthAI. Built real-time clinician dashboard using WebRTC and Node.js. Optimized database query performance and implemented OAuth2 authentication.',
    createdAt: '2026-09-26T08:30:00.000Z'
  }]
]);

const save = s => writeFile(path.join(DATA, `${s.id}.json`), JSON.stringify(s, null, 1)).catch(e => console.warn(`[save] ${e.message}`));

// Top-level data/*.json are committed demo seeds (mock-session.json, backup demo runs); DATA copies load last and win.
export async function load() {
  await mkdir(DATA, { recursive: true });
  for (const dir of [path.join(ROOT, 'data'), DATA]) {
    try {
      const files = await readdir(dir);
      for (const f of files.filter(f => f.endsWith('.json'))) {
        try {
          const s = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
          if (s?.id) sessions.set(String(s.id), s);
        } catch (e) {
          console.warn(`[load] skipped ${f}: ${e.message}`);
        }
      }
    } catch {
      // directory might not exist yet, handled by mkdir
    }
  }
}

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size <= MAX_BODY) chunks.push(c);
  }
  if (size > MAX_BODY) throw httpError(413, 'request body too large');
  if (!size) return {};
  let body;
  try { body = JSON.parse(Buffer.concat(chunks)); } catch { throw httpError(400, 'invalid JSON'); }
  return body && typeof body === 'object' ? body : {};
}

function get(id) {
  const s = sessions.get(String(id));
  if (!s) throw httpError(404, 'session not found');
  return s;
}

async function locked(id, fn) {
  const s = get(id);
  if (busy.has(s.id)) throw httpError(409, 'session is busy, retry shortly');
  busy.add(s.id);
  try {
    const out = await fn(s);
    await save(s);
    return out;
  } finally {
    busy.delete(s.id);
  }
}

const summary = s => ({
  id: s.id, candidateName: s.candidateName, role: s.role, createdAt: s.createdAt, status: s.status,
  overallScore: s.report?.overallScore ?? null, recommendation: s.report?.recommendation ?? null,
  integrityRisk: s.integrity?.captured ? s.integrity.riskLevel : null,
});

const routes = {
  'GET /api/health': () => ({ ok: true, llm: llmStatus() }),
  'GET /api/sessions': () => [...sessions.values()].map(summary).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  'GET /api/session': (_, url) => get(url.searchParams.get('id')),
  'POST /api/start-interview': async b => {
    const s = await startInterview(b);
    sessions.set(s.id, s);
    await save(s);
    return s;
  },
  'POST /api/chat-turn': b => locked(b.sessionId, s => chatTurn(s, b.answer)),
  'POST /api/evaluate': b => locked(b.sessionId, async s => { await evaluate(s, b.integrity); return s; }),
  'GET /api/candidates': () => [...candidates.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
  'POST /api/candidates': async b => {
    if (!b.name || !b.role) throw httpError(400, 'name and role required');
    const id = b.id || `cand-${crypto.randomUUID().slice(0, 8)}`;
    const cand = {
      id,
      name: String(b.name).trim(),
      email: String(b.email || '').trim(),
      role: String(b.role).trim(),
      department: String(b.department || 'Engineering').trim(),
      status: b.status || 'ready',
      questionCount: Number(b.questionCount) || 4,
      jobDescription: String(b.jobDescription || '').trim(),
      resumeText: String(b.resumeText || '').trim(),
      createdAt: b.createdAt || new Date().toISOString()
    };
    candidates.set(id, cand);
    return cand;
  },
  'DELETE /api/candidates': (_, url) => {
    const id = url.searchParams.get('id');
    if (!id) throw httpError(400, 'id required');
    const deleted = candidates.delete(id);
    return { ok: deleted, id };
  },
  'POST /api/candidate/resume': async b => {
    if (!b.candidateId || !b.resumeText) throw httpError(400, 'candidateId and resumeText required');
    const cand = candidates.get(b.candidateId);
    if (!cand) throw httpError(404, 'candidate not found');
    cand.resumeText = String(b.resumeText);
    return { ok: true, characterCount: cand.resumeText.length };
  },
};

async function serveStatic(pathname, res) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { throw httpError(400, 'bad path'); }
  const file = path.join(PUBLIC, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(PUBLIC + path.sep)) throw httpError(403, 'forbidden');
  let data;
  try { data = await readFile(file); } catch { throw httpError(404, 'not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(data);
}

const send = (res, status, data) => res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    const route = routes[`${req.method} ${url.pathname}`];
    if (route) send(res, 200, await route(req.method === 'POST' ? await readBody(req) : {}, url));
    else if (req.method === 'GET' && !url.pathname.startsWith('/api/')) await serveStatic(url.pathname, res);
    else throw httpError(404, 'not found');
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
  }
});

// Listen only when run directly (tests import `server`). Case-insensitive: Windows drive letters vary.
if (path.resolve(process.argv[1] || '').toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  await load();
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => console.log(`Candor on http://localhost:${port} · LLM: ${llmStatus()} · ${sessions.size} session(s)`));
}
