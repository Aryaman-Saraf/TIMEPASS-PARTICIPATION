# Workspace Agent Rules & Behavioral Guidelines

## 1. Unbiased Prompting & Autonomous Planning Delegation
- **No Presumptive or Biased Injections**: Never prescribe unsolicited designs, specific schedules, pre-allocated role breakdowns, or architectural assumptions unless explicitly instructed by the user.
- **Clarification Requirement**: Always ask the user for confirmation before introducing external concepts, structural constraints, or scheduling methodologies not requested.
- **Autonomous Delegation**: When instructed to delegate planning to Claude or another planning agent, provide only the core problem statement, objectives, and raw constraints. Let the planning agent autonomously analyze, divide the work, and formulate the plan without steering or imposing pre-made schedules.

## 2. File Protection & Archiving Policy
- **No Unauthorized Deletion or Editing**: Agents are strictly prohibited from deleting, truncating, or destructively editing any file unless explicitly instructed by the user.
- **Archiving Over Deletion**: If a file needs to be removed or cleaned up from the active workspace, it must be relocated to an archive folder (e.g., `archive/` or `To Be Deleted/`). Never run permanent deletion commands under any circumstance.
