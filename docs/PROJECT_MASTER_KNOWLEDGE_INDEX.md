# Candor: Project Master Knowledge Index

## 1. System Overview & Core Objectives
**Candor** is an enterprise-grade, voice-first screening interview platform built for the BitNBuild26 hackathon. It operates with a **$0 budget**, **zero npm build dependencies**, and runs natively across modern web browsers, Node.js (≥ 22.9), and **Vercel Serverless**.

### Four Core Pillars:
1. **Adaptive Interview Brain**: Dynamically tailors questions to the candidate's resume and job description. Listens to candidate responses and adaptively probes for deeper STAR evidence (if vague) or increases difficulty (+1/-1 clamped to 1–5 if strong).
2. **Real-Time Spoken Conversation**: Browser-native Speech-to-Text (`webkitSpeechRecognition`) and Text-to-Speech (`speechSynthesis`) providing an end-to-end spoken dialogue with "Ava" with zero third-party audio streaming latency or cost.
3. **Fair, On-Device Integrity & Anti-Cheating Monitoring**: Client-side face and gaze tracking via Google MediaPipe FaceLandmarker, mandatory entire-screen share verification, no mic mute policy during interview, and automated session termination on tab or application backgrounding. Attention metrics are strictly **advisory context** for recruiters and are never factored into the hiring score.
4. **Explainable Evidence Dossier & AI Candidate Rankings**: Code-computed weighted BARS scores, advisory recommendations (`Strong Hire`, `Hire`, `Lean Hire`, `No Hire`), exact transcript quote attribution, adaptive path trees, and recruiter pipeline rankings with percentiles.

---

## 2. Team Split & File Ownership Matrix

| Teammate | Assigned Role | Dedicated Branch | Owned Files | Core Deliverable |
|---|---|---|---|---|
| **T1: Tanay** | Frontend Lead | `trial/integration` / `tanay` / `frontendT` | `public/index.html`<br>`public/auth.html`<br>`public/candidate-dashboard.html`<br>`public/preflight.html`<br>`public/room.html`<br>`public/completion.html`<br>`public/recruiter-portal.html`<br>`public/styles.css` | 6-Screen enterprise journey: Dual portal authentication, Candidate Hub, pre-flight hardware calibration, live voice room, completion confirmation, and recruiter pipeline. |
| **T2: Aryaman** | AI Backend & Architecture Lead | `feat/aryaman-dev` | `server.js`<br>`server.test.js`<br>`engine.js`<br>`engine.test.js`<br>`db.js`<br>`auth.js`<br>`resumeParser.js`<br>`api/index.js`<br>`vercel.json`<br>`supabase/schema.sql`<br>`public/report.html`<br>`public/report.js` | AI conversational engine, pure Node.js HTTP server, 21 automated contract tests, Vercel serverless integration, Supabase cloud adapter, RBAC auth, resume parsing with PII redaction, and Evidence Dossier. |
| **T3: Suryansh** | Integrity & Proctoring Lead | `suryansh` | `public/integrity.js`<br>`README.md`<br>`public/test-integrity.html` | Client-side MediaPipe vision tracking, mandatory entire-screen share proctoring, anti-cheating confinement enforcement, tab switch audit logs, and QA verification. |

---

## 3. Comprehensive Repository File Catalog

| File Path | Component | Status | Description |
|---|---|---|---|
| [`server.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/server.js) | Backend | ✅ Active | Pure `node:http` server implementing all 15 API routes, static file serving, 1 MB body cap, busy lock, path traversal security guard, and serverless compatibility via `handleRequest`. |
| [`server.test.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/server.test.js) | Testing | ✅ Active | 10 automated server tests: health check, full interview lifecycle, error handling, busy locks, static serving, persistence, candidate CRUD, RBAC auth, resume upload, and recruiter rankings. |
| [`engine.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/engine.js) | AI Engine | ✅ Active | Core conversational engine: OpenAI-compatible LLM client (Groq → Gemini), adaptive state machine (`nextStep`), BARS rubric evaluation, PII redaction (`redactPII`), offline STAR heuristic fallback, and 8s fast failover. |
| [`engine.test.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/engine.test.js) | Testing | ✅ Active | 11 automated unit tests verifying limits, BARS weighting, STAR heuristic parsing, PII redaction, offline full flow, and edge-case integrity handling. |
| [`db.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/db.js) | Database | ✅ Active | Universal Database Adapter supporting Supabase Cloud PostgreSQL REST API with transparent local filesystem fallback (`data/candidates.json`, `data/sessions/`), in-memory caching, and automatic seeding. |
| [`auth.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/auth.js) | Security | ✅ Active | Role-Based Access Control (RBAC) authentication module generating and verifying candidate and recruiter bearer tokens. |
| [`resumeParser.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/resumeParser.js) | Engine | ✅ Active | Automated resume text extraction and PII redaction engine (sanitizing emails, phone numbers, URLs, and applicant names). |
| [`api/index.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/api/index.js) | Serverless | ✅ Active | Vercel Serverless Function entrypoint proxying `/api/*` requests to `server.handleRequest` with lazy DB initialization. |
| [`vercel.json`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/vercel.json) | Deploy | ✅ Active | Vercel deployment configuration designating `public` as the static output directory and rewriting `/api/(.*)` to `api/index.js`. |
| [`.vercelignore`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/.vercelignore) | Deploy | ✅ Active | Deployment exclusion list optimizing serverless bundle size by ignoring docs, archives, local session dumps, and markdown files. |
| [`supabase/schema.sql`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/supabase/schema.sql) | Database | ✅ Active | PostgreSQL DDL table definitions (`candidates`, `sessions`, `users`) with Row Level Security (RLS) policies and indexes for Supabase Cloud. |
| [`public/index.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/index.html) | Frontend | ✅ Active | Screen 1: Stitch Enterprise Interview Gateway with live health telemetry, 1-click candidate demo profiles, and recruiter portal sign-in. |
| [`public/auth.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/auth.html) | Frontend | ✅ Active | Screen 1: Authentication portal and role selection interface. |
| [`public/auth.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/auth.js) | Frontend | ✅ Active | Authentication controller managing candidate profiles, recruiter login, and navigation state. |
| [`public/candidate-dashboard.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/candidate-dashboard.html) | Frontend | ✅ Active | Screen 2: Candidate Hub with role card, queue badge, resume intake drag-and-drop, and PII privacy shield banner. |
| [`public/candidate-dashboard.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/candidate-dashboard.js) | Frontend | ✅ Active | Candidate dashboard controller reading resume text/files and syncing candidate profile state. |
| [`public/preflight.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/preflight.html) | Frontend | ✅ Active | Screen 3: Pre-Device Hardware Calibration interface with camera preview, mic level meter, and speech detector. |
| [`public/preflight.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/preflight.js) | Frontend | ✅ Active | Preflight controller checking Web Audio volume levels, camera enumeration, speaker chime test, and starting the interview. |
| [`public/room.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/room.html) | Frontend | ✅ Active | Screen 4: Live Spoken Interview Room with split viewport: candidate camera, attention HUD, 3D AI voice orb, and waveform visualizer. |
| [`public/room.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/room.js) | Frontend | ✅ Active | Live room controller: MediaPipe integration, mandatory entire-screen share enforcement, anti-cheating confinement, and Web Speech loop. |
| [`public/integrity.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/integrity.js) | Vision / QA | ✅ Active | Client-side MediaPipe FaceLandmarker: head pose yaw/pitch, gaze deviation, multi-face detection, screen share verification, and Evidence Dossier rendering. |
| [`public/completion.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/completion.html) | Frontend | ✅ Active | Screen 5: Post-Interview Completion Screen with status confirmation badge and navigation back to gateway. |
| [`public/completion.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/completion.js) | Frontend | ✅ Active | Completion screen controller managing post-interview state. |
| [`public/recruiter-portal.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/recruiter-portal.html) | Frontend | ✅ Active | Screen 6: Recruiter Pipeline & AI Rankings Leaderboard displaying candidate roster, percentiles, hire distributions, and candidate detail modals. |
| [`public/recruiter-portal.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/recruiter-portal.js) | Frontend | ✅ Active | Recruiter dashboard controller fetching rankings (`/api/recruiter/rankings`), filtering by department, and rendering pipeline metrics. |
| [`public/report.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/report.html) | Frontend | ✅ Active | Screen 6: Evidence Dossier Scorecard view for in-depth candidate evaluation analysis. |
| [`public/report.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/report.js) | Frontend | ✅ Active | Evidence Dossier controller: 3 quantitative indices, BARS scorecards, quote attribution, adaptive path tree, and timestamped integrity audit log. |
| [`public/styles.css`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/styles.css) | Design System | ✅ Active | Enterprise dark theme design tokens, glassmorphism card layouts, 3D orb animations, audio waves, and responsive styles. |
| [`public/test-integrity.html`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/test-integrity.html) | Testing / QA | ✅ Active | Standalone visual verification suite for testing MediaPipe face landmarks, head yaw/pitch, and gaze tracking. |
| [`data/candidates.json`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/data/candidates.json) | Data / Seeds | ✅ Active | Candidate pipeline roster containing preset profiles (Sarah Jenkins, Alex Chen, Jordan Lee) and persistent applicant records. |
| [`data/mock-session.json`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/data/mock-session.json) | Data / Seeds | ✅ Active | Evaluated showcase session (Alex Chen, Senior Backend Engineer) with Evidence Dossier metrics (overallScore 89, onScreenPct 98%). |
| [`docs/briefs/`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/docs/briefs) | Docs / Specs | ✅ Active | Hackathon briefs and templates: `BitNBuild26_Grading_Sheet.pdf`, `Problem_Statements_For BNB.pdf`, and `BNB-IDEA-Presentation-Format.pdf`. |
| [`archive/frontend-drafts/`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/archive/frontend-drafts) | Archive | 📦 Archived | Archived intermediate frontend development workspace preserved per zero-deletion rule. |

---

## 4. Frozen API Contract Specifications (§4)

### 4.1 `GET /api/health`
- **Purpose**: Infrastructure health probe and active LLM provider check.
- **Response**: `{ ok: true, llm: "groq (openai/gpt-oss-20b) -> gemini (gemini-flash-lite-latest) -> offline fallback" }`

### 4.2 `POST /api/auth/login`
- **Purpose**: Authenticate candidate or recruiter user and issue bearer session token.
- **Request**: `{ username: string, role?: "candidate" | "recruiter" }`
- **Response**: `{ ok: true, token: string, user: { username: string, role: string } }`

### 4.3 `GET /api/auth/me`
- **Purpose**: Inspect the currently authenticated session from `Authorization: Bearer <token>` header.
- **Response**: `{ ok: true, user: { username: string, role: string } }`
- **Error Codes**: `401 Unauthorized` if token is missing or invalid.

### 4.4 `POST /api/auth/logout`
- **Purpose**: Invalidate current bearer token session.
- **Response**: `{ ok: true }`

### 4.5 `POST /api/start-interview`
- **Purpose**: Initialize an interview session and generate customized opening turn based on candidate profile.
- **Request**: `{ candidateId?: string, candidateName: string, role: string, jobDescription?: string, resumeText?: string, questionCount?: number }`
- **Response**: Full `Session` object with `id`, `createdAt`, `status: "active"`, `plan`, `competencies`, and initial AI opening turn.

### 4.6 `POST /api/chat-turn`
- **Purpose**: Submit candidate spoken or typed answer and receive the adaptive AI follow-up or next question.
- **Request**: `{ sessionId: string, answer: string }`
- **Response**: `{ reply: string, done: boolean, progress: { question: number, total: number, competency: string, difficulty: number, action: "probe" | "advance" | "wrap_up" } }`
- **Error Codes**: `400` (missing answer), `404` (unknown session), `409` (session busy with an in-flight request or already finished).

### 4.7 `POST /api/evaluate`
- **Purpose**: Finalize interview, compute objective BARS rubric scores, compile Evidence Dossier, and audit integrity log.
- **Request**: `{ sessionId: string, integrity?: { totalMs: number, visionAvailable: boolean, events: IntegrityEvent[] } }`
- **Response**: Full `Session` object with `status: "evaluated"`, `report` (BARS scores, evidence quotes, recommendation), and verified `integrity` report.

### 4.8 `GET /api/sessions`
- **Purpose**: Retrieve summary roster of all evaluated and active interview sessions.
- **Response**: Array of session summaries `[{ id, candidateName, role, createdAt, status, overallScore, recommendation, integrityRisk }]` sorted by creation date descending.

### 4.9 `GET /api/session?id=<id>`
- **Purpose**: Retrieve full session state and detailed evaluation report for a given session ID.
- **Response**: Full `Session` object matching requested ID (`404` if not found).

### 4.10 `GET /api/candidates`
- **Purpose**: Retrieve scheduled candidate pipeline roster.
- **Response**: Array of candidate objects `[{ id, name, email, role, department, status, questionCount, jobDescription, resumeText, createdAt }]`.

### 4.11 `POST /api/candidates`
- **Purpose**: Schedule new candidate or update candidate profile.
- **Request**: `{ name: string, email?: string, role: string, department?: string, jobDescription?: string, resumeText?: string, questionCount?: number }`
- **Response**: Full created or updated candidate object with generated ID.

### 4.12 `DELETE /api/candidates?id=<id>`
- **Purpose**: Remove a candidate from the scheduled pipeline.
- **Response**: `{ ok: boolean, id: string }`

### 4.13 `POST /api/candidate/resume`
- **Purpose**: Directly update a candidate's resume text.
- **Request**: `{ candidateId: string, resumeText: string }`
- **Response**: `{ ok: true, characterCount: number }`

### 4.14 `POST /api/candidate/resume-upload`
- **Purpose**: Ingest uploaded resume document (plain text or base64 PDF), extract text, and redact sensitive PII.
- **Request**: `{ candidateId: string, text?: string, base64?: string, filename?: string }`
- **Response**: `{ ok: true, candidateId: string, wordCount: number, characterCount: number, preview: string, redactedSample: string }`

### 4.15 `GET /api/recruiter/rankings`
- **Purpose**: Retrieve sorted AI Candidate Ranking Leaderboard with calculated percentiles, score distributions, and department filters.
- **Query Parameters**: Optional `?role=<roleFilter>` (or `'all'`).
- **Response**: `{ totalEvaluated: number, averageScore: number, stats: { strongHire: number, hire: number, leanHire: number, noHire: number }, rankings: [{ rank: number, percentile: number, sessionId: string, candidateName: string, role: string, createdAt: string, overallScore: number, recommendation: string, integrityRisk: string }] }`

---

## 5. Architectural Invariants & Key Decisions

1. **Deterministic Hire Recommendation**: The final hiring recommendation (`Strong Hire`, `Hire`, `Lean Hire`, `No Hire`) is computed strictly by deterministic code using weighted BARS averages, never left to LLM variance.
2. **Advisory Labeling**: All recommendations are explicitly marked *"Advisory, a human makes the final call"* to maintain human-in-the-loop ethical compliance.
3. **Integrity Independence**: Attention and integrity metrics (`onScreenPct`, look-aways, tab switches) are strictly separated from candidate technical evaluation and **never** penalize the hire score.
4. **Mandatory Screen Share & Confinement**: To prevent unauthorized assistance, candidates must share their entire screen (individual browser tabs are rejected), microphone muting is prohibited during the interview, and switching windows or tabs triggers confinement warnings and terminates the session.
5. **Universal Database Persistence with Local Fallback**: Seamlessly queries and writes to Supabase Cloud PostgreSQL REST API when credentials are present, and transparently falls back to local JSON file persistence in `data/` when running offline or without credentials.
6. **Zero-Install Server & Serverless Native**: Backend functions require zero npm dependencies, running both as a persistent `node:http` server locally and as serverless functions on Vercel via `api/index.js`.
7. **Fast Failover & High Availability**: AI calls enforce an 8-second fast timeout, falling back from Groq to Gemini and ultimately to offline STAR heuristics so the interview never stalls.

---

## 6. Verification & Test Coverage Matrix

All 21 automated tests pass cleanly (`npm test`):

```
✔ nextStep: at most MAX_FOLLOWUPS probes, wraps at the last question and at MAX_ANSWERS
✔ nextStep: difficulty +1 on score ≥ 4, −1 on score ≤ 2, clamped to 1–5
✔ computeIntegrity: clean run is 100/low; a tab switch lowers it; unknown types and client severity ignored
✔ computeIntegrity: no payload means not captured and no vision
✔ overallScore is the weighted BARS mean on 0–100; recommend thresholds
✔ parseJSON: code fences and surrounding prose
✔ heuristic: a full STAR answer outscores "ok"
✔ full offline interview: completes, evaluates, and integrity never changes the hire score
✔ evaluate: integrity without totalMs uses the session length, not a false high risk
✔ input guards: role required (400), empty answer (400), finished interview (409)
✔ redactPII: removes emails, phones, URLs and candidate names from resume text
✔ GET /api/health reports the LLM chain
✔ full offline interview over HTTP: start → chat until done → evaluate → listed
✔ errors: 400 bad input, 404 unknown session/route, 413 oversized body
✔ busy lock: 409 while in flight, released after success and after errors
✔ static: serves public/ files, blocks encoded traversal, 404s missing files
✔ persistence: sessions written to DATA_DIR, reloaded on load(), bad files skipped, demo seed present
✔ candidate pipeline: list, add, update resume, delete
✔ auth & RBAC: recruiter login, candidate login, profile check, and logout
✔ resume upload engine: extracts text, redacts PII, and updates candidate
✔ recruiter AI rankings: calculates rank, percentile, and hire distribution
```
