# Candor: Cross-Team Directives & Interface Guidelines

This document details the exact coordination guidelines, shared contracts, and handoff instructions agreed across the three teammates (**Prathul / T1**, **Aryaman / T2**, **Suryansh / T3**) to prevent merge conflicts and ensure zero runtime surprises during judging.

---

## 1. Directives for Prathul (T1 — Candidate Experience)
**Branch:** `Prathul`  
**Owned Files:** `public/styles.css`, `public/index.html`, `public/room.html`, `public/room.js`

### 🎨 1.1 Shared CSS Design Tokens
The Recruiter Report (`report.html`) and the Interview Room (`room.html`) must share a consistent visual dark theme. Please define the following standard CSS variables in `public/styles.css`:
```css
:root {
  --bg: #0b1020;        /* Deep navy background */
  --card: #141a2e;      /* Elevated container cards */
  --border: #263049;    /* Clean borders and dividers */
  --text: #e6e9f2;      /* Primary text */
  --muted: #8b93a7;     /* Secondary / timestamp text */
  --accent: #6c8cff;    /* Primary highlight / buttons / active state */
}
```

### 🔒 1.2 Button State & Busy Lock (HTTP 409) Handling
The backend enforces a strict per-session in-flight lock to prevent duplicate concurrent turns.
- **In `room.js`**: Disable the **Done**, **End**, and **Retry** buttons as soon as an API call (`/api/chat-turn` or `/api/evaluate`) begins.
- **On Error 409**: If `/api/evaluate` returns status 409 (`session is busy`), wait 1 second and automatically retry once before showing an error.

### 🎙️ 1.3 Pre-Flight & Ava Status Indicators
- **Pre-flight chips**: After the candidate clicks **Begin**, display status chips for Camera (✓/✗), Mic (✓/✗), and Speech Recognition (✓/✗). If Speech is ✗, notify the user that typed mode is active.
- **Status State**: Set `document.body.dataset.state = 'speaking' | 'listening' | 'thinking'` during the conversation loop.

---

## 2. Directives for Suryansh (T3 — Integrity & QA)
**Branch:** `suryansh`  
**Owned Files:** `public/integrity.js`, `README.md`

### 📦 2.1 Dynamic MediaPipe Import (Crucial for Offline Resilience)
`public/report.js` imports `renderIntegrity(el, integrity, turns)` directly from `public/integrity.js`.
- **CRITICAL REQUIREMENT**: Do **NOT** put a static CDN `import` at the top level of `integrity.js`:
  ```js
  // ❌ AVOID TOP-LEVEL STATIC IMPORT (Breaks report.js offline!)
  // import { FilesetResolver, FaceLandmarker } from 'https://cdn.jsdelivr.net/...';
  ```
- **INSTEAD, USE DYNAMIC IMPORT INSIDE `start()`**:
  ```js
  // ✅ LOAD DYNAMICALLY ONLY WHEN CAMERA STARTS
  export class IntegrityMonitor {
    async start(hasCamera) {
      if (!hasCamera) return;
      try {
        const { FilesetResolver, FaceLandmarker } = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs'
        );
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
        );
        // initialize model...
      } catch (err) {
        console.warn('MediaPipe CDN load failed, falling back to tab monitoring only');
      }
    }
  }
  ```

### 🛡️ 2.2 Handling Missing or Denied Camera
- If `integrity.captured === false` or `integrity.visionAvailable === false`, `renderIntegrity()` should display:
  > *"Camera was not available; only tab switching and window focus were monitored."*
- Never show an erroneous 0% or 100% when vision tracking was not active.

### 🔗 2.3 Transcript Anchors (Stretch Feature)
- Each conversation turn in `report.html` is rendered with an HTML id: `<div id="turn-0">`, `<div id="turn-1">`, etc.
- In your integrity audit table, you can link any event to its corresponding question turn via `<a href="#turn-${event.turnIndex}">`.

---

## 3. Updates Implemented by Aryaman (T2 — AI Backend & Report)
**Branch:** `feat/aryaman-dev`  
**Owned Files:** `engine.js`, `engine.test.js`, `server.js`, `server.test.js`, `data/mock-session.json`, `public/report.html`, `public/report.js`

1. **AI Fast-Tier Timeout Reduced to 8s**:
   - `llmJSON` fast-tier timeout dropped from 15s to **8s** for rapid failover to offline heuristics if Groq hangs.
2. **Edge-Case Engine Fixes Applied**:
   - `computeIntegrity(undefined)` properly marks `visionAvailable: false` and `captured: false`.
   - `evaluate()` falls back to session duration elapsed since `createdAt` if `totalMs` is omitted or zero.
3. **HTTP Server (`server.js`) Active**:
   - All 6 endpoints (`/api/start-interview`, `/api/chat-turn`, `/api/evaluate`, `/api/sessions`, `/api/session?id=`, `/api/health`) verified and live.
   - Built-in path traversal security guard prevents access to `.env` or files outside `public/`.
   - Automatic seeding of all `.json` files in `data/` (including `data/mock-session.json`).
4. **16/16 Automated Tests Passing**:
   - `npm test` runs both `engine.test.js` (10 tests) and `server.test.js` (6 tests).
