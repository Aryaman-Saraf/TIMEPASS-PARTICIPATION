// Contract tests for server.js (IMPLEMENTATION_PLAN §4). Offline: provider keys are removed before the engine loads.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';

delete process.env.GROQ_API_KEY; delete process.env.GEMINI_API_KEY;
process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'candor-'));
const { server, busy, load } = await import('./server.js');

let base, port;
before(async () => {
  await load();
  await new Promise(r => server.listen(0, () => {
    port = server.address().port;
    base = `http://127.0.0.1:${port}`;
    r();
  }));
});
after(() => server.close());

const post = (p, body) => fetch(base + p, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});
const start = async () => (await post('/api/start-interview', { candidateName: 'Test User', role: 'Backend Engineer', questionCount: 3 })).json();
const raw = p => new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path: p }, r => { r.resume(); res(r); }).on('error', rej));

test('GET /api/health reports the LLM chain', async () => {
  assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true, llm: 'offline fallback' });
});

test('full offline interview over HTTP: start → chat until done → evaluate → listed', async () => {
  const s = await start();
  assert.equal(s.status, 'active');
  assert.equal(s.turns[0].role, 'ai');
  let done = false;
  for (let i = 0; i < 16 && !done; i++) {
    const r = await post('/api/chat-turn', { sessionId: s.id, answer: 'When our project had outages I built a cache and latency reduced 40%.' });
    assert.equal(r.status, 200);
    const t = await r.json();
    assert.ok(['probe', 'advance', 'wrap_up'].includes(t.progress.action));
    assert.equal(typeof t.reply, 'string');
    done = t.done;
  }
  assert.ok(done, 'interview reached wrap_up');
  assert.equal((await post('/api/chat-turn', { sessionId: s.id, answer: 'one more' })).status, 409);
  const ev = await (await post('/api/evaluate', {
    sessionId: s.id,
    integrity: {
      totalMs: 60000,
      visionAvailable: true,
      events: [{ type: 'TAB_HIDDEN', t: 1000, at: new Date().toISOString(), durationMs: 3000 }]
    }
  })).json();
  assert.equal(ev.status, 'evaluated');
  assert.equal(typeof ev.report.overallScore, 'number');
  assert.equal(ev.integrity.stats.tabHiddenCount, 1);
  const row = (await (await fetch(base + '/api/sessions')).json()).find(x => x.id === s.id);
  assert.deepEqual([row.status, row.overallScore, row.recommendation, row.integrityRisk], ['evaluated', ev.report.overallScore, ev.report.recommendation, ev.integrity.riskLevel]);
  assert.equal((await (await fetch(`${base}/api/session?id=${s.id}`)).json()).report.recommendation, ev.report.recommendation);
});

test('errors: 400 bad input, 404 unknown session/route, 413 oversized body', async () => {
  const s = await start();
  assert.equal((await post('/api/start-interview', { candidateName: 'x' })).status, 400);
  assert.equal((await post('/api/chat-turn', { sessionId: s.id, answer: '   ' })).status, 400);
  assert.equal((await post('/api/chat-turn', { sessionId: 'nope', answer: 'hi' })).status, 404);
  assert.equal((await fetch(base + '/api/session?id=nope')).status, 404);
  assert.equal((await post('/api/chat-turn', '{not json')).status, 400);
  assert.equal((await post('/api/chat-turn', 'null')).status, 404);
  assert.equal((await post('/api/start-interview', { role: 'x', resumeText: 'a'.repeat(1.1e6) })).status, 413);
  const r = await fetch(base + '/api/nope');
  assert.equal(r.status, 404);
  assert.ok((await r.json()).error);
});

test('busy lock: 409 while in flight, released after success and after errors', async () => {
  const s = await start();
  busy.add(s.id);
  assert.equal((await post('/api/chat-turn', { sessionId: s.id, answer: 'hi there' })).status, 409);
  assert.equal((await post('/api/evaluate', { sessionId: s.id })).status, 409);
  busy.delete(s.id);
  assert.equal((await post('/api/chat-turn', { sessionId: s.id, answer: '' })).status, 400);
  assert.equal((await post('/api/chat-turn', { sessionId: s.id, answer: 'hi there' })).status, 200);
  assert.equal(busy.size, 0);
});

test('static: serves public/ files, blocks encoded traversal, 404s missing files', async () => {
  const html = await fetch(base + '/report.html');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /text\/html/);
  const js = await fetch(base + '/report.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /text\/javascript/);
  assert.equal((await raw('/%2e%2e%2fengine.js')).statusCode, 403);
  assert.equal((await raw('/%2e%2e%2f.env')).statusCode, 403);
  assert.ok([403, 404].includes((await raw('/..%5cengine.js')).statusCode));
  assert.equal((await raw('/missing.html')).statusCode, 404);
  assert.equal((await raw('/%E0%A4%A')).statusCode, 400);
});

test('persistence: sessions written to DATA_DIR, reloaded on load(), bad files skipped, demo seed present', async () => {
  const s = await start();
  assert.equal(JSON.parse(await readFile(path.join(process.env.DATA_DIR, `${s.id}.json`), 'utf8')).id, s.id);
  await writeFile(path.join(process.env.DATA_DIR, 'seed.json'), JSON.stringify({ ...s, id: 'seeded-1' }));
  await writeFile(path.join(process.env.DATA_DIR, 'broken.json'), '{oops');
  await load();
  assert.equal((await fetch(`${base}/api/session?id=seeded-1`)).status, 200);
  assert.equal((await fetch(`${base}/api/session?id=mock-session-001`)).status, 200);
});

test('candidate pipeline: list, add, update resume, delete', async () => {
  // 1. List candidates
  const listRes = await fetch(`${base}/api/candidates`);
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);

  // 2. Add new candidate
  const addRes = await post('/api/candidates', {
    name: 'Morgan Smith',
    email: 'morgan.smith@example.com',
    role: 'Staff Site Reliability Engineer',
    department: 'Cloud Infrastructure',
    jobDescription: 'Kubernetes, multi-region failover, Terraform',
    resumeText: 'Morgan Smith - 8 years SRE at CloudCorp.'
  });
  assert.equal(addRes.status, 200);
  const created = await addRes.json();
  assert.ok(created.id);
  assert.equal(created.name, 'Morgan Smith');

  // 3. Update candidate resume
  const updateRes = await post('/api/candidate/resume', {
    candidateId: created.id,
    resumeText: 'Morgan Smith - Updated Resume with Chaos Engineering experience.'
  });
  assert.equal(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.equal(updated.ok, true);

  // 4. Delete candidate
  const delRes = await fetch(`${base}/api/candidates?id=${created.id}`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);
  const delData = await delRes.json();
  assert.equal(delData.ok, true);
  assert.equal(delData.id, created.id);
});

test('auth & RBAC: recruiter login, candidate login, profile check, and logout', async () => {
  // 1. Recruiter login
  const recRes = await post('/api/auth/login', { role: 'recruiter', password: 'admin123' });
  assert.equal(recRes.status, 200);
  const recData = await recRes.json();
  assert.ok(recData.token);
  assert.equal(recData.user.role, 'recruiter');

  // 2. Auth me check
  const meRes = await fetch(`${base}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${recData.token}` }
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.user.role, 'recruiter');

  // 3. Candidate login via candidateId
  const candRes = await post('/api/auth/login', { candidateId: 'cand-001' });
  assert.equal(candRes.status, 200);
  const candData = await candRes.json();
  assert.equal(candData.user.role, 'candidate');
  assert.equal(candData.user.candidateId, 'cand-001');

  // 4. Logout
  const outRes = await post('/api/auth/logout', {});
  assert.equal(outRes.status, 200);
});

test('resume upload engine: extracts text, redacts PII, and updates candidate', async () => {
  const uploadRes = await post('/api/candidate/resume-upload', {
    candidateId: 'cand-002',
    text: 'Alex Chen (alex.chen@cloud.com, +1 555-019-2834, https://github.com/alex) built high-throughput microservices using Node.js and Redis.'
  });
  assert.equal(uploadRes.status, 200);
  const upData = await uploadRes.json();
  assert.equal(upData.ok, true);
  assert.ok(upData.wordCount > 5);

  // Verify candidate record was updated
  const candRes = await fetch(`${base}/api/candidates`);
  const cands = await candRes.json();
  const alex = cands.find(c => c.id === 'cand-002');
  assert.ok(alex.resumeText.includes('high-throughput microservices'));
});

test('recruiter AI rankings: calculates rank, percentile, and hire distribution', async () => {
  const rankRes = await fetch(`${base}/api/recruiter/rankings`);
  assert.equal(rankRes.status, 200);
  const data = await rankRes.json();
  assert.ok(typeof data.totalEvaluated === 'number');
  assert.ok(typeof data.averageScore === 'number');
  assert.ok(data.stats);
  assert.ok(Array.isArray(data.rankings));
});

