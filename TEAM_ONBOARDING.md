# 🚀 Teammate Quick-Start & Git Branching Guide

Welcome team! We are building **Candor**, an AI-Powered Interview Bot, under a strict 5-hour hackathon timeframe.

---

## ⚠️ CRITICAL RULE: Branching Workflow (DO NOT WORK ON `main`)

To avoid merge conflicts and lost code, **nobody is allowed to commit or push directly to `main`**. Every teammate MUST work in their own dedicated branch.

### 1. Clone the Repository
```bash
git clone https://github.com/Aryaman-Saraf/TIMEPASS-PARTICIPATION.git
cd TIMEPASS-PARTICIPATION
```

### 2. Create Your Feature Branch IMMEDIATELY
Depending on your assigned role, create and switch to your branch:

- **Teammate 1 (Candidate Experience & Voice UI)**:
  ```bash
  git checkout -b feat/t1-candidate-experience
  ```
- **Teammate 2 (AI Engine, Server & Report)**:
  ```bash
  git checkout -b feat/t2-ai-backend-report
  ```
- **Teammate 3 (Vision Integrity & Testing/QA)**:
  ```bash
  git checkout -b feat/t3-integrity-qa
  ```

### 3. Commit Small and Push Regularly
Push your work to your branch at least every 30 minutes:
```bash
git add .
git commit -m "feat(scope): describe what you built"
git push -u origin <your-branch-name>
```

### 4. Merge into `main` at Each Checkpoint (H1:30, H3:00, H4:15)
1. Open a Pull Request from your branch into `main` on GitHub.
2. The repo owner merges it.
3. Pull `main` back into your branch:
   ```bash
   git pull origin main
   ```
Because every file has exactly one owner, these merges should never conflict.

---

## 📖 What You Must Read & Refer To

Follow this exact reading order before touching any code:

1. **[README.md](README.md)** (3 min): 
   - Understand the project mission, architecture, and how to run the app.
2. **[TEAM_TASKS.md](TEAM_TASKS.md)** (5 min - **MOST IMPORTANT**):
   - Start with **"How we're judged"** at the top: Functionality 14, Innovation 10, Demonstration 8, Feasibility 7, Scalability 6, Design 5.
   - Find your section (`T1`, `T2`, or `T3`).
   - Read your **5-Minute Primer**, check your **Files Owned**, and follow your **Timed Checklist**.
   - Notice the **"If stuck"** fallbacks: if an issue takes more than 20 minutes, switch immediately to the documented fallback.
3. **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Section 4 ONLY** (5 min):
   - Read §4 "Interface Contracts". These are the exact JSON payloads and function signatures connecting your code to your teammates' code.
   - As long as you respect §4, your code will plug in seamlessly.

---

## 🔑 Environment & Free API Setup

Do not share API keys! The free tier limits requests per minute per key.

1. **Get your own free Groq API key** in 60 seconds (no credit card required):
   👉 [https://console.groq.com/keys](https://console.groq.com/keys)
2. **Create your `.env` file**:
   ```bash
   cp .env.example .env
   ```
   *(On Windows Command Prompt: `copy .env.example .env`)*
3. Paste your key into `.env`:
   ```env
   GROQ_API_KEY=gsk_your_key_here
   ```
4. **Test the engine locally**:
   ```bash
   npm test
   ```
   *(If offline tests pass, you are ready to build!)*

---

## ⏱️ Today's Master Schedule & Checkpoints

| Time | Checkpoint | Goal |
| :--- | :--- | :--- |
| **H0:00 – H0:30** | **Setup & Stubs** | Everyone clones, creates their branch, gets keys, and pushes stubs. |
| **H1:30** | **Checkpoint 1** | Form setup → room page opens and speaks the opening question aloud. |
| **H3:00** | **Checkpoint 2 (MVP Freeze)** | Complete spoken interview from start to finish + report generated. |
| **H4:15** | **Code Freeze** | Bug fixes only. Run the full demo script twice. |
| **H4:30 – H5:00** | **Rehearsal & Video** | Record a 2-minute backup demo video. |
