# Candor: AI Interview Platform (5-hour hackathon, 3 teammates)

## Context
Hackathon brief: build an AI interviewer with three pillars. (1) Questions and evaluation based on the resume and the job description. (2) A spoken interview that adapts as it goes. (3) Integrity monitoring (attention, tab switches) that recruiters can see. The budget is $0 (no credit cards) and the work must split cleanly across 3 people. The project folder `C:\Users\aryam\TIMEPASS PARTICIPATION` was empty, except for `engine.js`, which was written before the switch to plan mode (details below).

> **v2 (refined for a first-time team):** owners rebalanced (§3), MVP vs Stretch split (§3a), stub-first roadmap with checkpoints (§8), git workflow (§8a). Per-person instructions are in **`TEAM_TASKS.md`**.
>
> **v3 (unified master plan):** merges the teammate proposals from `Prathul` and `suryansh`. Adds the Evidence Dossier and device pre-flight check (§3a), a production roadmap (§2b), and a roadmap re-timed for **4.5 h** (§8). The §4 contracts are unchanged. What came from whom: §10. The original proposals are kept in `archive/teammate-proposals/`.

## 0. Tools & keys (everything is free, no credit card)
**Every teammate gets their own Groq key** (60 s): https://console.groq.com/keys → Create API Key → `copy .env.example .env` → paste it into `GROQ_API_KEY=`.
Why your own key: the free tier allows 8K tokens/min *per key*. If three people test on one key, requests hit 429 errors and the app quietly switches to offline mode, which makes prompt tuning look broken.
Optional fallback: **Gemini** at https://aistudio.google.com/apikey → `GEMINI_API_KEY=...` (one key for the team is enough).

| Need | What | Install? |
|---|---|---|
| Runtime | Node **≥ 22.9** (needed for `--env-file-if-exists`; Node 26 recommended) | nodejs.org |
| Code sharing | git + a free GitHub account | git-scm.com |
| Browser | **Chrome** (speech recognition). Edge is optional. Firefox/Safari only get typed input. | already installed |
| Editor | any (VS Code recommended) | optional |
| npm packages | **none**. `npm install` is not needed. | — |
| CDN libraries | `@mediapipe/tasks-vision@1.0.1` (face tracking); `pdfjs-dist@4.10.38` (PDF resume, stretch only) | loaded by the browser |
| Browser APIs | `webkitSpeechRecognition`, `speechSynthesis`, `getUserMedia`, Page Visibility | built in |

Commands: `npm test` (engine tests, no keys needed), `npm start`, then open http://localhost:3000.

⚠ The brief's model choices are out of date:
- **Llama 3.3 70B and Llama 3.1 8B left Groq's free tier on 16 Aug 2026.**
- **Gemini 1.5 Flash is retired.**

Models to use instead:
- Groq free tier: `openai/gpt-oss-20b` for live turns (fast) and `openai/gpt-oss-120b` for planning and evaluation. Both allow 30 requests/min, 1K requests/day, 8K tokens/min.
- Gemini fallback: `gemini-flash-lite-latest` through the OpenAI-compatible endpoint (about 500 requests/day on the free tier).
- Every model name can be overridden in `.env`.

## 0a. How we're judged (BitNBuild26, 50 points), ordered by weight
| Criterion | Pts | What earns it for us | Owner |
|---|---|---|---|
| **Functionality** | 14 | The MVP flow (setup → spoken interview → report) works on **every** run. The offline, no-camera and no-mic paths still finish. | All; T3 verifies |
| **Innovation** | 10 | Adaptive follow-ups made **visible**: a live "Follow-up / Next question" badge in the room + the adaptive path in the report. Integrity kept **out** of the hire score (fairness). An **Explainable Evidence Dossier** (3 indices) with an **advisory** hire recommendation computed by code, not the LLM; a human makes the final call. Face tracking on the candidate's device. Coaching tips for the candidate. | T1 (live badge), T2 (path, eval), T3 (integrity) |
| **Demonstration** | 8 | A rehearsed 3-min pitch mapped to these criteria (see TEAM_TASKS.md), run twice, plus a backup video. | All; T3 records |
| **Feasibility** | 7 | $0 per interview, no npm installs, runs on any laptop with Chrome, offline fallback. Say this out loud in the pitch. | T3 (README), presenter |
| **Scalability** | 6 | §2a: vision is client-side, the server is thin, provider/model swaps via `.env`, capacity numbers, a clear upgrade path. | T2 (facts), presenter |
| **Design** | 5 | One consistent dark theme; a room and report readable at a glance; a score ring + recommendation pill. | T1 (room), T2 (report) |

**Rule:** Functionality is 28% of the score. A reliable MVP beats any stretch feature.

## 1. Market research: the findings the design is built on
| Finding | Design decision |
|---|---|
| HireVue, Talview, Karat and HackerRank mostly use **static, one-way prompts**. Only Braintrust AIR, Fabric and Talently do real-time adaptive follow-ups. | Adaptive probing is our main differentiator. The follow-up decision is made explicit and shown to recruiters as an "Adaptive path". |
| HireVue only detects tab switches. Fabric uses 20+ signals. | Five on-device signals: look-away (head pose + eye blendshapes), face missing, multiple faces, tab hidden, window blur. |
| Proctoring research warns that attention cues are **not proof** and can cause false positives (disability, multiple monitors). | The integrity score is **decision-support only, never part of the hire score**. Short glances (<1.5 s) are not logged. A 2 s per-candidate calibration sets the baseline. The candidate sees the same HUD. |
| BARS + STAR is the standard for structured, low-bias scoring. | The LLM cites evidence against 1–5 BARS anchors. The **overall score and recommendation are computed by code** (weighted mean → Strong Hire / Hire / Lean Hire / No Hire), so the decision is the same for the same inputs. |
| The hard part of voice agents is latency and knowing when the speaker has finished (endpointing). | Browser Web Speech API with interim results. The turn ends after 2.5 s of silence (adjustable), and there is also a "Done ⏎" button and typed input. Recognition pauses while the AI speaks to avoid echo. gpt-oss-20b is set to `reasoning_effort: low`. |

Sources:
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq free-tier change](https://klymentiev.com/blog/groq-pricing)
- [Gemini free tier 2026](https://pecollective.com/tools/gemini-free-tier-guide/)
- [MediaPipe Face Landmarker web](https://developers.google.com/mediapipe/solutions/vision/face_landmarker/web_js)
- The earlier session's competitor and BARS research (claude-mem obs 1666–1671)

## 2. Stack (chosen so nothing can break during a build)
- **Server:** a Node 26 `node:http` server with **no npm dependencies**. It uses built-in `fetch` to call the OpenAI-compatible Groq and Gemini endpoints. Start it with `node --env-file-if-exists=.env server.js`. No install step, so nothing can fail at build time.
- **Frontend:** plain HTML, CSS and vanilla ES modules, with no build step. Libraries load from CDNs (versions checked, both return 200):
  - `@mediapipe/tasks-vision@1.0.1` (FaceLandmarker API unchanged) plus the model `face_landmarker/float16/1/face_landmarker.task`
  - `pdfjs-dist@4.10.38` to read resume PDFs in the browser
- **Speech:** `webkitSpeechRecognition` for speech-to-text and `speechSynthesis` for speaking, both free. Speech input needs Chrome or Edge; other browsers fall back to typing. Note: Chrome's speech-to-text sends audio to Google's servers.
- **Storage:** an in-memory Map, written to `data/sessions/<uuid>.json` after every change. It survives restarts and needs no database.
- **Fail-safe:** if every LLM provider fails, `engine.js` switches to heuristics: a question bank templated with the role and skills, STAR-keyword scoring, and averaged live scores. The demo never stops.

## 2a. Scalability & cost (the pitch facts; the numbers are estimates)
- **Vision costs the server nothing.** MediaPipe runs in the candidate's browser, and only small event lists (JSON) are uploaded. No video ever leaves the device.
- **The server is thin.** Each request is one LLM call plus a small JSON session write. To scale:
  1. move sessions from `data/sessions/*.json` to Redis/Postgres;
  2. run several copies of `server.js` behind a load balancer.

  No other changes are needed.
- **LLM calls per interview** ≈ 1 planning + 1 per answer + 1 grading, so ~8–14 calls for 5 questions.
- **Free-tier ceiling per Groq key:** 30 requests/min, 1K requests/day per model, 8K tokens/min.
  - That is ≈ 5 interviews at the same time.
  - It is ≈ 70 full interviews/day on the fast model.
  - The bottleneck is tokens/min: one turn ≈ 1.5K tokens.
- **Upgrade path with no code change:** a paid Groq key, or any OpenAI-compatible provider/model via the `.env` overrides. Next steps: a pool of keys + a request queue.
- **Works for any role:** competencies and questions are generated from the JD, so there is no hard-coded question bank per job.
- **Cost:** $0 at hackathon scale. Speech (browser), vision (browser) and hosting (a laptop) are all free.

## 2b. Production roadmap (pitch only, NOT built today)
Taken from Prathul's architecture proposal and Suryansh's core technical idea (`archive/teammate-proposals/`). **Say it in the pitch; do not build it.**
| Area | Next step at scale |
|---|---|
| Media | WebRTC media server + a message bus (Kafka / Pub/Sub) so ASR, vision and audio analysis scale independently |
| Services | Containerised orchestrator + report service on Kubernetes, sessions in Postgres/Redis, multi-region failover |
| Speech | Server-side Whisper with word-level timestamps → true pause, WPM and filler-word analysis |
| Relevance | Embeddings of JD requirements, resume claims and answers (cosine similarity), plus an NER "vagueness" penalty |
| Fairness | A stronger PII redactor + a nightly **name-swap bias audit** (the same transcript with a different name must score the same); human review of AI scores |
| Integrity | Speaker diarization (a second voice), screen-share OCR for unauthorised apps, time-aligned audio + gaze "attention anomalies" |
| Experience | A 2D/3D interviewer avatar, then a VR interview room |

## 3. File layout and owners (v3: rebalanced, one owner per file means no merge conflicts)
- **T1: Prathul (Candidate experience).** Everything the candidate sees and hears (Branch: `Prathul`).
- **T2: Aryaman (AI backend + report).** LLM engine, server, and the recruiter report (Branch: `feat/aryaman-dev`).
- **T3: Suryansh (Integrity + QA).** The computer-vision monitor, its report section, and end-to-end testing (Branch: `suryansh`).

```
package.json        ✅ DONE: start/test scripts, "type":"module", no dependencies
.env.example        ✅ DONE: GROQ_API_KEY, GEMINI_API_KEY, model overrides, PORT
.gitignore          ✅ DONE: .env, data/sessions/
TEAM_DIRECTIVES.md  ✅ DONE: cross-team CSS tokens, busy locks, dynamic MediaPipe import, transcript anchors
engine.js           ✅ UPDATED: 8s fast timeout, uncaptured integrity fix, totalMs fallback in evaluate (T2 - Aryaman)
engine.test.js      ✅ DONE: 10/10 node:test tests passing (T2 - Aryaman)
server.js           ✅ DONE: all 6 routes, static files, data/ auto-load seeds, busy lock, traversal guard (T2 - Aryaman)
server.test.js      ✅ DONE: 6/6 node:test contract tests passing (T2 - Aryaman)
data/mock-session.json  ✅ DONE: evaluated mock session seeded and verified (T2 - Aryaman)
public/styles.css   dark design tokens, shared components (T1 - Prathul)
public/index.html   setup page: name, role, JD, resume text, question count (3/5/7), consent, "Load sample" (T1 - Prathul)
public/room.html    interview room layout; must contain #cam, #overlay, #hud for the monitor (T1 - Prathul)
public/room.js      speech loop, TTS, live transcript, progress, finish → evaluate (T1 - Prathul)
public/integrity.js IntegrityMonitor class + renderIntegrity(el, integrity, turns) for the report (T3 - Suryansh)
public/report.html  ✅ SHELL READY: recruiter scorecard shell; renders into #app (T2 - Aryaman)
public/report.js    scorecard, BARS bars, STAR table, transcript; calls T3's renderIntegrity() (T2 - Aryaman)
README.md           run steps + demo script (T3 - Suryansh)
```

## 3a. MVP vs Stretch (MVP must work end-to-end by **H2:45**)
| | MVP (must have) | Stretch (only after MVP is green) |
|---|---|---|
| Setup | Pasted resume + JD text, "Load sample" button | PDF upload via pdf.js |
| Interview | Spoken Q&A (TTS + speech recognition) with typed fallback; adaptive probe/advance (already in engine); **live badge from `progress.action`** ("↻ Follow-up" / "→ Next question" / "✓ Wrap-up") + difficulty; **device pre-flight chips** after "Begin" (✓/✗ Camera, Mic, Speech supported); **static Ava avatar card** with status text | Mic visualizer, orb animation; **low-confidence re-ask** (a final result that is empty or has confidence < 0.5 → "Sorry, I didn't catch that. Could you repeat, or type it?", with no server call) |
| Integrity | Tab hidden, window blur, face missing, multiple faces, look-away using **fixed** yaw/pitch thresholds; HUD badges; on-screen % tile labelled **"Integrity confidence"** | 2 s calibration baseline, eye-blendshape gaze, gaze line on overlay; pause look-away while the face is missing (poor lighting); **"during answer" flag** on events inside a candidate-answer window |
| Report | **Evidence Dossier header** (Technical Relevancy = `overallScore`, Articulation & Delivery = communication mean mapped to 0–100, Integrity Confidence = `onScreenPct`) + recommendation labelled **"Advisory, a human makes the final call"**; competency bars + evidence quotes, strengths/gaps, STAR table, integrity stats + event table, **adaptive path** (Main/Probe/Wrap badge + difficulty + live score per AI turn), transcript | Radar SVG, timeline lanes, print styling; filler words per 100 words + rough WPM; click an integrity event → scroll to that transcript turn |
| Engine | Offline fallback (already in engine) | **PII redaction first** (regex strips email, phone, URLs and the candidate name from `resumeText` before prompts); fast-tier timeout 15 s → ~8 s |
| Resilience | Offline fallback, no-camera path, typed path | Edge browser testing |
| **Cut** | Resuming an interview after a page reload; a separate recruiter JD-entry portal; everything in §2b | |

## 4. Interface contracts (freeze these at H0:20)
> **Frozen.** The v3 synthesis added no fields. The Evidence Dossier, device chips and every stretch item are built only from the fields below.

**POST /api/start-interview**
- Request: `{candidateName, role*, jobDescription, resumeText, questionCount 3–8}`
- Response: the full Session:
```
{id, createdAt, status:"active"|"completed"|"evaluated", candidateName, role, jobDescription, resumeText, engine,
 profile:{summary, seniority, yearsExperience, skills[], highlights[], probeAreas[]},
 competencies:[{name, weight(sum 1), description}],            // 4 competencies from the JD
 plan:[{competency, text, difficulty 1-5, rationale}],
 difficulty, cursor, followUps,
 turns:[{role:"ai"|"candidate", text, t(epoch ms), qIndex, competency,
         kind?:"main"|"probe"|"advance"|"wrap_up", difficulty?, score?, note?, star?:{situation,task,action,result}}],
 integrity?: IntegrityReport, report?: Report}
```
The first AI turn is the spoken opening: a greeting followed by plan[0].

**POST /api/chat-turn**
- Request: `{sessionId, answer}`
- Response: `{reply, done, progress:{question, total, competency, difficulty, action:"probe"|"advance"|"wrap_up"}}`
- Returns 409 if the session is busy or finished, 400 if the answer is empty.

**POST /api/evaluate**
- Request: `{sessionId, integrity?: {totalMs, visionAvailable, events: IntegrityEvent[]}}`
- Response: the Session with `report` and `integrity` filled in.
```
Report = {summary, competencies:[{name, score 1-5, rationale, evidence[] verbatim quotes}], strengths[], gaps[],
          star:[{question, situation, task, action, result, note}], communication:{clarity, structure, conciseness, note},
          coaching[], nextSteps[], overallScore 0-100 (computed by code), recommendation (computed by code), engine, generatedAt}
```

**GET /api/sessions** returns a list: `[{id, candidateName, role, createdAt, status, overallScore, recommendation, integrityRisk}]`
**GET /api/session?id=** returns the full Session.
**GET /api/health** returns `{ok, llm:"groq → gemini"}`.

**IntegrityEvent** (shared by the vision engine and the report; one event per episode, logged when the episode ends):
```
{type:"LOOK_AWAY"|"FACE_MISSING"|"MULTIPLE_FACES"|"TAB_HIDDEN"|"WINDOW_BLUR",
 t: ms since monitor start, at: ISO time, durationMs, detail:{reason?, yaw?, pitch?, count?}}
```
- The server re-checks every event and assigns severity itself (the client's value is never trusted).
- **IntegrityReport** = `{captured, visionAvailable, score 0-100, riskLevel low|medium|high, stats:{totalMs, lookAwayMs, lookAwayCount, faceMissingMs, multiFaceCount, tabHiddenCount, tabHiddenMs, blurCount, onScreenPct}, events[]}`

## 5. Core logic (already in engine.js, reuse it)
- **Adaptive state machine:** `nextStep(s, proposedAction, score)`.
  - The LLM proposes `probe` or `advance` and writes **both** a `probeReply` and an `advanceReply` in one call, so there is only one round trip per turn.
  - The server has the final say:
    - at most 2 follow-ups per question;
    - after the last question it wraps up;
    - it wraps up after 16 answers in any case;
    - difficulty goes up 1 if the score is ≥ 4 and down 1 if it is ≤ 2 (range 1–5).
  - Strong answers get deeper probes (how, why, trade-offs, metrics). Weak answers get a simpler rephrase, a narrower scope, or a request for one concrete example.
- **Prompts:**
  - `startPrompt` produces the profile, 4 competencies, N questions (warm-up → hardest, based on the resume, no protected-attribute questions) and the opening.
  - `turnPrompt` and `evalPrompt` both follow the BARS anchors; the eval prompt uses verbatim evidence only and ignores accent and grammar.
- **Normalizers** (`normalizePlan/Turn/Eval`) never trust the shape of LLM output. `llmJSON` retries without JSON mode if it gets a 400, then tries the next provider.
- **`computeIntegrity`:** a linear penalty (look-away and face-missing percentages, ×15 per multi-face episode, ×8 per tab switch, plus hidden-tab time, blur, and long look-aways). Score ≥ 80 is low risk, ≥ 55 medium, otherwise high. Marked `ponytail:` for later calibration.

## 6. Browser engines (to build)
**integrity.js (T3):**
- `IntegrityMonitor(video, canvas, onChange)` with `.start(hasCamera)`, `.stop()` → `{totalMs, visionAvailable, events}`.
- FaceLandmarker runs at about 12 fps (GPU, falling back to CPU) with `numFaces: 2` and `outputFaceBlendshapes`.
- **Head pose is computed from landmarks**, which avoids ambiguity about matrix layout:
  - yaw uses the nose (1) position between the cheeks (234 and 454);
  - pitch uses the nose between forehead (10) and chin (152);
  - `asin` of the offset gives degrees. MVP measures from centre (0°); stretch measures from a **2 s calibration baseline**.
- Stretch: eye gaze from blendshapes (`eyeLookIn/Out/Down`).
- Also exports `renderIntegrity(el, integrity, turns)`, which report.js calls to draw the stats tiles and the event table (plus the timeline as stretch).
- Tunable settings in `CONFIG`: yaw 25°, pitch 20°, gaze 0.6, minimum look-away 1.5 s, minimum face-missing 1 s.
- Tab and window events: `visibilitychange` and `blur`/`focus`.
- Draws a face box plus a gaze line on a mirrored overlay.
- If MediaPipe fails to load, it falls back to tab/blur monitoring only and shows the badge "Vision unavailable".

**room.js (T1):**
- The "Begin" click provides the user gesture browsers require. It starts `getUserMedia` (video + audio), the monitor, the AnalyserNode bar visualizer, and speaks the opening.
- Loop: `say()` (TTS split by sentence, preferring Natural/Google voices, with a safety timeout) → `listen()` (continuous recognition with interim results; restarts in `onend`; 2.5 s silence timer that starts after speech) → `send()` → the reply comes back.
- The transcript shows interim text in italics. Typed input and Enter always work.
- End button → `finish()` → `/api/evaluate` with `monitor.stop()` → redirect to the report, with a retry button if it fails.
- After "Begin", shows pre-flight chips: Camera ✓/✗ (the `getUserMedia` video result), Mic ✓/✗ (the audio result), Speech ✓/✗ (`'webkitSpeechRecognition' in window`). ✗ on Speech → typed mode, announced up front.
- Sets `document.body.dataset.state` (speaking/listening/thinking), which drives the Ava card's status text (MVP) and the orb animation (stretch).

**report.js (T2; the integrity section comes from T3's `renderIntegrity`; radar and timeline are stretch):**
- Everything that came from the LLM or the candidate is escaped with `esc()`.
- **Evidence Dossier header (MVP):** three index tiles.
  - Technical Relevancy = `report.overallScore`.
  - Articulation & Delivery = `Math.round(((clarity+structure+conciseness)/3 - 1) / 4 * 100)` from `report.communication`.
  - Integrity Confidence = `integrity.stats.onScreenPct` (shows "n/a" if there is no integrity data).
  - Below them, the recommendation pill with the caption "Advisory, a human makes the final call".
- Radar chart as inline SVG (labels wrap onto 2 lines).
- The integrity timeline is made of HTML lanes (one per type, with severity colours).
- The audit log has a "During Qn · competency" column, mapped from `event.at` to the most recent AI turn.
- Includes the adaptive path (Main/Probe/Wrap badges, difficulty dots, live scores) and a collapsible transcript.

## 7. UI
- **Interview room**, split view:
  - Left card: mirrored video with face box and gaze line; HUD badges (Vision, Focus, Faces, Tab); four stat tiles (on-screen %, look-aways, tab switches, multi-face); live audit log; an "on-device" notice.
  - Right card: Ava persona orb with status; difficulty dots; mic visualizer; chat-style transcript; controls.
  - Top bar: role, "Q2/5 · competency" progress, timer, End button.
- **Recruiter dashboard:**
  - Header: name, role, duration, score ring (conic-gradient), Evidence Dossier tiles, advisory recommendation pill.
  - Radar next to BARS bars with evidence quotes.
  - Strengths and Gaps side by side.
  - Integrity section: risk pill, disclaimer, stats, timeline, audit log.
  - STAR table next to communication and coaching.
  - Adaptive path, transcript, Export PDF (`window.print`).

## 8. 4.5-hour roadmap (v3: stub-first, re-timed for the time left)
| Time | T1: Candidate experience | T2: AI backend + report | T3: Integrity + QA |
|---|---|---|---|
| 0:00–0:20 | **All:** keys + `.env`, clone repo, `npm test` smoke, read §4 contracts together | | |
| | `room.html` skeleton with `#cam #overlay #hud` | `data/mock-session.json` from an offline run | stub `integrity.js` (same API, tab/blur events only) |
| 0:20–1:20 | `index.html` form + "Load sample"; `say()` TTS | `server.js`: all 6 routes + persistence | MediaPipe load, face box on overlay, face-missing + multi-face |
| **1:20** | **Checkpoint 1** (everyone merges their branch into `main` first, §8a): setup page → server → room speaks the opening | | |
| 1:20–2:45 | `listen()` + silence endpointing, transcript, chat loop, live badge, device chips + Ava card, End → evaluate → redirect | `engine.test.js`; `report.js` MVP sections incl. Evidence Dossier + adaptive path (build against the mock) | look-away (fixed thresholds), episodes, HUD `onChange`, `renderIntegrity()` with the "Integrity confidence" tile |
| **2:45** | **Checkpoint 2, MVP freeze:** one full spoken interview → report with dossier + integrity section. Fix bugs before any stretch work. | | |
| 2:45–3:50 | stretch: low-confidence re-ask, visualizer, polish, aria-live | PII redaction, timeout 8 s, prompt tuning on 3 resumes, bad-key offline drill; then delivery metrics / event → transcript links | QA runs: no camera, denied mic, tab switch; README; stretch: "during answer" flag, calibration/gaze |
| **3:50** | **Checkpoint 3, code freeze.** Only bug fixes after this point. | | |
| 3:50–4:30 | **All:** run the 3-min pitch twice (strong candidate + "looks at phone, switches tab"), save one good session JSON in `data/` as a backup. **T3 records a 2-min backup demo video.** | | |

**Rescue rule:** stuck for more than 20 min → use the fallback listed in `TEAM_TASKS.md`, or cut the item to MVP and tell the team.

## 8a. Git workflow (matches `TEAM_ONBOARDING.md`)
- Repo: https://github.com/Aryaman-Saraf/TIMEPASS-PARTICIPATION.
- Each teammate works on **their own feature branch** (names are in TEAM_ONBOARDING.md). **Never commit directly to `main`.**
- Commit small and push your branch at least every 30 min.
- **Before each checkpoint** (1:20, 2:45, 3:50):
  1. open a PR from your branch into `main`;
  2. the repo owner merges it;
  3. everyone runs `git pull origin main` into their branch.
- One owner per file means these merges don't conflict. **Never edit a file you don't own.** Need a change? Ask the owner.
- Never commit `.env` (it is already in `.gitignore`).

## 9. Verification
1. `node --test`: the engine tests pass offline (no keys needed).
2. `npm start`, then `curl localhost:3000/api/health` should show `groq`.
3. Without keys: a full interview runs on the offline fallback and still produces a report.
4. In Chrome: "Load sample" → Start → speak 3 answers. Check that a vague answer triggers a probe, a strong answer raises the difficulty dots, and wrap-up redirects to the report.
5. Integrity: turn your head for 3 s, show a second face, switch tabs. Each should appear in the HUD, then in the audit log with its Q mapping, and in the timeline. The risk level should go up while the hire score stays the same.
6. Deny camera access: the interview still runs, and the report says vision was unavailable.
7. Ask whether to run `/code-review` before the demo (global rule: never run it automatically).

## Out of scope (named)
- Recruiter authentication and a separate candidate-only session view. The API currently returns the full plan to anyone.
- Semantic end-of-turn detection.
- HTTPS for LAN demos (use localhost, or a tunnel).
- Everything in §2b.

## 10. Synthesis changelog (v3: what came from whom)
The originals are in `archive/teammate-proposals/`. Every idea was filtered with three questions: can it be built in the time left, does it cost $0 with no installs, and does it earn rubric points?

**From Prathul** (`architecture_design.md`, `architecture_deep_dive.md`, `preadme.md`)
- Pre-flight checks → **MVP** device chips (T1).
- ASR confidence scorer → **Stretch** low-confidence re-ask (T1).
- PII redactor → **Stretch priority 1** regex redaction in `engine.js` (T2).
- Circuit breaker + fallback agent → already built (provider chain + offline heuristics). Timeout tightened to ~8 s (Stretch, T2).
- Text fallback chat → already MVP. Session recovery → stays Cut.
- Lighting validator → **Stretch** "pause look-away while the face is missing" (T3).
- WebRTC / Kafka / K8s / Vector DB / fine-tuning / bias audit / diarization / OCR / failover → **§2b roadmap** (pitch only).

**From Suryansh** (`CORE TECHNICAL IDEA.txt`, `bit&build_IDEA.txt`)
- Explainable Evidence Dossier (Technical Relevancy, Articulation & Delivery, Integrity Confidence) → **MVP** report header, built only from §4 fields.
- "Avoid a bare Accept/Reject" → the recommendation stays, computed by code, but is labelled **advisory**.
- Interviewer persona → **MVP** static Ava card; animation Stretch.
- Dual portal → pitch framing (candidate portal = setup + room, recruiter portal = report list + scorecard).
- Filler-word density / WPM → **Stretch** (T2).
- Temporal audio-visual sync → **Stretch** "during answer" flag on integrity events (T3).
- Timestamped evidence reel → **Stretch** event → transcript links (no video; video never leaves the device).
- Whisper timestamps, triple embeddings, NER penalty, VR → **§2b roadmap**.

**Changed from v2**
- Roadmap re-timed from 5 h to 4.5 h (CP1 1:20, MVP freeze 2:45, code freeze 3:50, pitch until 4:30).
- New MVP rows (dossier, device chips, Ava card, "Integrity confidence" label), each ≤ 15 min.
- §2b added. §4 is explicitly frozen and unchanged.
