# Welcome to Candor AI — Frontend Master Build Guide

**Welcome to the team, Tanay!**  
This document is your complete, zero-to-hero onboarding and architectural blueprint. It explains what Candor AI is, how the system works, and gives you a step-by-step roadmap to build and own the entire frontend experience.

---

## 1. What is Candor AI? (The 2-Minute Elevator Pitch)

**Candor AI** is an AI-powered, voice-first technical interview platform built for the **BitNBuild26** hackathon. It operates with a **$0 budget** and **zero npm dependencies**, running natively in modern web browsers and pure Node.js (≥ 22.9).

### The Three Team Roles:
* **T1: Tanay (You — Frontend Lead)**: Owns the candidate interview experience, recruiter portal, voice UI, and browser audio/video interfaces in [`public/`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/).
* **T2: Aryaman (AI Backend & Architecture)**: Built the Node.js HTTP server ([`server.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/server.js)), adaptive LLM conversational brain ([`engine.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/engine.js)), BARS evaluation rubrics, and automated test suites.
* **T3: Suryansh (Integrity & Vision QA)**: Built the client-side MediaPipe attention & gaze tracking engine ([`public/integrity.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/integrity.js)) and anti-cheat sandbox.

---

## 2. Your Tech Stack & Philosophy

* **Language**: Vanilla HTML5, CSS3, and modern JavaScript (ES Modules: `<script type="module">`).
* **Dependencies**: **Zero npm packages**. Everything runs natively in Google Chrome via browser Web APIs:
  * Speech-to-Text: `webkitSpeechRecognition` / `SpeechRecognition`
  * Voice Synthesis (Ava): `speechSynthesis` / `SpeechSynthesisUtterance`
  * Media Capture: `navigator.mediaDevices.getUserMedia`
  * Audio Waveform: Web Audio API (`AudioContext`, `AnalyserNode`)
  * Vision Tracking: MediaPipe FaceLandmarker (already packaged in [`public/integrity.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/integrity.js)).
* **Design Freedom**: **You have 100% creative control over visual styling, color palettes, typography, micro-animations, and card layouts.** The backend only expects specific element IDs and API JSON payloads.

---

## 3. The 6-Screen User Flow (Your Complete Deliverable)

Here is the exact journey from entry to completion:

```text
[Screen 1: Login / Gateway]
         │
         ├───▶ [Recruiter Selected] ──▶ [Screen 6: Recruiter Pipeline Portal]
         │                                       │
         │                                       └──▶ (Inspect Candidate Dossier)
         │
         └───▶ [Candidate Selected] ──▶ [Screen 2: Candidate Dashboard]
                                                 │ (Upload/Review Resume & Job)
                                                 ▼
                                        [Screen 3: Pre-Device Check]
                                                 │ (Camera, Mic, Speakers)
                                                 ▼
                                        [Screen 4: Live Interview Room]
                                                 │ (Voice AI + Attention HUD)
                                                 ▼
                                        [Screen 5: Interview Completion]
                                                   (Thank You / Results Under Review)
```

---

### Screen 1: Authentication / Entry Gateway (`auth.html` or main portal)
**What it does:** The very first screen when opening the site. The user picks their role:
1. **Candidate / Interviewee**:
   - Enters their candidate email or clicks their scheduled invite (e.g., Sarah Jenkins, Alex Chen, Jordan Lee).
   - Navigates to **Screen 2**.
2. **Hiring Manager / Recruiter**:
   - Enters recruiter credentials or clicks "Enter Recruiter Portal".
   - Navigates to **Screen 6**.

---

### Screen 2: Candidate Dashboard / Interview Hub (`candidate-dashboard.html`)
**What it does:** The candidate's personal home base. **Shows only *their* assigned interview.**
* **What the candidate sees (Strictly Read-Only — Set by Hiring Manager)**:
  * **Target Position**: e.g., `Senior Frontend Engineer` (Locked; candidate cannot change this).
  * **Job Description Summary**: Key competencies (e.g., React, TypeScript, Core Web Vitals).
  * **Interview Details**: `4 Questions · Adaptive STAR Probing (~12 min)`.
* **Resume Management**:
  * Displays pre-uploaded resume text or status.
  * Allows candidate to drag-and-drop or paste an updated resume beforehand.
  * Notice: *"PII is automatically redacted before AI evaluation."*
* **Waiting Line Indicator**:
  * Shows queue status: `Status: Ready to Interview · Position in Queue: #1`.
* **Action Button**:
  * **"Start Interview Pre-Check ↗"** ➔ Navigates to **Screen 3**.

---

### Screen 3: Pre-Device Calibration Check (`preflight.html`)
**What it does:** Pure hardware calibration before entering the room. **Zero role editing or prompt engineering appears here.**
* **Components**:
  * Mirrored webcam video box (`<video id="preview-video">`).
  * Device dropdowns for Camera, Microphone, and Audio Output.
  * Real-time mic volume activity bar (animates as candidate speaks).
  * Status chips: `✓ Camera Active`, `✓ Microphone Connected`, `✓ Speech AI Ready`.
  * "Test Speakers & Voice" button (plays a synthetic chime and speech phrase).
* **Action Button**:
  * **"Enter Live Interview Room ↗"** ➔ Navigates to **Screen 4**.

---

### Screen 4: Live Interview Room (`room.html`)
**What it does:** The actual spoken interview with AI Interviewer "Ava".
* **Left Panel — Candidate Webcam & Attention Overlay**:
  * Mirrored webcam video feed (`<video id="cam">`).
  * Landmark overlay canvas (`<canvas id="overlay">`).
  * Real-time Attention HUD (driven by Suryansh's `IntegrityMonitor`):
    * `👁️ Vision: Active`
    * `🎯 Focus: Centered` (turns red/yellow if looking away)
    * `👤 1 Face Verified` (warns if multiple faces or missing)
    * `📊 On-Screen %`
  * Mic Mute button & Desktop Screen Share button.
* **Right Panel — AI Conversational Hub**:
  * 3D Glowing AI Voice Orb (`#ai-orb`) with `.speaking` and `.thinking` animations.
  * Audio Waveform Canvas (`#audio-wave`) showing voice frequency bars.
  * Scrolling transcript chat box with timestamps.
  * Dynamic AI Action / Reasoning Card:
    * Displays Ava's real-time thinking: e.g. *"✨ Follow-up Probe: Digging into React performance metrics on Question 1 of 4."*
    * BARS competency difficulty rating (`1` to `5`).
  * Backup manual text input box (for candidates with noisy mics).
  * **"End Interview"** button ➔ Gathers telemetry, sends evaluation, and navigates to **Screen 5**.

---

### Screen 5: Interview Completion / Pending Results (`completion.html`)
**What it does:** A clean, professional closing state for candidates.
* **Key Rule**: **Candidates NEVER see internal hiring scores or recruiter rubrics.**
* **Components**:
  * Success checkmark.
  * Message: *"Thank you for interviewing with Candor! Your responses and evidence have been submitted to the hiring team."*
  * Status explanation: *"The recruiter is reviewing your dossier. You will hear back shortly."*
  * Button: "Return to Home" or "Sign Out".

---

### Screen 6: Recruiter Pipeline Portal (`report.html` or `recruiter.html`)
**What it does:** Complete candidate pipeline management for hiring managers.
* **Pipeline Table**:
  * Lists all scheduled and completed candidates.
  * Displays Status (`Pending`, `In Progress`, `Completed`), Overall BARS Score, Advisory Recommendation (`Strong Hire`, `Hire`, `Hold`, `No Hire`), and Integrity Risk (`Low`, `Med`, `High`).
* **Candidate Management Actions**:
  * **"Add New Candidate" Modal**: Hiring manager sets Candidate Name, Email, Target Role, Job Description, and initial Resume.
  * **"Remove Candidate"**: Deletes or archives candidate from active roster.
* **Candidate Evidence Dossier Detail View**:
  * Clicking any completed candidate opens their complete Evidence Dossier:
    * 3 quantitative index tiles: Technical Relevancy %, Delivery %, Integrity Confidence %.
    * BARS scorecard with verbatim quoted quotes from the candidate.
    * Adaptive question path graph (showing difficulty progression).
    * Candidate growth coaching suggestions.
    * On-device integrity audit log (time-stamped tab switches, gaze deviations).

---

## 4. Backend API Cheat Sheet (Ready to Copy-Paste)

The backend server is already running on `http://localhost:3000`. You can make these standard `fetch()` calls from your JavaScript:

### 1. Fetch Candidate Roster (Recruiter)
```javascript
const res = await fetch('/api/candidates');
const candidates = await res.json();
// Returns: [{ id, name, role, department, status, jobDescription, resumeText }]
```

### 2. Add New Candidate (Recruiter)
```javascript
const res = await fetch('/api/candidates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Tanay Sharma',
    role: 'Frontend Architect',
    department: 'Core Product',
    jobDescription: 'Expertise in modern JavaScript, Web Audio, and responsive UI design.',
    resumeText: '6 years frontend experience building real-time collaboration tools.',
    questionCount: 4
  })
});
const newCandidate = await res.json();
```

### 3. Update Candidate Resume (Candidate Dashboard)
```javascript
const res = await fetch('/api/candidate/resume', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    candidateId: 'cand-001',
    resumeText: extractedTextFromUserFile
  })
});
```

### 4. Start the Interview Session
```javascript
const res = await fetch('/api/start-interview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    candidateName: candidate.name,
    role: candidate.role,
    jobDescription: candidate.jobDescription,
    resumeText: candidate.resumeText,
    questionCount: 4
  })
});
const session = await res.json();
// Redirect to room: window.location.href = `room.html?id=${session.id}`;
```

### 5. Send Candidate Spoken Answer (Live Room Turn)
```javascript
const res = await fetch('/api/chat-turn', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: session.id,
    answer: candidateAnswerText
  })
});
const data = await res.json();
// data.reply -> Ava's next question
// data.done  -> true if interview has completed
// data.progress -> { action: 'probe'|'advance'|'wrap_up', difficulty: 1-5, competency: '...' }
```

### 6. End Interview & Evaluate Evidence Dossier
```javascript
// monitor is the IntegrityMonitor instance from integrity.js
const integrityPayload = monitor.stop();

const res = await fetch('/api/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: session.id,
    integrity: integrityPayload
  })
});
const evaluatedSession = await res.json();
// Redirect candidate to completion screen!
```

---

## 5. Integrating Suryansh's Integrity Monitor (T3) in the Room

Suryansh has already written the entire MediaPipe face and gaze tracking engine in [`public/integrity.js`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/integrity.js). You just need to import and instantiate it:

```javascript
import { IntegrityMonitor } from './integrity.js';

const videoEl = document.getElementById('cam');
const canvasEl = document.getElementById('overlay');

const monitor = new IntegrityMonitor(videoEl, canvasEl, (hud) => {
  // Update your HUD badges dynamically
  console.log('Vision state:', hud.vision);    // 'on' | 'loading' | 'unavailable'
  console.log('Focus state:', hud.focus);      // 'ok' | 'away'
  console.log('Face count:', hud.faces);       // 0, 1, or 2+
  console.log('On-screen %:', hud.stats.onScreenPct); // e.g. 98
});

// Start monitoring with camera (and optional desktop screen share)
await monitor.start(true, false);
```

---

## 6. How to Run and Test Locally

1. Open your terminal in the project directory:
   ```bash
   cd "C:\Users\aryam\TIMEPASS PARTICIPATION"
   ```
2. Run the automated tests to make sure the engine is green:
   ```bash
   npm test
   ```
   *(All 17 tests will run and pass in ~500 ms with zero npm dependencies)*.
3. Start the local server:
   ```bash
   node server.js
   ```
4. Open Google Chrome:
   * **Candidate & Portal Gateway**: [http://localhost:3000/](http://localhost:3000/)
   * **Recruiter Evidence Dossier**: [http://localhost:3000/report.html](http://localhost:3000/report.html)
   * **Vision Integrity Sandbox**: [http://localhost:3000/test-integrity.html](http://localhost:3000/test-integrity.html)

---

## 7. Working Directory Cleanliness Rule

* Keep all your production HTML, CSS, client JS, and assets inside [`public/`](file:///c:/Users/aryam/TIMEPASS%20PARTICIPATION/public/).
* Do not leave temporary scratch files or drafts in the root folder.
* Feel free to ask Aryaman for any additional API endpoints or backend adjustments you need!
