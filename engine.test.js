// Engine tests (Teammate 2). Offline: provider keys are removed before engine.js loads, so nothing hits the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.GROQ_API_KEY; delete process.env.GEMINI_API_KEY;
const { nextStep, computeIntegrity, overallScore, recommend, parseJSON, heuristic, startInterview, chatTurn, evaluate, LIMITS } = await import('./engine.js');

const state = (o = {}) => ({ difficulty: 3, followUps: 0, cursor: 0, plan: [{}, {}, {}], turns: [], ...o });
const ev = (type, durationMs, extra = {}) => ({ type, t: 0, at: '2026-09-26T05:00:00.000Z', durationMs, ...extra });
const run = async () => {
  const s = await startInterview({ candidateName: 'Test User', role: 'Backend Engineer', jobDescription: 'Node.js, SQL', questionCount: 3 });
  for (let i = 0; i < LIMITS.MAX_ANSWERS && s.status === 'active'; i++) await chatTurn(s, 'When our project broke I fixed the cache and latency reduced 40%.');
  return s;
};

test('nextStep: at most MAX_FOLLOWUPS probes, wraps at the last question and at MAX_ANSWERS', () => {
  assert.equal(nextStep(state(), 'probe', 3).action, 'probe');
  assert.equal(nextStep(state({ followUps: LIMITS.MAX_FOLLOWUPS }), 'probe', 3).action, 'advance');
  assert.equal(nextStep(state({ cursor: 2 }), 'advance', 3).action, 'wrap_up');
  assert.equal(nextStep(state({ cursor: 2, followUps: LIMITS.MAX_FOLLOWUPS }), 'probe', 3).action, 'wrap_up');
  assert.equal(nextStep(state({ turns: Array(LIMITS.MAX_ANSWERS).fill({ role: 'candidate' }) }), 'probe', 3).action, 'wrap_up');
});

test('nextStep: difficulty +1 on score ≥ 4, −1 on score ≤ 2, clamped to 1–5', () => {
  assert.equal(nextStep(state(), 'advance', 4).difficulty, 4);
  assert.equal(nextStep(state(), 'advance', 2).difficulty, 2);
  assert.equal(nextStep(state(), 'advance', 3).difficulty, 3);
  assert.equal(nextStep(state({ difficulty: 5 }), 'advance', 5).difficulty, 5);
  assert.equal(nextStep(state({ difficulty: 1 }), 'advance', 1).difficulty, 1);
});

test('computeIntegrity: clean run is 100/low; a tab switch lowers it; unknown types and client severity ignored', () => {
  const clean = computeIntegrity({ totalMs: 600000, visionAvailable: true, events: [] });
  assert.deepEqual([clean.score, clean.riskLevel, clean.stats.onScreenPct], [100, 'low', 100]);
  const tab = computeIntegrity({ totalMs: 600000, events: [ev('TAB_HIDDEN', 5000, { severity: 'info' })] });
  assert.ok(tab.score < 100);
  assert.equal(tab.events[0].severity, 'warn');
  assert.equal(computeIntegrity({ totalMs: 600000, events: [ev('HACKED', 1)] }).events.length, 0);
});

test('computeIntegrity: no payload means not captured and no vision', () => {
  const none = computeIntegrity(undefined);
  assert.equal(none.captured, false);
  assert.equal(none.visionAvailable, false);
});

test('overallScore is the weighted BARS mean on 0–100; recommend thresholds', () => {
  const comps = [{ name: 'A', weight: 0.75 }, { name: 'B', weight: 0.25 }];
  assert.equal(overallScore(comps, [{ name: 'A', score: 5 }, { name: 'B', score: 1 }]), 75);
  assert.equal(overallScore(comps, []), 0);
  assert.deepEqual([80, 79, 65, 50, 49].map(recommend), ['Strong Hire', 'Hire', 'Hire', 'Lean Hire', 'No Hire']);
});

test('parseJSON: code fences and surrounding prose', () => {
  assert.deepEqual(parseJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJSON('Sure! {"a":{"b":2}} hope that helps'), { a: { b: 2 } });
  assert.throws(() => parseJSON('no json here'));
});

test('heuristic: a full STAR answer outscores "ok"', () => {
  const star = 'When our payments project had latency problems, I needed to fix it before launch. I designed a Redis cache and refactored the hot queries. As a result p99 latency reduced by 80% and we shipped on time.';
  assert.equal(heuristic(star).starCount, 4);
  assert.ok(heuristic(star).score > heuristic('ok').score);
});

test('full offline interview: completes, evaluates, and integrity never changes the hire score', async () => {
  const s = await run();
  assert.equal(s.engine, 'offline fallback');
  assert.equal(s.status, 'completed');
  const clean = structuredClone(s), messy = structuredClone(s);
  const a = await evaluate(clean, { totalMs: 600000, visionAvailable: true, events: [] });
  const b = await evaluate(messy, { totalMs: 600000, visionAvailable: true, events: [ev('MULTIPLE_FACES', 3000), ev('TAB_HIDDEN', 20000), ev('LOOK_AWAY', 9000)] });
  assert.equal(clean.status, 'evaluated');
  assert.equal(a.competencies.length, s.competencies.length);
  assert.ok(messy.integrity.score < clean.integrity.score);
  assert.deepEqual([b.overallScore, b.recommendation], [a.overallScore, a.recommendation]);
});

test('evaluate: integrity without totalMs uses the session length, not a false high risk', async () => {
  const s = await run();
  s.createdAt = new Date(Date.now() - 10 * 60000).toISOString();
  await evaluate(s, { visionAvailable: true, events: [ev('LOOK_AWAY', 2000)] });
  assert.equal(s.integrity.riskLevel, 'low');
});

test('input guards: role required (400), empty answer (400), finished interview (409)', async () => {
  await assert.rejects(startInterview({ candidateName: 'x' }), { status: 400 });
  await assert.rejects(chatTurn(await run(), 'more'), { status: 409 });
  await assert.rejects(chatTurn(await startInterview({ role: 'Analyst' }), '   '), { status: 400 });
});
