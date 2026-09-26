# Candor: Team Tasks (who does what, and when)

This page tells each teammate what they own, what they build, and when it has to be ready.
- The design and the API contracts live in `IMPLEMENTATION_PLAN.md`: §4 has the contracts, §3a has the MVP vs Stretch split.
- If this page and the plan ever disagree, **the §4 contracts win**.
- **v3:** re-timed for the **4.5 h** we have left, with ideas from Prathul's and Suryansh's proposals merged in (plan §10). Items marked *(v3)* are new.

| | Teammate | Assigned Branch | Owns (only you edit these files) | Your part of the demo |
|---|---|---|---|---|
| **T1** | **Tanay** (Candidate & Recruiter Frontend) | `tanay` / `trial/integration` | `public/styles.css`, `public/index.html`, `public/room.html`, `public/room.js`, candidate/recruiter views | "The candidate journey & recruiter portal" |
| **T2** | **Aryaman** (AI backend + report) | `feat/aryaman-dev` | `engine.js`, `engine.test.js`, `server.js`, `data/mock-session.json`, `public/report.html`, `public/report.js` | "It asks smart follow-ups and writes a fair report" |
| **T3** | **Suryansh** (Integrity + QA) | `suryansh` | `public/integrity.js`, `README.md` | "It notices when I look away or switch tabs" |

## How we're judged (BitNBuild26, 50 points)
| Criterion | Pts | What it means for your work |
|---|---|---|
| Functionality | **14** | The MVP must work **every** run. That's why checkpoints and "If stuck" fallbacks exist. |
| Innovation | **10** | Make the adaptivity **visible**: T1's live Follow-up badge, T2's adaptive path. The **Evidence Dossier** with an *advisory* recommendation. Integrity stays out of the hire score. |
| Demonstration | **8** | A rehearsed 3-min pitch (bottom of this page) + a backup video. |
| Feasibility | **7** | $0, no installs, offline fallback. The presenter says it out loud. |
| Scalability | **6** | The facts are in `IMPLEMENTATION_PLAN.md` §2a. The presenter says them in 30 s. |
| Design | **5** | One clean, consistent theme across the room and the report. |

**Functionality is 28% of the score: a reliable MVP beats any stretch feature.** Full mapping: `IMPLEMENTATION_PLAN.md` §0a.

**Golden rules**
1. **Never edit a file you don't own.** Need something changed? Message the owner.
2. **Build MVP first.** Start stretch work only after Checkpoint 2 (H2:45) passes.
3. **Stuck for more than 20 min?** Use the "If stuck" fallback in your section, then tell the team.
4. **Work on your own branch** (`TEAM_ONBOARDING.md`); never commit to `main`. Push your branch at least every 30 min.

---

## H0:00–0:20: Everyone (setup)
- [ ] Install Node ≥ 22.9 (`node -v`), git, and Chrome.
- [ ] Get **your own** free Groq key at https://console.groq.com/keys (no credit card). Do not share one key: the free tier is 8K tokens/min per key.
- [ ] `git clone https://github.com/Aryaman-Saraf/TIMEPASS-PARTICIPATION.git`, then create **your branch** exactly as named in `TEAM_ONBOARDING.md`.
- [ ] `copy .env.example .env` and paste your key into `GROQ_API_KEY=`.
- [ ] Read §4 of `IMPLEMENTATION_PLAN.md` **together** (10 min). These are the promises between your code and your teammates' code.
- [ ] Ship your **stub** (see your section) and push it by 0:20, so the other two can build against it.

## Checkpoints (stop, merge, pull, test together, 10 min each)
Before each checkpoint:
1. Everyone opens a PR from their branch into `main`.
2. The repo owner merges the PRs.
3. Everyone runs `git pull origin main` into their branch.
4. Test together on the merged `main`.
| When | Must work | Status |
|---|---|---|
| **H1:20** | Setup page → Start → room page opens and **speaks the opening question**. | ✅ Completed |
| **H2:45 (MVP freeze)** | A full spoken interview → End → report shows scores, evidence, STAR and the **integrity section**. Fix any bug here before starting stretch work. | ✅ Completed |
| **H3:50 (code freeze)** | Bug fixes only. Run the demo script. | ✅ Completed |
| **H4:30 (Production)** | Live **Vercel Serverless** deployment, Supabase cloud sync, mandatory screen share, anti-cheating confinement, and 21/21 automated tests passing. | ✅ Operational |

---

## T1: Candidate experience — Prathul (Branch: `Prathul`)
**Mission:** a candidate fills in a form, then has a spoken conversation with "Ava" in the browser.

### 5-minute primer
- **STT (speech-to-text):** Chrome's `webkitSpeechRecognition` turns your voice into text. It is free and Chrome/Edge only. It sends the audio to Google's servers, which the consent checkbox should mention.
- **TTS (text-to-speech):** `speechSynthesis.speak(new SpeechSynthesisUtterance(text))` makes the browser talk. It is free and works everywhere.
- **Endpointing:** deciding when the candidate has *finished* answering. We use 2.5 s of silence after they last spoke, plus a "Done" button.
- **Echo:** if the mic is listening while Ava talks, Ava hears herself. **Always stop recognition before `say()` and restart it after.**

### Contract you use
- `POST /api/start-interview` `{candidateName, role, jobDescription, resumeText, questionCount}` → Session. Save `session.id` in `sessionStorage` and go to `room.html?id=<id>`.
- `GET /api/session?id=` → Session. The opening line is `session.turns[0].text`.
- `POST /api/chat-turn` `{sessionId, answer}` → `{reply, done, progress:{question,total,competency,difficulty,action}}`.
- `POST /api/evaluate` `{sessionId, integrity: monitor.stop()}` → then `location = 'report.html?id=' + id`.
- The monitor (from T3), used exactly like this:
  ```js
  import { IntegrityMonitor } from './integrity.js';
  const monitor = new IntegrityMonitor(videoEl, canvasEl, hud => renderHud(hud));
  await monitor.start(hasCamera);          // after getUserMedia succeeded (or failed → false)
  const integrity = monitor.stop();        // {totalMs, visionAvailable, events}
  ```
- `room.html` **must contain** `<video id="cam" autoplay muted playsinline>`, `<canvas id="overlay">` and `<div id="hud">`.

### Checklist
- [x] **0:00–0:20:** `room.html` skeleton with the three elements above, plus a transcript box, a typed-answer input, and Done / End buttons. Push it.
- [x] **0:20–1:20:** `styles.css` (dark theme, CSS variables). `index.html` form: name, role, JD textarea, resume textarea, question count 3/5/7, consent checkbox, and a **"Load sample"** button that fills in a realistic JD and resume.
- [x] **0:20–1:20:** `say(text)` returns a Promise that resolves on `onend`. Split the text into sentences; long utterances can get cut off in Chrome. Add a safety timeout of about 15 s per sentence in case `onend` never fires.
- [x] **1:20:** Checkpoint 1 (Completed).
- [x] **1:20–2:45:** `listen()`: `continuous = true`, `interimResults = true`. Show interim text in italics. Restart in `onend` while still listening. After the first final result, start a 2.5 s silence timer; when it fires → `send()`.
- [x] **1:20–2:45:** Loop: `say(reply)` → `listen()` → `send(answer)` → `say(reply)` … until `done`. Show "Q2/5 · competency" progress and a timer.
- [x] **1:20–2:45 (Innovation points, 15 min):** a live badge from `progress.action`: `probe` → "↻ Follow-up", `advance` → "→ Next question", `wrap_up` → "✓ Wrap-up". Show difficulty `progress.difficulty` as ●●●○○ next to it. This is how judges *see* the interview adapting.
- [x] **1:20–2:45:** "Begin" button (browsers need a click before the camera, mic and audio can start): `getUserMedia({video:true, audio:true})`, then `monitor.start(true)`. **If the camera is denied**, call `monitor.start(false)` and continue. **If the mic is denied**, typed input only.
- [x] **1:20–2:45 (v3, 10 min):** **device pre-flight chips** after Begin: Camera ✓/✗, Mic ✓/✗ (from the `getUserMedia` result), Speech ✓/✗ (`'webkitSpeechRecognition' in window`). If Speech is ✗, say "typed mode" up front.
- [x] **1:20–2:45 (v3, 10 min):** **static Ava card**: an avatar (emoji/SVG/initials) + a status line ("Speaking…", "Listening…", "Thinking…") driven by `document.body.dataset.state`.
- [x] **1:20–2:45:** End button or `done` → `finish()` → evaluate → redirect. If evaluate fails, show a Retry button.
- [x] **2:45:** Checkpoint 2 (Completed).
- [x] **2:45–3:50 (stretch):** first the **low-confidence re-ask** *(v3)*: if a final result's text is empty or `result[0].confidence < 0.5`, Ava says "Sorry, I didn't catch that. Could you repeat, or type it?" and listens again, with no server call. Then mic level bars (AnalyserNode), orb animation, `aria-live` on the transcript, a check at mobile width.
- [x] **Enterprise 6-Screen Architecture**: Stitch Gateway, Candidate Hub, Hardware Calibration, Live Spoken Room with mandatory screen share, Completion Confirmation, and Recruiter Pipeline.

### Definition of done (MVP)
A candidate can run a full interview by voice in Chrome. Typing + Enter always works as a backup. Denying camera or mic does not break anything.

### If stuck
- Speech recognition is flaky → keep the typed input + Done button as the main path and demo voice on the good runs.
- TTS never fires `onend` → the safety timeout resolves the Promise anyway.
- Server not ready → load `data/mock-session.json` to build the room UI.

---

## T2: AI backend + report — Aryaman (Branch: `feat/aryaman-dev`)
**Mission:** the server that runs the interview brain (already written in `engine.js`) and the recruiter report page.

### 5-minute primer
- **LLM (large language model):** we send a *prompt* (instructions + context) over HTTP and get text back. Groq hosts free open models; we use `openai/gpt-oss-20b` (fast, for live turns) and `gpt-oss-120b` (smarter, for planning and grading).
- **JSON mode:** we ask the model to reply with JSON so code can read it. Models sometimes return a broken shape, so `normalize*()` in engine.js never trusts it.
- **BARS:** a 1–5 scoring scale where each level has a written description (see `BARS` in engine.js). It makes grading consistent.
- **STAR:** Situation, Task, Action, Result, the structure of a good behavioural answer.
- **Why code, not the LLM, makes the hire decision:** the same scores always give the same recommendation (`overallScore` + `recommend`). That makes it fair and auditable.
- **Rate limits:** 30 requests/min and 8K tokens/min per key. A 429 error means you're over; the engine then tries Gemini, then the offline heuristics.

### Contract you provide
All of §4: `POST /api/start-interview`, `POST /api/chat-turn`, `POST /api/evaluate`, `GET /api/sessions`, `GET /api/session?id=`, `GET /api/health`.
Reuse the functions from `engine.js`; don't rewrite them:
```js
import { startInterview, chatTurn, evaluate, llmStatus, httpError } from './engine.js';
```

### Checklist
- [x] **0:00–0:20:** produce `data/mock-session.json` by running `startInterview` → a few `chatTurn`s → `evaluate` **with no key** (the offline fallback). Write the session to that file and push it.
- [x] **0:20–1:20:** `server.js` with `node:http` (no Express):
  - static files from `public/` (`/` → `index.html`), with a **path-traversal guard** (the resolved path must stay inside `public/`);
  - JSON body reader capped at **1 MB**;
  - a `Map` of sessions, written to `data/sessions/<id>.json` after every change and loaded at startup;
  - a **busy lock** per session (a `Set` of ids in flight → reply 409 if the id is already there);
  - errors → `res.statusCode = err.status || 500` with `{error: message}`.
  - `server.test.js` automated contract tests passing (6/6).
  - auto-loading demo seeds from `data/*.json`.
- [x] **0:20–1:20:** `TEAM_DIRECTIVES.md` documenting shared CSS tokens, busy locks, dynamic MediaPipe import, and transcript anchors.
- [ ] **1:20:** Checkpoint 1.
- [x] **1:20–2:45:** `engine.test.js` with `node:test` + `assert`:
  - `nextStep` never goes over 2 follow-ups and wraps up at the last question;
  - `computeIntegrity` gives 100 for no events and a lower score for a tab switch;
  - `recommend(80) === 'Strong Hire'`;
  - `parseJSON` handles code-fenced JSON;
  - `heuristic` scores a full STAR answer higher than "ok";
  - a full offline interview produces a report;
  - hardened 8s fast-tier timeout;
  - fixed edge-case bugs in `computeIntegrity` and `evaluate` totalMs fallback.
- [x] **1:20–2:45:** `report.html` shell ready (`public/report.html`). Report UI rendering logic (`public/report.js`) next:
  - with no `?id`, a table of sessions from `/api/sessions`;
  - with `?id`, the scorecard: header (name, role, score, recommendation pill), competency bars with rationale + evidence quotes, strengths/gaps, STAR table, communication, coaching, and a collapsible transcript;
  - call `renderIntegrity(document.getElementById('integrity'), s.integrity, s.turns)` from T3's `integrity.js`;
  - **escape everything** from the LLM or the candidate with `esc()` (replace `& < > " '`) before putting it in `innerHTML`.
- [x] **2:45:** Checkpoint 2 (Completed).
- [x] **1:20–2:45 (MVP, Innovation points):** an **adaptive path** section in the report.
  - One row per AI turn in `s.turns`: a badge from `kind` (main / probe / advance / wrap_up), difficulty dots, and the live `score` of the candidate answer that followed.
  - This is how judges see *why* the interview changed direction.
- [x] **1:20–2:45 (v3, MVP, 15 min): Evidence Dossier header** (from Suryansh's idea). Three tiles, built only from §4 fields:
  - **Technical Relevancy** = `report.overallScore`.
  - **Articulation & Delivery** = `Math.round(((c.clarity + c.structure + c.conciseness) / 3 - 1) / 4 * 100)` where `c = report.communication`.
  - **Integrity Confidence** = `integrity.stats.onScreenPct`, or "n/a" if there is no integrity data.
  - Under the tiles, the recommendation pill with the caption **"Advisory, a human makes the final call"**.
- [x] **2:45–3:50, in this order:**
  1. **PII redaction** *(v3, from Prathul)*: in `engine.js` and `resumeParser.js`, replace emails, phone numbers, URLs and every occurrence of `candidateName` in `resumeText` with `[REDACTED]`. Tested with automated test.
  2. Lower the fast-tier timeout in `llmJSON` from 15 s to ~8 s so a hung provider fails over quickly *(v3)*.
  3. Prompt tuning with a real key on 3 different sample resumes.
  4. The **offline drill**: set a wrong key, run a full interview, and confirm you still get a report.
- [x] **Universal Database Adapter (`db.js`) & Supabase Integration**: Cloud PostgreSQL sync with local filesystem fallback.
- [x] **Recruiter AI Candidate Rankings & Pipeline API**: Percentile calculations, score distribution, and department filtering.
- [x] **Vercel Serverless Integration (`api/index.js`, `vercel.json`)**: Live deployment on Vercel.
- [x] **Full 21/21 Automated Tests Passing**: All contract, engine, DB, auth, and pipeline tests pass cleanly.

### Definition of done (MVP & Production)
`npm test` passes (21/21 tests). `curl localhost:3000/api/health` shows `groq`. A full interview through the UI produces an Evidence Dossier. Live on Vercel.

---

## T3: Integrity + QA — Suryansh (Branch: `suryansh`)
**Mission:** watch the webcam and the browser tab **on the candidate's own device**, log attention events fairly, show them to the recruiter, and make sure the whole demo works.

### 5-minute primer
- **Face landmarks:** Google's MediaPipe FaceLandmarker finds 478 points on a face in each video frame. It runs in the browser (free, private, no server).
- **Head pose:** where the head points. *Yaw* = turning left/right, *pitch* = looking up/down. We estimate it from a few landmarks (nose vs cheeks, nose vs forehead/chin).
- **Episodes, not frames:** one look-away lasting 3 s is **one** event with `durationMs: 3000`, not 36 frame-level alerts. Short glances (< 1.5 s) are ignored.
- **False positives:** people look away to think, use two monitors, or have conditions that affect eye contact. That's why the integrity score is **shown to the recruiter as context, never used in the hire score**. The candidate sees the same HUD.

### Contract you provide
```js
export class IntegrityMonitor {
  constructor(video, canvas, onChange)  // onChange(hud) → {vision:'on'|'unavailable', focus:'ok'|'away', faces:n, tab:'visible'|'hidden', lastEvent}
  async start(hasCamera)                // begin tab/blur listeners; if hasCamera, load MediaPipe and loop
  stop()                                // → {totalMs, visionAvailable, events: IntegrityEvent[]}
}
export function renderIntegrity(el, integrity, turns)  // report section: risk pill, disclaimer, stats tiles, event table
```
- IntegrityEvent (§4): `{type, t, at, durationMs, detail:{reason?, yaw?, pitch?, count?}}`.
- Types: `LOOK_AWAY | FACE_MISSING | MULTIPLE_FACES | TAB_HIDDEN | WINDOW_BLUR`.
- The server recomputes severity and the score (`computeIntegrity` in engine.js), so don't compute them in the browser.

### Checklist
- [x] **0:00–0:20: stub** `integrity.js` with the exact API above.
  - It already logs `TAB_HIDDEN`, using `document.visibilitychange` (start the episode when hidden, end it and push the event when visible again).
  - It already logs `WINDOW_BLUR`, using `blur` / `focus` on `window`.
  - `start()` ignores the camera for now. Push it so T1 can integrate straight away.
- [x] **0:20–1:20:** load MediaPipe dynamically inside `start()` (GPU with CPU fallback).
  - Draw a box around face 0 on the overlay canvas (mirror it to match the mirrored video).
  - `FACE_MISSING`: no face for ≥ 1 s. `MULTIPLE_FACES`: 2+ faces for ≥ 1 s, with `detail.count`.
- [x] **1:20:** Checkpoint 1 (Completed).
- [x] **1:20–2:45:** look-away with **fixed thresholds**:
  - away if |yaw| > 25° or |pitch| > 20°, for ≥ 1.5 s → `LOOK_AWAY` with `detail:{yaw, pitch}`;
  - call `onChange(hud)` whenever a state changes.
- [x] **1:20–2:45:** `renderIntegrity(el, integrity, turns)`:
  - risk pill (low / medium / high) + score;
  - disclaimer: "Attention signals are context, not proof, and are not part of the hire score";
  - tiles: **"Integrity confidence"** (= on-screen %, *v3 label*), look-aways, tab switches, multi-face;
  - event table: time, type, duration, severity, and "during Qn";
  - if `!integrity.visionAvailable`, say "Camera not available: only tab/window events were monitored". Escape all text.
- [x] **2:45:** Checkpoint 2 (Completed).
- [x] **Mandatory Entire-Screen Share Proctoring**: Enforces entire display surface capture, rejecting single browser tabs or apps.
- [x] **Anti-Cheating Confinement & Auto-End**: Backgrounding the interview window or switching apps triggers instant warning signs and terminates the session.
- [x] **No Mic Mute Policy**: Prohibits microphone muting during live interview to ensure audio continuous proctoring.
- [x] **2:45–3:50: QA runs**:
  1. The full happy path by voice.
  2. Camera denied.
  3. Mic denied (typed only).
  4. Turn your head for 3 s, bring a second person into frame, switch tabs for 5 s. Check: HUD → report table → risk goes up, **hire score unchanged**.
  5. Bad Groq key (the offline fallback still gives a report).
- [x] **2:45–3:50:** `README.md` updated with comprehensive overview, setup, 6-screen journey, Vercel deployment, and scalability sections.
- [x] **4:00:** Rehearsed pitch and demo verified.

### Definition of done (MVP)
Every one of the 5 event types appears in the room HUD and in the report table from a real test. The no-camera path works.

### If stuck
- MediaPipe won't load → ship tab/blur + "Vision unavailable". That still covers the pillar.
- Pose math is noisy → raise the thresholds (35° / 30°) and the minimum duration (2 s). Fewer false alarms beat more alarms.

---

## H3:50–4:30: 3-minute pitch + demo (everyone)
Each step is tagged with the criterion it scores. One person presents and one drives the laptop.

| # | Time | Criterion | Say / do |
|---|---|---|---|
| 1 | 20 s | Demonstration | **Problem:** screening interviews are slow, inconsistent and unfair, remote cheating is invisible, and candidates get no feedback. Candor fixes all three. |
| 2 | 30 s | Functionality | "Load sample" → role "Backend Engineer" → Start. Point out that the first questions quote the **resume**. |
| 3 | 50 s | **Innovation** | Give a vague answer ("I worked on some APIs"): the badge shows **↻ Follow-up** and Ava probes. Give a strong STAR answer with a number: **→ Next question** and the difficulty dots go up. "Most platforms ask fixed questions; ours listens and adapts." |
| 4 | 20 s | Innovation | Look at your phone for 3 s, switch tabs once. The HUD reacts live. "All of this runs on the candidate's device; no video leaves the laptop." |
| 5 | 40 s | Functionality / Design | Recruiter portal: the **Evidence Dossier** (Technical Relevancy · Articulation & Delivery · Integrity Confidence) + the *advisory* recommendation, evidence quotes, STAR table, **adaptive path**, integrity events + the disclaimer "*context, not proof; not part of the hire score*". |
| 6 | 20 s | **Feasibility + Scalability** | "$0 per interview, no installs, works offline if the AI API goes down. Vision runs client-side, so the server stays thin. We swap to any OpenAI-compatible model with one `.env` line. Sessions move to Postgres to scale out. Works for any role because questions come from the JD. Next: WebRTC + a message bus, embeddings for relevance, a nightly name-swap bias audit (plan §2b)." |

**Backup plan:**
- Wi-Fi or Groq fails → the offline fallback still runs the whole interview.
- The laptop fails → play T3's backup video.
- There's always one good saved session in `data/sessions/` to open in the report.

**Likely judge questions, with 1-line answers:**
- *"What if the AI API fails?"* → Groq, then Gemini, then built-in heuristics; the interview never stops.
- *"Isn't gaze tracking unfair?"* → It is shown as context only, never scored. We ignore glances under 1.5 s, and the candidate sees the same HUD.
- *"Can the LLM be biased in the decision?"* → The LLM only cites evidence against a fixed 1–5 rubric. The hire recommendation is computed by code, so the same scores always give the same outcome.
- *"How does it scale?"* → Client-side vision, a thin server, provider swap via config, a DB for sessions. See §2a for the numbers and §2b for the production roadmap.
- *"Why not just Accept/Reject?"* → We give an explainable evidence dossier. The recommendation is advisory, computed by code from the rubric, and a human makes the final call.

Rehearse it **twice** before judging: once as a strong candidate, once as a "distracted" candidate. Time it and stay **under 3 min**.
