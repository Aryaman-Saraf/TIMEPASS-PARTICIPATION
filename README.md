# Candor: AI-Powered Interview Platform 🎙️👁️

> An intelligent, conversational AI interview platform that conducts adaptive, human-like voice interviews, evaluates performance fairly against standardized BARS/STAR rubrics, and provides transparent attention & integrity monitoring for recruiters.

Built for our 5-hour hackathon with **$0 budget**, **zero npm build dependencies**, and **100% free-tier AI APIs**.

---

## 🌟 Core Pillars

1. **Profile-Aware Questioning & Evaluation**:
   - Ingests candidate resume and target role context to generate customized, role-specific questions.
   - Evaluates performance objectively against **BARS** (Behaviorally Anchored Rating Scales 1–5) and **STAR** criteria.
   - Produces an **Explainable Evidence Dossier**: Technical Relevancy, Articulation & Delivery and Integrity Confidence indices, strengths, gaps, evidence quotes, and coaching tips.
   - The hire recommendation is computed by code from the rubric and is **advisory**: a human makes the final call.

2. **Conversational & Adaptive Interviewing**:
   - Natural spoken conversation using the browser-native **Web Speech API** (zero external speech API cost and zero audio streaming latency).
   - Intelligently probes deeper with follow-up questions when answers are vague or technical claims need verification; advances when competency is proven.
   - Dynamic difficulty scaling (levels 1–5) based on answer depth.

3. **Interview Integrity & Attention Monitoring**:
   - Real-time client-side computer vision with **Google MediaPipe FaceLandmarker** running in the browser (100% private, on-device).
   - Detects head pose (yaw/pitch), looking away from screen, multiple faces, and absence.
   - Tracks browser tab switches (`visibilitychange`) and window blur events.
   - Produces a transparent audit log and timeline for recruiters (kept independent of candidate merit scores).

4. **Guaranteed Offline Fail-Safe**:
   - If internet or API keys fail during judging, an integrated heuristic engine steps in to keep the entire interview and scoring operational.

---

## 🚀 Quick Start (Zero Setup Friction)

### Prerequisites
- Node.js ≥ 22.9
- Google Chrome or Microsoft Edge (for Web Speech API)
- A free Groq API key from [console.groq.com/keys](https://console.groq.com/keys)

### 1. Clone & Set Up
```bash
git clone https://github.com/Aryaman-Saraf/TIMEPASS-PARTICIPATION.git
cd TIMEPASS-PARTICIPATION
```

### 2. Configure Environment
```bash
# Windows Command Prompt
copy .env.example .env

# Mac / Linux / PowerShell
cp .env.example .env
```
Open `.env` and paste your free key:
```env
GROQ_API_KEY=gsk_your_free_key_here
PORT=3000
```

### 3. Verify Offline Engine
```bash
npm test
```
*(Runs unit tests verifying state machine, BARS scoring, and heuristics with 0 external calls).*

### 4. Run the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in Chrome to begin!

---

## 📁 Repository Structure

```
├── README.md                 # Project overview and quick start guide
├── TEAM_ONBOARDING.md        # Branching rules & onboarding reading order
├── TEAM_TASKS.md             # Detailed task checklist and 5-min primers for T1, T2, T3
├── IMPLEMENTATION_PLAN.md    # Full architectural blueprint & API contracts (§4)
├── AGENTS.md                 # Agent guidelines & file protection policy
├── package.json              # Zero-dependency config ("type": "module", npm start/test)
├── .env.example              # Template for free API keys (Groq / Gemini)
├── engine.js                 # Core conversational brain, BARS scoring & offline fallbacks
├── server.js                 # Native Node HTTP server & REST routes (T2)
├── public/                   # Frontend assets (served statically)
│   ├── index.html            # Candidate setup & resume ingestion (T1)
│   ├── room.html             # Split-screen live interview room (T1)
│   ├── room.js               # Web Speech voice loop & visualizer (T1)
│   ├── report.html           # Recruiter scorecard dashboard (T2)
│   ├── report.js             # Scorecard rendering, evidence & BARS bars (T2)
│   ├── integrity.js          # MediaPipe vision & attention tracking (T3)
│   └── styles.css            # Dark theme & UI design tokens (T1)
├── data/sessions/            # JSON session storage (git-ignored)
└── archive/                  # Preserved historical plan iterations
    └── teammate-proposals/   # Original proposals from Prathul & Suryansh (merged into the plan, §10)
```

---

## 💸 Why It's Feasible ($0)

- **No paid services.** LLMs run on the Groq free tier (Gemini free tier as fallback). Speech and face tracking are free browser APIs.
- **No installs.** No npm dependencies and no build step: `npm start` on any laptop with Node and Chrome.
- **Never stops.** If every AI provider fails, a built-in heuristic engine finishes the interview and still writes a report.

## 📈 How It Scales

- **Vision costs the server nothing.** MediaPipe runs in the candidate's browser, and only small JSON event logs are uploaded. No video leaves the device.
- **Thin server.** Each request is one LLM call plus a small JSON write. To scale out, move sessions to Redis/Postgres and run several server instances.
- **Swap models with no code change.** Any OpenAI-compatible provider or model can be set via `.env`. Next steps: a pool of keys and a request queue.
- **Any role.** Competencies and questions are generated from the job description, so there is no per-job question bank.
- **Capacity today (estimate).** One interview ≈ 8–14 LLM calls. One free Groq key handles ≈ 5 interviews at the same time and ≈ 70 per day. Details are in [IMPLEMENTATION_PLAN.md §2a](IMPLEMENTATION_PLAN.md).

## 🗺️ Roadmap (not built today)

- **Scale:** WebRTC media server + a message bus, so speech, vision and audio analysis scale independently. Containerised services, Postgres/Redis sessions.
- **Smarter scoring:** Whisper word-timestamps for pace and filler analysis; embeddings to match answers against JD requirements and resume claims.
- **Fairness & integrity:** stronger PII redaction, a nightly name-swap bias audit, speaker diarization, screen-share checks. Full list in [IMPLEMENTATION_PLAN.md §2b](IMPLEMENTATION_PLAN.md).

---

## 👥 Team Workstreams & Direct Assignments

| Teammate | Assigned Role | Dedicated Branch | Primary Deliverables |
| :--- | :--- | :--- | :--- |
| **Prathul** | **Teammate 1** (Candidate Experience & Audio UX) | `Prathul` | `public/index.html`, `public/room.html`, `public/room.js`, `public/styles.css` (Web Speech voice loop, candidate setup, device pre-flight check) |
| **Aryaman** | **Teammate 2** (AI Brain, Backend Server & Reports) | `feat/aryaman-dev` | `server.js`, `engine.test.js`, `public/report.html`, `public/report.js` (HTTP API routes, Evidence Dossier scorecard, BARS evaluation) |
| **Suryansh** | **Teammate 3** (Vision Integrity, Proctoring & QA) | `suryansh` | `public/integrity.js`, `README.md`, Demo Video (MediaPipe gaze/attention tracker, tab-switch audit, pitch test) |

- **Teammates**: Please read **[TEAM_ONBOARDING.md](TEAM_ONBOARDING.md)** immediately for your Git branch assignment.
- **Task Checklist**: Open **[TEAM_TASKS.md](TEAM_TASKS.md)** to find your assigned track (`T1`, `T2`, or `T3`).
- **Interface Contracts**: Refer to Section 4 of **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** for exact JSON payloads.
