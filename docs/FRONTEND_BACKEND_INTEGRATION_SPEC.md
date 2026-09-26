# Candor AI: Unified Frontend & Backend Integration Specification

**Target Audience:** Frontend Engineer (Teammate 1 - Prathul / Collaborator) & Backend Engineer (Teammate 2 - Aryaman)  
**Architecture Principle:** Complete visual design freedom for the frontend engineer. Zero hardcoded styling constraints. Pure functional contracts, screen definitions, DOM hooks, and API data payloads.

---

## 1. Summary of Changes (What Changed & Why)

| Past Implementation (Problematic) | New Architecture (Enterprise Standard) | Why It Changed |
|---|---|---|
| Single combined screen with camera check AND candidate role/mode textareas. | Split into distinct, sequential screens: **Auth ➔ Candidate Hub ➔ Pre-Device Check ➔ Live Room ➔ Completion**. | Candidates must never configure their own target role, question count, or interview rubric. |
| Candidate had dropdowns to pick role, questions, and paste job description. | Recruiter sets Role, Job Description, and Evaluation Criteria. Candidate views them as **read-only**. | In real hiring, companies define the job criteria; candidates are being evaluated against that criteria. |
| No resume upload flow. | Candidate can upload/paste their resume beforehand or on their dashboard. | System extracts resume text to tailor STAR questions before the interview begins. |
| Immediate redirection to Recruiter Dossier at interview end. | Candidate sees a professional **Completion Screen** ("Results under review"). Recruiter sees the scorecard in the **Recruiter Portal**. | Candidates should never see internal hiring scores or BARS recruiter rubrics directly. |
| Hardcoded candidate list. | Recruiter Portal with full Candidate Management (Add candidate, remove candidate, track status, view dossier). | Recruiter needs full pipeline control over who is invited and who has completed their screening. |

---

## 2. Complete Screen-by-Screen Architecture

The application consists of **6 distinct screens/views**. The frontend developer can implement these as separate HTML files or as a clean single-page application (SPA) with view containers.

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
                                                   (Thank You / Confirmation)
```

---

### Screen 1: Authentication / Portal Gateway (`auth.html` or `#view-auth`)
**Purpose:** Entry point where the user declares their identity.

#### Functional Requirements:
1. **Persona Selection / Login**:
   - Toggle or tabs between **"Candidate / Interviewee"** and **"Hiring Manager / Recruiter"**.
2. **Candidate Login Inputs**:
   - Email or Candidate Invite Code (e.g., `sarah@candor.ai` or quick-login buttons for active invitations).
   - "Continue to Candidate Portal" button.
3. **Recruiter Login Inputs**:
   - Recruiter Email / Password or "Enter Recruiter Portal" demo button.
4. **Key DOM Hooks / Event Handlers**:
   - `#auth-role-candidate`, `#auth-role-recruiter`
   - `#login-input-email`
   - `#login-submit-btn`

---

### Screen 2: Candidate Dashboard / Interview Hub (`candidate-dashboard.html` or `#view-candidate-dashboard`)
**Purpose:** The candidate's personal home screen after logging in. Shows only *their* assigned interview.

#### Functional Requirements:
1. **Assigned Position Card (Strictly Read-Only)**:
   - Target Role: e.g. `Senior Frontend Engineer` (Set by Hiring Manager).
   - Department: e.g. `Platform Engineering`.
   - Interview Mode: `Adaptive Technical Screening (BARS Rubric)`.
   - Target Questions: e.g. `4 Questions (~12 min)`.
2. **Job Description Summary (Strictly Read-Only)**:
   - Extracted requirements and technical focus areas pre-configured by the recruiter.
3. **Resume Management Section**:
   - Shows current resume status (e.g., `resume-v2.pdf` uploaded, or "No resume on file").
   - **Upload Resume Action**: File input (`.pdf`, `.txt`, `.docx`) or paste text area allowing the candidate to upload/replace their resume beforehand.
   - PII notice: *"Personal contact info is automatically redacted before AI evaluation."*
4. **Waiting Line / Ready Status**:
   - Status badge: `Ready to Interview` or `Position in Queue: Next`.
5. **Primary Action Button**:
   - `#btn-start-preflight`: **"Start Interview Pre-Check ↗"** (Navigates to Screen 3).

---

### Screen 3: Pre-Device Check (`preflight.html` or `#view-preflight`)
**Purpose:** Pure hardware and environment verification before entering the live room. **No candidate role/job configuration appears here.**

#### Functional Requirements:
1. **Video Preview Frame**:
   - `<video id="preview-video" autoplay muted playsinline>` with mirrored stream.
   - Shows active camera feed so the candidate can center themselves.
2. **Device Selectors**:
   - Camera dropdown (`#cam-select`)
   - Microphone dropdown (`#mic-select`)
   - Audio Output dropdown (`#spk-select`)
3. **Live Microphone Activity Meter**:
   - Real-time animated volume bar reflecting candidate vocal input via Web Audio API.
4. **Readiness Verification Indicators**:
   - `Camera Active` (Green/Red indicator)
   - `Microphone Connected` (Green/Red indicator)
   - `Browser Speech AI Ready` (Web Speech API availability check)
5. **Interactive Speaker Audio Test**:
   - `#btn-test-speakers`: Plays an audio chime and speaks a synthetic test phrase to confirm sound output.
6. **Primary Action Button**:
   - `#btn-enter-room`: **"Enter Live Interview Room ↗"** (Launches Screen 4).

---

### Screen 4: Live Interview Room (`room.html` or `#view-room`)
**Purpose:** The active, spoken screening session with AI Interviewer Ava.

#### Functional Requirements:
1. **Candidate Video Stream & MediaPipe Overlay**:
   - Mirrored webcam feed (`#cam`).
   - Landmark tracking overlay canvas (`#overlay`).
   - Real-time Attention HUD badges:
     - `👁️ Vision Status` (Active / Offline)
     - `🎯 Focus Status` (Centered / Looking Away)
     - `👥 Faces Detected` (1 Verified / Multiple / Missing)
     - `📊 On-Screen %` (Live percentage)
2. **AI Voice Interaction Panel**:
   - 3D Glowing AI Voice Orb (`#ai-orb`) with dynamic animations (`.speaking`, `.thinking`).
   - Audio waveform canvas (`#audio-wave`) animating voice amplitude.
   - Status text: `Active Listening...`, `Speaking...`, `Reasoning...`
3. **Scrolling Transcript**:
   - Real-time chronological chat log displaying candidate speech and AI questions with timestamps.
4. **Dynamic AI Reasoning / Action Card**:
   - Displays real-time progress:
     - Follow-up probe reason (e.g., *"Probing deeper STAR metrics on React state management"*).
     - Competency badge and difficulty level (`1` to `5`).
5. **Backup Text Input**:
   - Text input box + Send button allowing manual typing if microphone drops.
6. **Controls Toolbar**:
   - Microphone Mute button (`#mute-btn`).
   - Screen Share toggle (`#screen-share-btn`).
   - Repeat Question button (`#repeat-question-btn`).
   - `#btn-end-interview`: **"End Interview"** button.

---

### Screen 5: Interview Completion / Pending Results (`completion.html` or `#view-completion`)
**Purpose:** Professional closing state for the candidate. **Recruiter scores are hidden.**

#### Functional Requirements:
1. **Confirmation State**:
   - Checkmark / success graphic.
   - Message: *"Thank you for interviewing with us! Your responses and technical evidence have been securely submitted to the hiring team."*
2. **Next Steps Explanation**:
   - Informative notice: *"The hiring manager will review your completed dossier and reach out with next steps."*
3. **Action Button**:
   - `#btn-return-home`: "Return to Candidate Hub" or "Sign Out".

---

### Screen 6: Recruiter Pipeline Portal (`report.html` or `recruiter.html`)
**Purpose:** Complete candidate roster management and Evidence Dossier inspection for hiring managers.

#### Functional Requirements:
1. **Pipeline Header & Summary Stats**:
   - Active Candidates count, Interviews Completed count, Pending Reviews count.
2. **Candidate Management Toolbar**:
   - `#btn-add-candidate`: Opens **"Add New Candidate"** modal.
3. **Add Candidate Modal**:
   - Input: Candidate Full Name.
   - Input: Candidate Email.
   - Input: Target Role (e.g. `Senior Backend Engineer`).
   - Input / Textarea: Job Description & Competency Rubrics.
   - Input / Textarea: Initial Candidate Resume (or file upload).
   - Input: Question Count (Default: 4).
   - "Create & Send Invitation" button.
4. **Candidate Pipeline Table / Grid**:
   - Columns: Candidate Name, Target Role, Date Created, Interview Status (`Pending`, `In Progress`, `Completed`), Overall BARS Score (for completed), Advisory Recommendation (`Strong Hire`, `Hire`, `Hold`, `No Hire`), Integrity Risk (`Low`, `Med`, `High`), Actions.
   - Action buttons:
     - **"View Dossier →"** (Opens detailed report for completed interviews).
     - **"Delete / Archive"** (Removes candidate from active roster).
5. **Candidate Evidence Dossier Detail View**:
   - 3-tile score index header: Technical Relevancy, Articulation & Delivery %, Integrity Confidence %.
   - BARS scorecard with verbatim quoted evidence.
   - Adaptive question path visualization with difficulty progression.
   - Candidate coaching suggestions.
   - On-device integrity audit log (time-stamped tab switches, gaze deviations).

---

## 3. Backend API Contract Specification (§4 Enhanced)

The Node.js HTTP server (`server.js` + `engine.js`) exposes the following frozen endpoints:

### 3.1 Candidate Management APIs (Recruiter)

#### `GET /api/candidates`
* **Purpose:** Returns all candidates in the recruiter pipeline.
* **Response (200 OK):**
  ```json
  [
    {
      "id": "cand-001",
      "name": "Sarah Jenkins",
      "email": "sarah@example.com",
      "role": "Senior Frontend Engineer",
      "status": "ready",
      "hasResume": true,
      "sessionId": null
    }
  ]
  ```

#### `POST /api/candidates`
* **Purpose:** Recruiter adds a new candidate with locked criteria.
* **Request:**
  ```json
  {
    "name": "Alex Chen",
    "email": "alex@example.com",
    "role": "Senior Backend Engineer",
    "jobDescription": "Distributed systems, Node.js, Postgres, Redis",
    "resumeText": "Alex Chen - 7 years backend...",
    "questionCount": 4
  }
  ```
* **Response (200 OK):** Created Candidate Object with generated `id`.

#### `DELETE /api/candidates?id=<candidateId>`
* **Purpose:** Recruiter removes a candidate from the roster.
* **Response (200 OK):** `{ "success": true, "id": "cand-001" }`

---

### 3.2 Candidate Resume Upload API

#### `POST /api/candidate/resume`
* **Purpose:** Candidate uploads or updates their resume text beforehand.
* **Request:**
  ```json
  {
    "candidateId": "cand-001",
    "resumeText": "Extracted plaintext from uploaded PDF/Docx resume..."
  }
  ```
* **Response (200 OK):** `{ "success": true, "characterCount": 1420 }`

---

### 3.3 Interview Lifecycle APIs

#### `POST /api/start-interview`
* **Purpose:** Initializes an active interview session from candidate data.
* **Request:**
  ```json
  {
    "candidateId": "cand-001",
    "candidateName": "Sarah Jenkins",
    "role": "Senior Frontend Engineer",
    "jobDescription": "React, TypeScript, Web Vitals",
    "resumeText": "6 years frontend engineering...",
    "questionCount": 4
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "id": "sess-77e9d806",
    "candidateName": "Sarah Jenkins",
    "role": "Senior Frontend Engineer",
    "status": "active",
    "turns": [
      {
        "role": "ai",
        "text": "Hello Sarah! Welcome. Can you describe how you managed performance optimization in your recent React project?",
        "qIndex": 0,
        "difficulty": 3
      }
    ]
  }
  ```

#### `POST /api/chat-turn`
* **Purpose:** Processes candidate spoken answer and returns adaptive next turn.
* **Request:**
  ```json
  {
    "sessionId": "sess-77e9d806",
    "answer": "We used code splitting and memoization to decrease LCP by 60%."
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "reply": "That's a significant reduction. What profiling metrics or tools did you use to verify those gains?",
    "done": false,
    "progress": {
      "question": 1,
      "total": 4,
      "competency": "Technical Architecture",
      "difficulty": 4,
      "action": "probe"
    }
  }
  ```

#### `POST /api/evaluate`
* **Purpose:** Concludes session, computes BARS scores, and compiles Evidence Dossier.
* **Request:**
  ```json
  {
    "sessionId": "sess-77e9d806",
    "integrity": {
      "totalMs": 720000,
      "visionAvailable": true,
      "events": [
        { "type": "LOOK_AWAY", "t": 45000, "durationMs": 2500, "detail": { "yaw": 28, "pitch": -4 } }
      ]
    }
  }
  ```
* **Response (200 OK):** Complete evaluated session object with `report` and `integrity` score.

---

## 4. Frontend Developer Design & Implementation Guidelines

1. **Complete Creative Freedom on Aesthetics**:
   - The frontend engineer has full authority to design the typography, color palette, card shadows, animations, and responsive layout.
   - Do NOT feel bound to any specific UI framework. Vanilla HTML5/CSS3 or Tailwind can be used.
2. **Modularity**:
   - Keep JavaScript modules separated:
     - `auth.js` (Portal login & persona switching)
     - `candidate.js` (Dashboard & resume file drag-drop)
     - `preflight.js` (MediaStream calibration & mic volume analyzer)
     - `room.js` (STT recognition, TTS synthesizer, live turn loop)
     - `recruiter.js` (Candidate table, add candidate modal, dossier rendering)
3. **Dynamic MediaPipe Loading**:
   - FaceLandmarker must load dynamically from `@mediapipe/tasks-vision` CDN only when Screen 3 or 4 is mounted, preventing blocking on auth pages.
4. **Privacy Protocol**:
   - Audio and video are processed strictly on the client device. Never stream raw video chunks to the backend. Only transmit the telemetry event array upon evaluation.
