# Candor: Project Master Knowledge Index

## 1. System Overview & Core Objectives
**Candor** is an AI-powered, voice-first screening interview platform built for the BitNBuild26 hackathon. It operates with a **$0 budget** and **zero npm dependencies**, running natively in modern web browsers and Node.js (≥ 22.9).

### Three Core Pillars:
1. **Adaptive Interview Brain**: Dynamically tailors questions to candidate resume and job description. Listens to answers and adaptively probes for deeper STAR evidence (if vague) or increases difficulty (if strong).
2. **Real-Time Spoken Conversation**: Browser-native Speech-to-Text (`webkitSpeechRecognition`) and Text-to-Speech (`speechSynthesis`) providing an end-to-end spoken dialogue with "Ava".
3. **Fair, On-Device Integrity Monitoring**: Client-side face tracking (MediaPipe FaceLandmarker) and visibility listeners detecting look-aways, multiple faces, and tab switches. Attention metrics are strictly **advisory context** for recruiters and are never factored into the hiring score.

---

## 2. Team Split & File Ownership Matrix

| Teammate | Assigned Branch | Owned Files | Core Deliverable |
|---|---|---|---|
| **T1: Prathul** | `Prathul` | `public/styles.css`<br>`public/index.html`<br>`public/room.html`<br>`public/room.js` | Candidate experience: Setup form, interview room UI, Web Audio visualizer, and voice turn loop. |
| **T2: Aryaman** | `feat/aryaman-dev` | `server.js`<br>`server.test.js`<br>`engine.js`<br>`engine.test.js`<br>`data/mock-session.json`<br>`public/report.html`<br>`public/report.js` | AI backend & Recruiter Report: LLM engine, HTTP server, test suites, Evidence Dossier, adaptive path visualization. |
| **T3: Suryansh** | `suryansh` | `public/integrity.js`<br>`README.md` | Integrity & QA: MediaPipe face/gaze tracker, integrity audit table, end-to-end resilience testing, demo video. |

---

## 3. Repository File Catalog

| File Path | Component | Status | Description |
|---|---|---|---|
| [`server.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/server.js) | Backend | ✅ Active | Pure `node:http` server implementing all 6 §4 API routes, static file serving, 1 MB body cap, busy lock, path traversal security guard, and auto-loading data seeds. |
| [`server.test.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/server.test.js) | Testing | ✅ Active | 6 automated contract tests verifying health check, complete interview lifecycle, input errors, busy locks, static JS/HTML serving, and persistence. |
| [`engine.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/engine.js) | Backend / AI | ✅ Active | Core conversational engine: OpenAI-compatible LLM client (Groq → Gemini), adaptive state machine (`nextStep`), BARS rubric evaluation, PII redaction (`redactPII`), offline heuristic fallback, and 8s fast failover. |
| [`engine.test.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/engine.test.js) | Testing | ✅ Active | 11 automated unit tests verifying limits, BARS weighting, STAR heuristic parsing, PII redaction, offline full flow, and edge-case integrity handling. |
| [`data/mock-session.json`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/data/mock-session.json) | Data / Seeds | ✅ Active | Evaluated showcase session (Alex Chen, Senior Backend Engineer) with Evidence Dossier metrics (overallScore 89, onScreenPct 98%), adaptive turns, and BARS quotes. |
| [`TEAM_DIRECTIVES.md`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/TEAM_DIRECTIVES.md) | Coordination | ✅ Active | Shared interface guidelines: CSS color variables, 409 busy lock handling, dynamic MediaPipe import protocol, and transcript anchor links. |
| [`IMPLEMENTATION_PLAN.md`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/IMPLEMENTATION_PLAN.md) | Architecture | ✅ Active | Unified master specification, market research, rubric alignment (50 pts), §4 frozen API contracts, and roadmap checkpoints. |
| [`TEAM_TASKS.md`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/TEAM_TASKS.md) | Operations | ✅ Active | Task breakdown per teammate, timeboxes, definition of done, and demo scripts. |
| [`TEAM_ONBOARDING.md`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/TEAM_ONBOARDING.md) | Operations | ✅ Active | Git branch setup, free API key acquisition, and local run instructions. |
| [`public/index.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/index.html) | Candidate UI | ✅ Active | Candidate pre-flight setup: camera/mic selectors, live volume meter, candidate & role configuration, 1-click presets, and session initialization. |
| [`public/room.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/room.html) | Candidate UI | ✅ Active | Live interview room: mirrored webcam stream, real-time attention HUD, 3D voice orb, audio waveform visualizer, and dynamic action cards. |
| [`public/room.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/room.js) | Candidate UI / AI | ✅ Active | Live room controller: MediaPipe vision integration, STT/TTS voice turn engine, real-time adaptive §4 API calls, and final evaluation dispatch. |
| [`public/styles.css`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/styles.css) | Design System | ✅ Active | Unified enterprise design tokens, responsive layouts, audio wave styling, 3D orb animations, and recruiter dashboard themes. |
| [`public/integrity.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/integrity.js) | Vision / QA | ✅ Active | On-device MediaPipe FaceLandmarker: gaze deviation, head pose, liveness micro-movement, screen sharing, full-screen confinement, and Evidence Dossier renderer. |
| [`public/report.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/report.html) | Recruiter UI | ✅ Active | Recruiter report dashboard shell with dark tokens, responsive layout, print media styles, and module loader. |
| [`public/report.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/report.js) | Recruiter UI | ✅ Active | Recruiter dashboard: session catalog list, Evidence Dossier 3-tile header, BARS scorecard, adaptive path, STAR breakdown, coaching, transcript, and integrity audit. |
| [`docs/FRONTEND_BACKEND_INTEGRATION_SPEC.md`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/docs/FRONTEND_BACKEND_INTEGRATION_SPEC.md) | Architecture / UI | ✅ Active | Master integration specification: 6-screen flow (Auth ➔ Candidate Hub ➔ Pre-Device Check ➔ Live Room ➔ Completion ➔ Recruiter Portal), data hooks, and API contracts. |
| [`AGENTS.md`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/AGENTS.md) | Governance | ✅ Active | Workspace rules: unbiased delegation, file protection, commit protocol, clean Unicode formatting, and staging protocols. |

---

## 4. Frozen API Contract Specifications (§4)

### 4.1 `POST /api/start-interview`
- **Request**: `{ candidateId?: string, candidateName: string, role: string, jobDescription?: string, resumeText?: string, questionCount?: number }`
- **Response**: Full `Session` object with `id`, `createdAt`, `status: "active"`, `plan`, `competencies`, and initial AI opening turn.

### 4.2 `POST /api/chat-turn`
- **Request**: `{ sessionId: string, answer: string }`
- **Response**: `{ reply: string, done: boolean, progress: { question: number, total: number, competency: string, difficulty: number, action: "probe" | "advance" | "wrap_up" } }`
- **Error Codes**: `400` (missing answer), `404` (unknown session), `409` (session busy or already finished).

### 4.3 `POST /api/evaluate`
- **Request**: `{ sessionId: string, integrity?: { totalMs: number, visionAvailable: boolean, events: IntegrityEvent[] } }`
- **Response**: Full `Session` object with `status: "evaluated"`, `report` (BARS scores, evidence quotes, recommendation), and verified `integrity` report.

### 4.4 `GET /api/sessions`
- **Response**: Array of session summaries `[{ id, candidateName, role, createdAt, status, overallScore, recommendation, integrityRisk }]` sorted by creation date descending.

### 4.5 `GET /api/session?id=<id>`
- **Response**: Full `Session` object matching requested ID (`404` if not found).

### 4.6 `GET /api/health`
- **Response**: `{ ok: true, llm: string }` reporting active LLM provider chain (`groq → gemini` or `offline fallback`).

### 4.7 `GET /api/candidates`
- **Response**: Array of scheduled candidates in the recruiter pipeline `[{ id, name, email, role, department, status, questionCount, jobDescription, resumeText, createdAt }]`.

### 4.8 `POST /api/candidates`
- **Request**: `{ name: string, email?: string, role: string, department?: string, jobDescription?: string, resumeText?: string, questionCount?: number }`
- **Response**: Full created/updated candidate object with generated ID.

### 4.9 `DELETE /api/candidates?id=<id>`
- **Response**: `{ ok: boolean, id: string }`

### 4.10 `POST /api/candidate/resume`
- **Request**: `{ candidateId: string, resumeText: string }`
- **Response**: `{ ok: boolean, characterCount: number }`

---

## 5. Architectural Invariants & Key Decisions
1. **Deterministic Hire Recommendation**: The final hiring recommendation (`Strong Hire`, `Hire`, `Lean Hire`, `No Hire`) is computed strictly by code using weighted BARS averages, never left to LLM variance.
2. **Advisory Labeling**: All recommendations are explicitly marked *"Advisory, a human makes the final call"*.
3. **Integrity Independence**: Attention and integrity metrics (`onScreenPct`, look-aways, tab switches) are strictly separated from candidate technical evaluation and never penalize the hire score.
4. **Zero-Install Server**: Uses native Node.js `node:http`, `node:fs/promises`, and `node:test`. No `npm install` step is required.
5. **Fast Failover**: Fast-tier AI calls timeout at 8s, falling back to Gemini and then offline STAR heuristics to ensure the demo never hangs.
