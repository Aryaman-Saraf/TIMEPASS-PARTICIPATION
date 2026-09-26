// Conversational engine (Teammate 2): LLM calls, adaptive interview state machine, BARS scoring, integrity risk.
import crypto from 'node:crypto';

export const LIMITS = { MAX_FOLLOWUPS: 2, MAX_ANSWERS: 16, DEFAULT_QUESTIONS: 5 };
export const BARS = {
  1: 'No relevant evidence; vague, off-topic or incorrect.',
  2: 'Limited evidence; generic statements, few specifics, unclear personal contribution.',
  3: 'Competent; a relevant example with some specifics and clear personal actions.',
  4: 'Strong; specific STAR example, sound reasoning, measurable results.',
  5: 'Exceptional; deep expertise, trade-offs weighed, significant measurable impact.',
};
const INTEGRITY_TYPES = ['LOOK_AWAY', 'FACE_MISSING', 'MULTIPLE_FACES', 'TAB_HIDDEN', 'WINDOW_BLUR'];

export const httpError = (status, message) => Object.assign(new Error(message), { status });
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int15 = (v, dflt) => clamp(Math.round(Number(v)) || dflt, 1, 5);
const first = name => name.split(/\s+/)[0];

// ---------- LLM: OpenAI-compatible chat completions, Groq first, Gemini fallback ----------
const PROVIDERS = [
  process.env.GROQ_API_KEY && {
    name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY,
    fast: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b', smart: process.env.GROQ_SMART_MODEL || 'openai/gpt-oss-120b',
    extra: { reasoning_effort: 'low' },
  },
  process.env.GEMINI_API_KEY && {
    name: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: process.env.GEMINI_API_KEY,
    fast: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', smart: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    extra: {},
  },
].filter(Boolean);

export const llmStatus = () => (PROVIDERS.length ? PROVIDERS.map(p => `${p.name}`).join(' → ') : 'offline fallback');

export function parseJSON(text) {
  const s = String(text).replace(/```(?:json)?/g, '');
  return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
}

async function llmJSON(system, user, tier) {
  let lastErr = new Error('no LLM provider configured');
  for (const p of PROVIDERS) {
    for (const jsonMode of [true, false]) {
      try {
        const res = await fetch(p.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
          body: JSON.stringify({
            model: p[tier], temperature: 0.4, ...p.extra,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            ...(jsonMode && { response_format: { type: 'json_object' } }),
          }),
          signal: AbortSignal.timeout(tier === 'smart' ? 45000 : 8000),
        });
        if (!res.ok) {
          lastErr = new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 200)}`);
          if (res.status === 400 && jsonMode) continue; // model may not support JSON mode; retry without
          break;
        }
        const data = await res.json();
        return parseJSON(data.choices[0].message.content);
      } catch (e) { lastErr = e; break; }
    }
    console.warn(`[llm] ${lastErr.message}`);
  }
  throw lastErr;
}

// ---------- Adaptive policy (pure; the LLM proposes, this decides) ----------
export function nextStep(s, proposed, score) {
  const difficulty = clamp(s.difficulty + (score >= 4 ? 1 : score <= 2 ? -1 : 0), 1, 5);
  const answers = s.turns.filter(t => t.role === 'candidate').length;
  let action = proposed === 'probe' && s.followUps < LIMITS.MAX_FOLLOWUPS ? 'probe' : 'advance';
  if (action === 'advance' && s.cursor >= s.plan.length - 1) action = 'wrap_up';
  if (answers >= LIMITS.MAX_ANSWERS) action = 'wrap_up';
  return { action, difficulty };
}

// ---------- Offline heuristics (demo fail-safe when every provider is down) ----------
export function heuristic(answer) {
  const a = answer.toLowerCase(), words = a.split(/\s+/).filter(Boolean).length;
  const star = {
    situation: /\b(when|situation|at (my|our)|project|we had|there was)\b/.test(a),
    task: /\b(goal|task|needed to|responsible|asked to|had to)\b/.test(a),
    action: /\bi (built|led|designed|implemented|wrote|created|decided|fixed|analy[sz]ed|set up|proposed|worked|refactored|migrated)\b/.test(a),
    result: /\b(result|outcome|improved|reduced|increased|saved|launched|shipped|grew|\d+\s?%)/.test(a),
  };
  const starCount = Object.values(star).filter(Boolean).length;
  const score = clamp(1 + (words > 25) + (words > 70) + (starCount >= 2) + (starCount >= 4), 1, 5);
  return { score, star, words, starCount };
}

const SKILLS = ['javascript', 'typescript', 'react', 'node', 'python', 'java', 'golang', 'sql', 'aws', 'docker', 'kubernetes',
  'machine learning', 'data analysis', 'system design', 'api', 'leadership', 'product', 'testing', 'excel', 'sales', 'marketing', 'figma'];

function fallbackPlan(s, n) {
  const all = `${s.resumeText} ${s.jobDescription}`.toLowerCase();
  const skills = SKILLS.filter(k => all.includes(k));
  const top = skills.find(k => s.jobDescription.toLowerCase().includes(k)) || skills[0] || 'your core skills';
  const competencies = [
    ['Role Expertise', 0.35, `Applies ${top} and domain knowledge accurately in real work.`],
    ['Problem Solving', 0.25, 'Breaks down ambiguous problems, weighs trade-offs, reaches sound decisions.'],
    ['Ownership & Impact', 0.2, 'Takes responsibility and drives measurable outcomes.'],
    ['Collaboration', 0.2, 'Communicates clearly and works effectively with others.'],
  ].map(([name, weight, description]) => ({ name, weight, description }));
  const bank = [
    ['Role Expertise', 2, `To start, walk me through your background and what draws you to this ${s.role} role.`],
    ['Role Expertise', 3, `Tell me about a project where you used ${top}. What was your specific contribution?`],
    ['Problem Solving', 3, 'Describe the hardest problem you have solved at work. How did you approach it?'],
    ['Ownership & Impact', 3, 'Tell me about a time you took ownership of something that was going wrong. What did you do, and what was the result?'],
    ['Collaboration', 3, 'Describe a disagreement with a teammate or stakeholder. How did you resolve it?'],
    ['Problem Solving', 4, `Imagine a critical issue breaks on your first week as ${s.role}. How would you prioritise and respond?`],
    ['Role Expertise', 4, `What is a trade-off you made recently involving ${top}, and would you make it again?`],
    ['Ownership & Impact', 4, 'What is the most measurable impact you have had in a role, and how did you measure it?'],
  ];
  const questions = bank.slice(0, n).map(([competency, difficulty, text]) => ({ competency, difficulty, text, rationale: 'Standard structured question.' }));
  return {
    profile: { summary: `Candidate for ${s.role}.`, seniority: 'unknown', yearsExperience: null, skills, highlights: [], probeAreas: [] },
    competencies, questions,
    opening: `Hi ${first(s.candidateName)}, I'm Ava, and I'll be your interviewer today. We'll go through about ${n} questions with a few follow-ups, so just speak naturally. ${questions[0].text}`,
  };
}

const ACKS = ['Thanks for sharing that.', 'Got it, thank you.', 'That is helpful context.', 'Okay, understood.'];
function fallbackTurn(s, answer, next) {
  const { score, star, words, starCount } = heuristic(answer);
  const missing = !star.result ? 'what the outcome was, ideally with a number' : !star.action ? 'what you personally did' : 'why you chose that approach over the alternatives';
  return {
    score, star, note: `Heuristic: ${words} words, STAR ${starCount}/4.`,
    recommendedAction: score <= 3 && s.followUps === 0 ? 'probe' : 'advance',
    probeReply: score <= 2 ? `Let's make that more concrete. Can you pick one specific example and tell me ${missing}?` : `Could you go a bit deeper and tell me ${missing}?`,
    advanceReply: next ? `${ACKS[s.turns.length % ACKS.length]} ${next.text}` : '',
  };
}

// ---------- PII Redaction (Privacy Safeguard) ----------
export function redactPII(text, candidateName) {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  // 1. URLs (http/https and www)
  out = out.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[REDACTED]');
  // 2. Email addresses
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]');
  // 3. Phone numbers (international, parenthesis, dashes, spaces)
  out = out.replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}\b/g, '[REDACTED]');
  // 4. Candidate name occurrences
  if (candidateName && typeof candidateName === 'string') {
    const trimmed = candidateName.trim();
    if (trimmed && trimmed.toLowerCase() !== 'candidate') {
      const parts = [trimmed, ...trimmed.split(/\s+/)].filter(p => p.length >= 2);
      parts.sort((a, b) => b.length - a.length);
      for (const p of parts) {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[REDACTED]');
      }
    }
  }
  return out;
}

// ---------- Prompts ----------
const START_SYS = 'You are an expert recruiter and structured-interview designer. You design fair, job-relevant, behaviourally anchored interviews. Respond with a single JSON object only.';

const startPrompt = (s, n) => `TARGET ROLE: ${s.role}
JOB DESCRIPTION:
${s.jobDescription || '(none provided — infer typical requirements for the role)'}
CANDIDATE NAME: ${s.candidateName}
RESUME:
${redactPII(s.resumeText, s.candidateName) || '(none provided)'}

Produce:
1. "profile": {"summary": 2 sentences, "seniority": "junior"|"mid"|"senior"|"lead", "yearsExperience": number|null, "skills": ≤10 role-relevant skills from the resume, "highlights": ≤4 notable achievements, "probeAreas": ≤4 gaps or claims vs the JD worth verifying}
2. "competencies": exactly 4 role-critical competencies from the JD: {"name": ≤4 words, "weight": 0-1 (sum 1), "description": one sentence of what "good" looks like}. At least one technical/domain and one behavioural.
3. "questions": exactly ${n}, ordered warm-up → hardest: {"competency": one of the names, "text": spoken, ≤35 words, ONE question, referencing a specific resume item where possible, "difficulty": 1-5, "rationale": ≤15 words}. Mix behavioural (STAR) and situational/technical. Never ask about age, family, religion, nationality, health or any protected characteristic.
4. "opening": spoken greeting as "Ava", the AI interviewer: greet ${first(s.candidateName)} by first name, one sentence on format (about ${n} questions plus follow-ups, speak naturally, take your time), then ask questions[0] verbatim. ≤70 words, no markdown.`;

const turnSystem = s => `You are Ava, a warm, sharp, professional interviewer for the role of ${s.role}. You run a structured but conversational interview. Your replies are spoken aloud: no markdown, lists or emojis. Never reveal scores, never lecture or give away answers. Each reply is under 55 words: at most one short, varied acknowledgement (don't overpraise), then exactly one question. Respond with a single JSON object only.`;

const recent = (s, k) => s.turns.slice(-k).map(t => `${t.role === 'ai' ? 'Ava' : 'Candidate'}: ${t.text}`).join('\n');
const bars = Object.entries(BARS).map(([k, v]) => `${k} = ${v}`).join('\n');

const turnPrompt = (s, q, comp, next, answer) => `Competency: ${comp.name} — ${comp.description}
Current question (difficulty ${s.difficulty}/5): "${q.text}"
Follow-ups already asked on this question: ${s.followUps} of ${LIMITS.MAX_FOLLOWUPS}
Resume areas worth verifying: ${(s.profile.probeAreas || []).join('; ') || 'none'}

Recent conversation:
${recent(s, 6)}

Next planned question: ${next ? `"${next.text}" (competency ${next.competency})` : '(none — this is the final topic)'}

BARS rubric for scoring the latest answer on the current competency:
${bars}

Return JSON:
{"score": 1-5,
 "note": "≤20-word evidence-based rationale",
 "star": {"situation": bool, "task": bool, "action": bool, "result": bool},
 "recommendedAction": "probe" if the answer was vague, missing key STAR parts, made a claim worth verifying, or misunderstood the question; "advance" if the competency is adequately evidenced,
 "probeReply": follow-up on the SAME topic. If score ≥ 3: dig into the strongest or vaguest claim (how exactly, why that choice, trade-offs, metrics, what they'd change). If score ≤ 2: support them — rephrase more simply, narrow the scope, or ask for one concrete example,
 "advanceReply": brief bridge, then the next planned question adapted: harder if score ≥ 4, more approachable if score ≤ 2, personalised with details they mentioned. If there is no next question, a short thank-you}`;

const EVAL_SYS = 'You are a calibrated hiring panel applying a Behaviourally Anchored Rating Scale (BARS). Score ONLY on evidence in the candidate\'s own words. Ignore accent, grammar, filler words, speech-to-text errors, name, gender, age or any protected characteristic. If there is no evidence for a competency, score it 1 and say so. Respond with a single JSON object only.';

const evalPrompt = s => `ROLE: ${s.role}
JOB DESCRIPTION: ${s.jobDescription.slice(0, 2500) || '(none)'}
CANDIDATE PROFILE: ${s.profile.summary} Probe areas: ${(s.profile.probeAreas || []).join('; ') || 'none'}
COMPETENCIES (name — weight — what good looks like):
${s.competencies.map(c => `- ${c.name} — ${c.weight} — ${c.description}`).join('\n')}
BARS:
${bars}

TRANSCRIPT (bracketed live scores are preliminary):
${s.turns.map(t => t.role === 'ai'
    ? `[Q${t.qIndex + 1} · ${t.competency} · ${t.kind}] Ava: ${t.text}`
    : `Candidate${t.score ? ` [live ${t.score}/5]` : ''}: ${t.text}`).join('\n')}

Return JSON:
{"summary": "3-4 sentence executive summary for a recruiter",
 "competencies": [{"name": exact competency name, "score": integer 1-5, "rationale": "≤30 words citing the BARS level", "evidence": ["≤3 verbatim candidate quotes, each ≤20 words"]}],
 "strengths": ["≤4 specific strengths, each ≤18 words"],
 "gaps": ["≤4 specific gaps or risks, each ≤18 words"],
 "star": [{"question": "short paraphrase", "situation": bool, "task": bool, "action": bool, "result": bool, "note": "≤15 words"}] one per main question answered,
 "communication": {"clarity": 1-5, "structure": 1-5, "conciseness": 1-5, "note": "≤20 words"},
 "coaching": ["≤4 actionable tips for the candidate, each ≤20 words"],
 "nextSteps": ["≤3 focus areas for the next interview round"]}`;

// ---------- Normalisers: never trust LLM shape ----------
const strList = (v, n, max = 200) => (Array.isArray(v) ? v.map(x => str(x, max)).filter(Boolean).slice(0, n) : []);
const starOf = v => Object.fromEntries(['situation', 'task', 'action', 'result'].map(k => [k, !!v?.[k]]));

function normalizePlan(raw, s, n) {
  const competencies = (raw.competencies || []).slice(0, 5).map(c => ({ name: str(c.name, 40), weight: Math.max(0.05, Number(c.weight) || 0.25), description: str(c.description, 300) })).filter(c => c.name);
  if (competencies.length < 2) throw new Error('bad competencies');
  const total = competencies.reduce((a, c) => a + c.weight, 0);
  competencies.forEach(c => { c.weight = +(c.weight / total).toFixed(3); });
  const names = competencies.map(c => c.name);
  const questions = (raw.questions || []).slice(0, n).map(q => ({
    competency: names.find(x => x.toLowerCase() === str(q.competency, 60).toLowerCase()) || names[0],
    text: str(q.text, 400), difficulty: int15(q.difficulty, 3), rationale: str(q.rationale, 200),
  })).filter(q => q.text);
  if (questions.length < 2) throw new Error('bad questions');
  const p = raw.profile || {};
  return {
    profile: { summary: str(p.summary, 600), seniority: str(p.seniority, 20), yearsExperience: Number(p.yearsExperience) || null, skills: strList(p.skills, 10, 60), highlights: strList(p.highlights, 4), probeAreas: strList(p.probeAreas, 4) },
    competencies, questions,
    opening: str(raw.opening, 800) || `Hi ${first(s.candidateName)}, I'm Ava, your interviewer today. ${questions[0].text}`,
  };
}

function normalizeTurn(raw, next) {
  return {
    score: int15(raw.score, 3), note: str(raw.note, 200), star: starOf(raw.star),
    recommendedAction: raw.recommendedAction === 'probe' ? 'probe' : 'advance',
    probeReply: str(raw.probeReply, 600) || 'Could you walk me through a specific example of that — what you did and what happened as a result?',
    advanceReply: str(raw.advanceReply, 600) || next?.text || '',
  };
}

// ---------- Public API ----------
export async function startInterview(input = {}) {
  const n = clamp(parseInt(input.questionCount) || LIMITS.DEFAULT_QUESTIONS, 3, 8);
  const s = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'active',
    candidateName: str(input.candidateName, 100) || 'Candidate', role: str(input.role, 120),
    jobDescription: str(input.jobDescription, 6000), resumeText: str(input.resumeText, 12000),
    difficulty: 3, cursor: 0, followUps: 0, turns: [], engine: llmStatus(),
  };
  if (!s.role) throw httpError(400, 'role is required');
  let plan;
  try { plan = normalizePlan(await llmJSON(START_SYS, startPrompt(s, n), 'smart'), s, n); }
  catch { plan = fallbackPlan(s, n); s.engine = 'offline fallback'; }
  Object.assign(s, { profile: plan.profile, competencies: plan.competencies, plan: plan.questions, difficulty: plan.questions[0].difficulty });
  s.turns.push({ role: 'ai', text: plan.opening, t: Date.now(), kind: 'main', qIndex: 0, competency: s.plan[0].competency, difficulty: s.difficulty });
  return s;
}

export async function chatTurn(s, answerIn) {
  if (s.status !== 'active') throw httpError(409, 'interview already finished');
  const answer = str(answerIn, 4000);
  if (!answer) throw httpError(400, 'answer is required');
  const q = s.plan[s.cursor], next = s.plan[s.cursor + 1];
  const comp = s.competencies.find(c => c.name === q.competency) || s.competencies[0];
  const cand = { role: 'candidate', text: answer, t: Date.now(), qIndex: s.cursor, competency: q.competency };
  s.turns.push(cand);

  let r;
  try { r = normalizeTurn(await llmJSON(turnSystem(s), turnPrompt(s, q, comp, next, answer), 'fast'), next); }
  catch { r = fallbackTurn(s, answer, next); }
  Object.assign(cand, { score: r.score, note: r.note, star: r.star });

  const { action, difficulty } = nextStep(s, r.recommendedAction, r.score);
  s.difficulty = difficulty;
  let text;
  if (action === 'probe') { s.followUps++; text = r.probeReply; }
  else if (action === 'advance') { s.cursor++; s.followUps = 0; text = r.advanceReply; }
  else { s.status = 'completed'; text = `Thank you, ${first(s.candidateName)}. That's all the questions I have. Your feedback report will be ready in a moment. It was great speaking with you!`; }

  const cur = s.plan[s.cursor];
  s.turns.push({ role: 'ai', text, t: Date.now(), kind: action, qIndex: s.cursor, competency: cur.competency, difficulty });
  return { reply: text, done: action === 'wrap_up', progress: { question: s.cursor + 1, total: s.plan.length, competency: cur.competency, difficulty, action } };
}

const severity = (type, ms) =>
  type === 'MULTIPLE_FACES' ? 'high'
    : type === 'TAB_HIDDEN' ? (ms >= 10000 ? 'high' : 'warn')
      : type === 'WINDOW_BLUR' ? 'info'
        : ms >= 8000 ? 'high' : ms >= 4000 ? 'warn' : 'info';

export function computeIntegrity(input) {
  const totalMs = Math.max(1, Number(input?.totalMs) || 0);
  const num = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  const events = (Array.isArray(input?.events) ? input.events : []).slice(0, 2000)
    .filter(e => INTEGRITY_TYPES.includes(e?.type))
    .map(e => {
      const d = e.detail || {}, durationMs = num(e.durationMs);
      return {
        type: e.type, t: num(e.t), at: str(e.at, 40), durationMs, severity: severity(e.type, durationMs),
        detail: { reason: str(d.reason, 30) || undefined, yaw: Number.isFinite(d.yaw) ? Math.round(d.yaw) : undefined, pitch: Number.isFinite(d.pitch) ? Math.round(d.pitch) : undefined, count: Number.isFinite(d.count) ? d.count : undefined },
      };
    });
  const of = type => events.filter(e => e.type === type);
  const sum = type => of(type).reduce((a, e) => a + e.durationMs, 0);
  const stats = {
    totalMs, lookAwayMs: sum('LOOK_AWAY'), lookAwayCount: of('LOOK_AWAY').length, faceMissingMs: sum('FACE_MISSING'),
    multiFaceCount: of('MULTIPLE_FACES').length, tabHiddenCount: of('TAB_HIDDEN').length, tabHiddenMs: sum('TAB_HIDDEN'), blurCount: of('WINDOW_BLUR').length,
  };
  stats.onScreenPct = clamp(Math.round(100 * (1 - (stats.lookAwayMs + stats.faceMissingMs + stats.tabHiddenMs) / totalMs)), 0, 100);
  // ponytail: linear penalty weights, calibrate against labelled sessions before trusting thresholds
  const penalty = (100 * (stats.lookAwayMs + stats.faceMissingMs)) / totalMs + 15 * stats.multiFaceCount + 8 * stats.tabHiddenCount
    + stats.tabHiddenMs / 2000 + 2 * stats.blurCount + 3 * of('LOOK_AWAY').filter(e => e.durationMs >= 5000).length;
  const score = clamp(Math.round(100 - penalty), 0, 100);
  return { captured: !!input, visionAvailable: !!input && input.visionAvailable !== false, score, riskLevel: score >= 80 ? 'low' : score >= 55 ? 'medium' : 'high', stats, events };
}

export function overallScore(competencies, scored) {
  const w = competencies.reduce((a, c) => a + c.weight, 0);
  const mean = competencies.reduce((a, c) => a + c.weight * (scored.find(x => x.name === c.name)?.score || 1), 0) / w;
  return Math.round(((mean - 1) / 4) * 100);
}
export const recommend = score => (score >= 80 ? 'Strong Hire' : score >= 65 ? 'Hire' : score >= 50 ? 'Lean Hire' : 'No Hire');

function liveAvg(s, name) {
  const xs = s.turns.filter(t => t.role === 'candidate' && t.competency === name && t.score).map(t => t.score);
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 1;
}

function fallbackEval(s) {
  const answers = s.turns.filter(t => t.role === 'candidate');
  const competencies = s.competencies.map(c => {
    const own = answers.filter(a => a.competency === c.name);
    return { name: c.name, score: liveAvg(s, c.name), rationale: own.length ? `Average of live rubric scores across ${own.length} answer(s).` : 'No evidence collected for this competency.', evidence: own.slice(0, 2).map(a => a.text.split(/\s+/).slice(0, 20).join(' ')) };
  });
  const byQ = [...new Set(answers.map(a => a.qIndex))].map(qi => {
    const xs = answers.filter(a => a.qIndex === qi);
    const star = Object.fromEntries(['situation', 'task', 'action', 'result'].map(k => [k, xs.some(a => a.star?.[k])]));
    return { question: s.plan[qi].text.slice(0, 80), ...star, note: '' };
  });
  const words = answers.reduce((a, t) => a + t.text.split(/\s+/).length, 0) / Math.max(1, answers.length);
  const missingResult = byQ.filter(q => !q.result).length;
  return {
    summary: `${s.candidateName} answered ${answers.length} question(s) for ${s.role}. Scores are heuristic because no LLM provider was reachable; review the transcript before deciding.`,
    competencies,
    strengths: competencies.filter(c => c.score >= 4).map(c => `Solid evidence for ${c.name}.`),
    gaps: competencies.filter(c => c.score <= 2).map(c => `Limited evidence for ${c.name}.`),
    star: byQ,
    communication: { clarity: 3, structure: int15(1 + byQ.filter(q => q.action && q.result).length, 2), conciseness: words > 180 ? 2 : words < 20 ? 2 : 4, note: `Average answer length ${Math.round(words)} words.` },
    coaching: [missingResult && 'End each story with a measurable result.', 'Use Situation, Task, Action, Result to structure answers.', 'Say "I" for your own actions so your contribution is clear.'].filter(Boolean),
    nextSteps: competencies.filter(c => c.score <= 3).map(c => `Probe ${c.name} further.`).slice(0, 3),
  };
}

function normalizeEval(s, raw) {
  const got = Array.isArray(raw.competencies) ? raw.competencies : [];
  const competencies = s.competencies.map(c => {
    const m = got.find(x => str(x?.name, 60).toLowerCase() === c.name.toLowerCase());
    return m
      ? { name: c.name, score: int15(m.score, 1), rationale: str(m.rationale, 300), evidence: strList(m.evidence, 3, 200) }
      : { name: c.name, score: liveAvg(s, c.name), rationale: 'Panel returned no score; live rubric average used.', evidence: [] };
  });
  const cm = raw.communication || {};
  return {
    summary: str(raw.summary, 1200), competencies,
    strengths: strList(raw.strengths, 4), gaps: strList(raw.gaps, 4),
    star: (Array.isArray(raw.star) ? raw.star : []).slice(0, 10).map(x => ({ question: str(x.question, 120), ...starOf(x), note: str(x.note, 120) })),
    communication: { clarity: int15(cm.clarity, 3), structure: int15(cm.structure, 3), conciseness: int15(cm.conciseness, 3), note: str(cm.note, 200) },
    coaching: strList(raw.coaching, 4), nextSteps: strList(raw.nextSteps, 3),
  };
}

export async function evaluate(s, integrity) {
  if (integrity && !(Number(integrity.totalMs) > 0)) integrity = { ...integrity, totalMs: Date.now() - Date.parse(s.createdAt) };
  if (integrity || !s.integrity) s.integrity = computeIntegrity(integrity);
  const answered = s.turns.some(t => t.role === 'candidate');
  let ev, engine = llmStatus();
  if (!answered) { ev = fallbackEval(s); ev.summary = 'The interview ended before any answers were given.'; engine = 'n/a'; }
  else {
    try { ev = normalizeEval(s, await llmJSON(EVAL_SYS, evalPrompt(s), 'smart')); }
    catch { ev = fallbackEval(s); engine = 'offline fallback'; }
  }
  const score = overallScore(s.competencies, ev.competencies);
  s.report = { ...ev, overallScore: score, recommendation: recommend(score), engine, generatedAt: new Date().toISOString() };
  s.status = 'evaluated';
  return s.report;
}
