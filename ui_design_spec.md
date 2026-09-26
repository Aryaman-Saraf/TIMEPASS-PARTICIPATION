# Candor: UI Design Specifications & Mockups

To bring this architecture to life, I have designed three high-fidelity UI mockups for the critical user journeys in our platform. By comparing this to professional tools like **Zoom, HireVue, and Vercel**, I have also identified and integrated **new professional requirements** into the UI to ensure it is enterprise-ready.

---

## 1. Candidate Pre-Flight Setup
*Goal: Ensure the candidate is comfortable, technically ready, and fully informed.*

![Candidate Setup UI](/home/prathul/.gemini/antigravity/brain/8a0ab0be-dc06-4fba-b058-18e1d3b20884/candidate_setup_ui_1790406946397.jpg)

### 🆕 New Requirements Integrated:
*   **A11y (Accessibility) Prompts:** Added high-contrast support and keyboard-navigable setup chips.
*   **Privacy Controls (from Zoom/Teams):** Included a "Blur Background" toggle directly on the preview screen before the interview starts to protect the candidate's privacy.
*   **Granular Hardware Checks:** Instead of a generic "Ready", the UI provides explicit green chips for **Camera**, **Microphone**, and **Speech Recognition**. If any fail, a localized troubleshooting tooltip appears.

---

## 2. Live Interview Room
*Goal: Create a natural, low-stress, conversational environment that clearly communicates the AI's adaptivity.*

![Interview Room UI](/home/prathul/.gemini/antigravity/brain/8a0ab0be-dc06-4fba-b058-18e1d3b20884/interview_room_ui_1790406959779.jpg)

### 🆕 New Requirements Integrated:
*   **Live Adaptivity Badging:** Borrowing from modern AI copilots, a small badge (e.g., *✨ Follow-up Question*) appears when the AI deviates from the standard script. This visually proves to the candidate (and judges) that the AI is listening and adapting, rather than reading a static questionnaire.
*   **Network Resilience Indicators:** Like Google Meet, a small cellular-style bar shows the WebRTC connection strength. If the internet drops, a graceful "Reconnecting..." overlay masks the stutter.
*   **Fallback Input (from Chatbots):** A discreet text input box remains available. If the candidate's microphone suddenly dies, they can seamlessly switch to typing their answers without terminating the session.

---

## 3. Recruiter Evidence Dossier (Dashboard)
*Goal: Provide a bias-free, highly analytical, and explainable scorecard for hiring managers.*

![Recruiter Dashboard UI](/home/prathul/.gemini/antigravity/brain/8a0ab0be-dc06-4fba-b058-18e1d3b20884/recruiter_dashboard_ui_1790406976206.jpg)

### 🆕 New Requirements Integrated:
*   **Explainable Dossier Tiles:** Inspired by Vercel's clean analytics, the top features the three core metrics synthesized from our plan: *Technical Relevancy*, *Articulation*, and *Integrity Confidence*.
*   **Advisory Disclaimer Label:** A prominent label stating, *"Advisory, a human makes the final call"* to mitigate legal risk and reinforce that the AI is a copilot, not the final decision-maker.
*   **Timestamped Evidence Reel:** Clicking on any row in the "Integrity Events Timeline" (e.g., a tab switch) automatically scrolls the recruiter to the exact moment in the text transcript where the event occurred.
*   **Collaboration Features (from SaaS tools):** Added the ability for recruiters to leave `@mentions` and internal notes directly on the transcript for other hiring managers to review.
