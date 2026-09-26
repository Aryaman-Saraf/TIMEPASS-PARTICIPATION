# Workspace Agent Rules & Behavioral Guidelines

## 1. Unbiased Prompting & Autonomous Planning Delegation
- **No Presumptive or Biased Injections**: Never prescribe unsolicited designs, specific schedules, pre-allocated role breakdowns, or architectural assumptions unless explicitly instructed by the user.
- **Clarification Requirement**: Always ask the user for confirmation before introducing external concepts, structural constraints, or scheduling methodologies not requested.
- **Autonomous Delegation**: When instructed to delegate planning to Claude or another planning agent, provide only the core problem statement, objectives, and raw constraints. Let the planning agent autonomously analyze, divide the work, and formulate the plan without steering or imposing pre-made schedules.

## 2. File Protection & Archiving Policy
- **Absolute Hard Rule — Never Delete Any File**: Agents are strictly prohibited from deleting, truncating, or destructively overwriting any file, folder, asset, or data under any circumstances.
- **Archiving Over Deletion**: If a file needs to be removed or cleaned up from the active workspace, it must be relocated to an archive folder (e.g., `archive/` or `To Be Deleted/`). Never execute destructive removal commands (`rm`, `del`, `git clean -f`, etc.).

## 3. Git Commit Protocol (Commit Frequently, Push at End of Session)
- **Frequent Local Commits**: Every time a meaningful change or set of code/document updates is completed and verified, create a local git commit immediately to preserve progress and maintain a clean chronological history.
- **Controlled Remote Pushes**: Do NOT automatically push to remote after every local commit. Keep commits local during active iterative development, and push to the remote GitHub repository only:
  1. At the end of the session,
  2. At designated team checkpoints (e.g., Checkpoint 1, 2, 3), or
  3. When explicitly instructed by the user.
- **Branch Discipline**: Work on the assigned branch (`feat/aryaman-dev`). Never push broken, unverified code to `main`.

## 4. Chat Formatting & Text Rendering Protocol (Zero Broken LaTeX / Raw Math Syntax)
- **Zero LaTeX Syntax**: NEVER use LaTeX math syntax (`$...$`, `$$...$$`, `\text{...}`, `\times`, `\approx`, `\le`, `\ge`, `\mu`, `\text{ms}`) in chat responses. The chat interface renders raw Markdown and does NOT compile LaTeX, which causes code strings like `$score \ge 80$` to appear broken and unreadable.
- **Clean Unicode & Plain Text Typography**: Always use standard plain-text and native Unicode characters:
  - Percentages and metrics: `98%`, `p99 latency ≤ 85 ms`, `score ≥ 80` (never `$score \ge 80$`).
  - Standard math symbols: `≤`, `≥`, `~`, `±`, `≈`, `×`.
  - Units and angles: `ms`, `s`, `deg` / `°` (e.g., `yaw = 28°`, `pitch = -5°`).
- Keep all chat output visually clean, structured, and effortless to read using standard Markdown typography, bullet points, tables, and fenced code blocks.

## 5. Pre-Commit / Pre-Push Directory Cleanliness Protocol
- **Strict Root Cleanliness**: Before committing or pushing, ensure the workspace root contains only standard, essential project files:
  - Configuration & Setup: `package.json`, `.gitignore`, `.env.example`, `README.md`, `AGENTS.md`
  - Core Architecture Docs: `IMPLEMENTATION_PLAN.md`, `TEAM_TASKS.md`, `TEAM_ONBOARDING.md`, `TEAM_DIRECTIVES.md`
  - Core Engine & Server: `server.js`, `server.test.js`, `engine.js`, `engine.test.js`
- **Mandatory Subdirectory Organization**: No loose scratch scripts, temporary json dumps, test outputs, or stray files in root. Route all files to their dedicated directories:
  - Static Web Assets (HTML, CSS, client JS): `public/` (`index.html`, `room.html`, `room.js`, `report.html`, `report.js`, `integrity.js`, `styles.css`)
  - Session Seeds & Persistent Data: `data/` (`data/mock-session.json`, `data/sessions/`)
  - Project Documentation & Grading Sheets: `docs/` (`docs/PROJECT_MASTER_KNOWLEDGE_INDEX.md`, `docs/SESSION_CHANGES_STAGING.md`, briefs)
  - Teammate Raw Proposals & Superseded Drafts: `archive/`
  - Temporary Scratchpad / Ad-hoc Test Scripts: `scratch/`

## 6. Master Knowledge Index Document Maintenance Protocol
- **Continuous Documentation**: The master document `docs/PROJECT_MASTER_KNOWLEDGE_INDEX.md` must be maintained and updated whenever files are created, restructured, or milestones are achieved.
- **AI-Optimized Structure**: The document must maintain clear Markdown headings, file tables, purpose summaries, interface contract mappings (§4), dependency matrices, and decision history so any AI model or teammate can instantly navigate and comprehend repository state without context loss or hallucination.

## 7. Memanto Hierarchical Memory Sync Protocol (Mandatory)
- **Active Project Namespace**: `candor`
- **Global Inherited Namespace**: `aryaman-main`
- **Context Retrieval Before Prompting**: Before asking the user to clarify technical context, scoring weights, API shapes, or past architectural decisions, query Memanto via `recall` or `answer`.
- **Autonomous Milestone Sync**: When core architecture locks, API contracts are verified, or bug fixes are confirmed, stage the finding in `docs/SESSION_CHANGES_STAGING.md`. Sync to Memanto under the `candor` namespace in batch at the end of the session with user approval.
- **Universal Standards**: Universal developer preferences (never delete files, clean Unicode typography, zero broken LaTeX math) are inherited globally from `aryaman-main`.

## 8. Session Changes Staging Protocol & Batch End-of-Session Sync (Mandatory)
- **No Mid-Session Token Waste**: NEVER continuously update external knowledge vaults (Obsidian), Memanto, or master summaries during intermediate iterative turns of an active session. Doing so causes token waste, response latency, and context clutter.
- **Live Staging Document (`docs/SESSION_CHANGES_STAGING.md`)**: During an active session, maintain a clean chronological record of all file edits, decisions, test results, and actions in `docs/SESSION_CHANGES_STAGING.md`.
- **Explicit User Approval Before Final Sync**: Before executing final updates to Obsidian, Memanto, or master indices, ask the user explicitly for confirmation.
- **Batch Sync at End of Session**: Only after user approval at the end of the session, sync accumulated milestones across `docs/PROJECT_MASTER_KNOWLEDGE_INDEX.md`, Memanto, and Obsidian in a single clean batch.
