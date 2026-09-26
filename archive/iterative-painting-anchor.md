# Candor: AI Interview Platform (5-hour hackathon, 3 teammates)

## Context
Hackathon brief: build an AI interviewer with three pillars. (1) Questions and evaluation based on the resume and the job description. (2) A spoken interview that adapts as it goes. (3) Integrity monitoring (attention, tab switches) that recruiters can see. The budget is $0 (no credit cards) and the work must split cleanly across 3 people. The project folder `C:\Users\aryam\TIMEPASS PARTICIPATION` was empty, except for `engine.js`, which was written before the switch to plan mode (details below).

## 0. Grab this key now (60 s)
**Groq, no card needed:** https://console.groq.com/keys → Create API Key → put `GROQ_API_KEY=...` in `.env`.
Optional fallback: **Gemini** at https://aistudio.google.com/apikey → `GEMINI_API_KEY=...`.

⚠ The brief's model choices are out of date:
- **Llama 3.3 70B and Llama 3.1 8B left Groq's free tier on 16 Aug 2026.**
- **Gemini 1.5 Flash is retired.**

Models to use instead:
- Groq free tier: `openai/gpt-oss-20b` for live turns (fast) and `openai/gpt-oss-120b` for planning and evaluation. Both allow 30 requests/min, 1K requests/day, 8K tokens/min.
- Gemini fallback: `gemini-flash-lite-latest` through the OpenAI-compatible endpoint (about 500 requests/day on the free tier).
- Every model name can be overridden in `.env`.

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

## 3. File layout and owners
```
package.json        start/test scripts, no dependencies                      (T3)
.env.example        GROQ_API_KEY, GEMINI_API_KEY, model overrides, PORT      (T3)
server.js           HTTP routes, static files, JSON persistence, per-session busy lock, 1 MB body limit, path-traversal guard (T3)
engine.js           ✅ ALREADY WRITTEN: LLM client, prompts, adaptive policy, BARS eval, integrity risk, offline fallback (T2)
engine.test.js      node:test tests: nextStep policy, computeIntegrity, overallScore/recommend, parseJSON, heuristic, full offline run (T2)
public/styles.css   dark design tokens, shared components (T1)
public/index.html   setup page: name, role, JD, resume upload (PDF via pdf.js), question count (3/5/7), consent, "Load sample" (T1)
public/room.html    interview room layout (T1)
public/room.js      speech loop, TTS, mic visualizer, live transcript, progress, finish → evaluate (T1)
public/integrity.js IntegrityMonitor class: MediaPipe loop, pose math, episodes, HUD data, export() (T3)
public/report.html  recruiter shell; no ?id = candidate list, with ?id = scorecard (T1)
public/report.js    scorecard, SVG radar, BARS bars, STAR table, integrity timeline + audit log, adaptive path, transcript, Print-to-PDF (T1)
README.md           this blueprint + run steps + demo script (T3)
```

## 4. Interface contracts (freeze these at H0:30)
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
  - `asin` of the offset from a **2 s calibration baseline** gives degrees.
- Eye gaze comes from blendshapes (`eyeLookIn/Out/Down`).
- Tunable settings in `CONFIG`: yaw 25°, pitch 20°, gaze 0.6, minimum look-away 1.5 s, minimum face-missing 1 s.
- Tab and window events: `visibilitychange` and `blur`/`focus`.
- Draws a face box plus a gaze line on a mirrored overlay.
- If MediaPipe fails to load, it falls back to tab/blur monitoring only and shows the badge "Vision unavailable".

**room.js (T1):**
- The "Begin" click provides the user gesture browsers require. It starts `getUserMedia` (video + audio), the monitor, the AnalyserNode bar visualizer, and speaks the opening.
- Loop: `say()` (TTS split by sentence, preferring Natural/Google voices, with a safety timeout) → `listen()` (continuous recognition with interim results; restarts in `onend`; 2.5 s silence timer that starts after speech) → `send()` → the reply comes back.
- The transcript shows interim text in italics. Typed input and Enter always work.
- Reloading mid-interview resumes by re-speaking the last AI turn.
- End button → `finish()` → `/api/evaluate` with `monitor.stop()` → redirect to the report, with a retry button if it fails.
- Sets `document.body.dataset.state` (speaking/listening/thinking) to drive the orb animation.

**report.js (T1):**
- Everything that came from the LLM or the candidate is escaped with `esc()`.
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
  - Header: name, role, duration, score ring (conic-gradient), recommendation pill.
  - Radar next to BARS bars with evidence quotes.
  - Strengths and Gaps side by side.
  - Integrity section: risk pill, disclaimer, stats, timeline, audit log.
  - STAR table next to communication and coaching.
  - Adaptive path, transcript, Export PDF (`window.print`).

## 8. 5-hour roadmap
| Time | T1: Frontend & Audio UX | T2: AI engine & eval | T3: Integrity, integration & QA |
|---|---|---|---|
| 0:00–0:30 | All three: get keys, freeze the contracts in §4, create repo skeleton and `styles.css` tokens | | |
| 0:30–1:30 | index.html + room.html layouts; TTS `say()` | engine.js (done): run tests, tune prompts against real Groq output | server.js routes + persistence + health; integrity.js MediaPipe load + pose math |
| 1:30–2:30 | speech loop + endpointing + visualizer + transcript | prompt iteration on 3 sample resumes; latency check (target < 1.5 s per turn) | episodes, calibration, HUD callbacks, overlay drawing |
| 2:30–3:30 | report.js scorecard, radar, STAR, path | evaluation quality: evidence quotes, BARS consistency across 2 re-runs | integrate the monitor into the room; export → evaluate; timeline + audit log in report |
| 3:30–4:15 | polish, accessibility (typed fallback, aria-live), mobile width | offline fallback drill (bad key) | full end-to-end runs in Chrome and Edge; test the no-camera and denied-mic paths |
| 4:15–5:00 | All three: freeze code, run the demo script twice (strong candidate + a "looks at phone, switches tab" run), keep a pre-recorded session JSON in `data/` as backup | | |

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
