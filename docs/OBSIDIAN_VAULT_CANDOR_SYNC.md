# Candor: AI-Powered Screening Interview Platform

> **Vault Sync Date**: 2026-09-26  
> **Repository**: [Aryaman-Saraf/TIMEPASS-PARTICIPATION](https://github.com/Aryaman-Saraf/TIMEPASS-PARTICIPATION)  
> **Status**: Live on Vercel Serverless | 21/21 Automated Tests Passing

---

## 1. Executive Summary
**Candor** is an enterprise-grade, voice-first screening interview platform built for the BitNBuild26 hackathon. Operating with a **$0 budget** and **zero npm dependencies**, it runs on modern web browsers, Node.js (≥ 22.9), and **Vercel Serverless**.

---

## 2. Core Pillars
1. **Adaptive Interview Brain**: Dynamically tailors questions to the candidate's resume and job description. Adaptively probes for deeper STAR evidence (if vague) or increases difficulty (+1/-1 clamped to 1–5 if strong).
2. **Real-Time Spoken Conversation**: Browser-native Speech-to-Text (`webkitSpeechRecognition`) and Text-to-Speech (`speechSynthesis`) providing an end-to-end spoken dialogue with "Ava" with zero third-party audio latency or cost.
3. **Fair, On-Device Integrity Monitoring**: Client-side face and gaze tracking via Google MediaPipe FaceLandmarker, mandatory entire-screen share verification, no mic mute policy during interview, and automated session termination on tab or application backgrounding. Attention metrics are strictly advisory context for recruiters and are never factored into the hiring score.
4. **Explainable Evidence Dossier & AI Candidate Rankings**: Code-computed weighted BARS scores, advisory recommendations (`Strong Hire`, `Hire`, `Lean Hire`, `No Hire`), exact transcript quote attribution, adaptive path trees, and recruiter pipeline rankings with percentiles.

---

## 3. 6-Screen Enterprise Architecture
- **Screen 1: Enterprise Gateway & Dual-Portal Selection** (`public/index.html`, `public/auth.html`): Dual portal entry with live `/api/health` telemetry, candidate demo profiles, and recruiter SSO.
- **Screen 2: Candidate Hub & Resume Intake** (`public/candidate-dashboard.html`): Profile card, job description, queue position, resume intake drag-and-drop, and automated PII redaction.
- **Screen 3: Pre-Device Hardware Calibration** (`public/preflight.html`): Mirrored webcam preview, camera/mic selectors, Web Audio volume meter, speech recognition check, and chime test.
- **Screen 4: Live Spoken Room & Attention HUD** (`public/room.html`): Mirrored candidate video, real-time MediaPipe Attention HUD, 3D pulsating voice orb, waveform visualizer, dynamic BARS difficulty badges, live transcript, and typed fallback.
- **Screen 5: Post-Interview Confirmation** (`public/completion.html`): Animated status badge, candidate summary, and confidentiality assurance.
- **Screen 6: Recruiter Pipeline & Evidence Dossier** (`public/recruiter-portal.html`, `public/report.html`): AI Candidate Ranking Leaderboard with calculated percentiles, score distributions, and interactive Evidence Dossier.

---

## 4. Key Architectural Decisions
- **Vercel Serverless Architecture**: Static frontend served from `public/` via `vercel.json` (`outputDirectory: "public"`). Serverless function entrypoint `api/index.js` handles all `/api/(.*)` requests with lazy DB initialization.
- **Universal Database Adapter (`db.js`)**: Supabase Cloud PostgreSQL REST API with transparent local JSON file fallback (`data/candidates.json`, `data/sessions/`). Schema in `supabase/schema.sql`.
- **Anti-Cheating Confinement Protocol**: Mandatory entire-screen display capture (tabs rejected), no mic mute, and instant window blur / tab switch auto-termination.
- **Ethical Integrity Separation**: Attention metrics are strictly advisory context for recruiters and are never factored into the candidate's hiring score.
- **Zero npm Dependencies**: Pure native `node:http`, built-in Web Speech API, and client-side MediaPipe. 21/21 automated tests passing (`npm test`).
