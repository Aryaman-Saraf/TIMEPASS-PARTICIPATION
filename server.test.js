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
