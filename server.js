// HTTP server (Teammate 2): §4 API routes, static files from public/, unified DB persistence (Supabase / local), RBAC auth, resume parsing, and AI candidate rankings.
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { startInterview, chatTurn, evaluate, llmStatus, httpError } from './engine.js';
import {
  initDB,
  listCandidates,
  getCandidate,
  saveCandidate,
  deleteCandidate,
  listSessions,
  getSession,
  saveSession,
  getRankings,
  cacheCandidates,
  cacheSessions,
  IS_SUPABASE
} from './db.js';
import { login, getUserFromToken, logout } from './auth.js';
import { parseResumePayload } from './resumeParser.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 1 << 20; // 1 MB
const PUBLIC = path.join(ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Backwards-compatible exports for contract tests & modules
export const sessions = cacheSessions;
export const candidates = cacheCandidates;
export const busy = new Set();
export const load = initDB;

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

async function locked(id, fn) {
  const s = await getSession(id);
  if (!s) throw httpError(404, 'session not found');
  if (busy.has(s.id)) throw httpError(409, 'session is busy, retry shortly');
  busy.add(s.id);
  try {
    const out = await fn(s);
    await saveSession(s);
    return out;
  } finally {
    busy.delete(s.id);
  }
}

const routes = {
  // 1. Health & Infrastructure
  'GET /api/health': () => ({ ok: true, llm: llmStatus() }),

  // 2. Authentication & Role-Based Access Control (RBAC)
  'POST /api/auth/login': async b => login(b),
  'GET /api/auth/me': (_, __, req) => {
    const user = getUserFromToken(req.headers['authorization']);
    if (!user) throw httpError(401, 'Unauthorized or session expired');
    return { ok: true, user };
  },
  'POST /api/auth/logout': (_, __, req) => logout(req.headers['authorization']),

  // 3. Interview Sessions
  'GET /api/sessions': async () => listSessions(),
  'GET /api/session': async (_, url) => {
    const id = url.searchParams.get('id');
    const s = await getSession(id);
    if (!s) throw httpError(404, 'session not found');
    return s;
  },
  'POST /api/start-interview': async b => {
    const s = await startInterview(b);
    if (b.candidateId) s.candidateId = b.candidateId;
    await saveSession(s);
    return s;
  },
  'POST /api/chat-turn': b => locked(b.sessionId, s => chatTurn(s, b.answer)),
  'POST /api/evaluate': b => locked(b.sessionId, async s => {
    await evaluate(s, b.integrity);
    try {
      if (s.candidateId) {
        const cand = await getCandidate(s.candidateId);
        if (cand) { cand.status = 'completed'; await saveCandidate(cand); }
      } else if (s.candidateName) {
        const all = await listCandidates();
        const cand = all.find(c => c.name.toLowerCase() === s.candidateName.toLowerCase());
        if (cand) { cand.status = 'completed'; await saveCandidate(cand); }
      }
    } catch (e) {
      console.warn('[evaluate candidate update notice]', e.message);
    }
    return s;
  }),

  // 4. Candidate Pipeline Management
  'GET /api/candidates': async () => listCandidates(),
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
    await saveCandidate(cand);
    return cand;
  },
  'DELETE /api/candidates': async (_, url) => {
    const id = url.searchParams.get('id');
    if (!id) throw httpError(400, 'id required');
    const deleted = await deleteCandidate(id);
    return { ok: deleted, id };
  },
  'POST /api/candidate/resume': async b => {
    if (!b.candidateId || !b.resumeText) throw httpError(400, 'candidateId and resumeText required');
    const cand = await getCandidate(b.candidateId);
    if (!cand) throw httpError(404, 'candidate not found');
    cand.resumeText = String(b.resumeText);
    await saveCandidate(cand);
    return { ok: true, characterCount: cand.resumeText.length };
  },

  // 5. Automated Resume Upload & Parsing Engine (PDF / Text + PII Redaction)
  'POST /api/candidate/resume-upload': async b => {
    if (!b.candidateId) throw httpError(400, 'candidateId required');
    const cand = await getCandidate(b.candidateId);
    if (!cand) throw httpError(404, 'candidate not found');

    const parsed = parseResumePayload({
      text: b.text,
      base64: b.base64,
      filename: b.filename,
      candidateName: cand.name
    });

    cand.resumeText = parsed.rawText;
    await saveCandidate(cand);

    return {
      ok: true,
      candidateId: cand.id,
      wordCount: parsed.wordCount,
      characterCount: parsed.characterCount,
      preview: parsed.preview,
      redactedSample: parsed.sanitizedText.slice(0, 200)
    };
  },

  // 6. Recruiter AI Candidate Ranking Leaderboard
  'GET /api/recruiter/rankings': async (_, url) => {
    const roleFilter = url.searchParams.get('role');
    return getRankings(roleFilter);
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

// Core Request Handler (Exported for both Local Node Server and Vercel Serverless Function)
export async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  try {
    const route = routes[`${req.method} ${url.pathname}`];
    if (route) send(res, 200, await route(req.method === 'POST' ? await readBody(req) : {}, url, req));
    else if (req.method === 'GET' && !url.pathname.startsWith('/api/')) await serveStatic(url.pathname, res);
    else throw httpError(404, 'not found');
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
  }
}

export const server = http.createServer(handleRequest);

// Listen only when run directly (tests and serverless import `server`).
if (path.resolve(process.argv[1] || '').toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  await load();
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => console.log(`Candor on http://localhost:${port} · LLM: ${llmStatus()} · DB: ${IS_SUPABASE ? 'Supabase' : 'Local'}`));
}
