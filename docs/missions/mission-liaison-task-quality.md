# LIAISON Task Quality Gates — How to Create Tasks That Agents Can Execute

**Ref:** MISSION-LIAISON-TASK-QUALITY
**Version:** v1.1.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — second iteration, PDSA-first gate + A2A enforcement TODO

<!-- @section: problem | v:1 -->
## Problem Statement

During MISSION-TASK-VIEW-UX, LIAISON created 6 tasks. Thomas challenged: "Did you use rich DNA? Are there gaps between tasks and the mission?"

The answer was no on both counts:
1. **DNA was thin.** Missing stakeholder, constraints, file paths, embedded context. An agent picking up the task would need to go read the mission — violating the self-contained principle.
2. **Decisions without tasks.** 7 decisions in the mission, only 5 had tasks. D2 (structural comments) and D3 (ux-state.yaml) were completely forgotten.
3. **Tasks auto-advanced.** The task announcer claimed and transitioned T1/T2 without any agent actually doing work.

This is a pattern problem, not a one-time mistake. LIAISON needs hard gates — questions that MUST be answered before a task is considered ready.

---

<!-- @section: reflection | v:1 -->
## Reflection: What Went Wrong

### 1. DNA was functional, not self-contained

The tasks had title, description, acceptance criteria, priority, dependencies. That looks complete. But they failed the self-contained test:

**Self-contained test:** Can an agent read ONLY the task DNA and do the work without reading anything else?

| Task | What was missing |
|------|-----------------|
| T1 (board-config schema) | The proposed schema from Research Task E — agent has to go read the mission |
| T3 (refactor kanban.js) | The 8 specific file locations to change — agent has to discover them |
| T4 (remove buttons) | WHY the buttons are broken (3 unnamed states, button/dropdown fight) — agent just removes buttons without understanding |
| T5 (cancelled to DONE) | The semantic argument (terminal vs non-terminal) — agent makes a config change without knowing why |

The fix was to embed the research findings, file paths, line numbers, and reasoning INTO the DNA. After enrichment, descriptions went from ~200 chars to 690-3000 chars.

### 2. Decisions-to-tasks mapping was not verified

The mission had 7 decisions. LIAISON created tasks for D1, D5, D6, D7 — and completely missed D2 and D3. This happened because task creation was done from memory of the decisions, not by systematically checking each decision.

**The gap detection is trivial if you do it:** List all decisions. For each, find the task. If no task → gap.

### 3. No stakeholder or constraints

Every task missed stakeholder ("who cares?") and constraints ("what are the limits?"). These seem optional but they're not:
- **Stakeholder** tells the agent who to optimize for. "Thomas sees 571 stuck tasks" is different from "agents need config access."
- **Constraints** prevent over-engineering. "Must work in browser without build step" stops an agent from introducing webpack.

---

<!-- @section: gates | v:1 -->
## LIAISON Task Creation Quality Gates

Before marking a task as ready, LIAISON MUST pass every gate. If any gate fails, the task is not ready.

### Gate 1: Self-Contained DNA (9 mandatory fields)

| Field | Question to answer | Fail example |
|-------|-------------------|--------------|
| title | What is this task in one sentence? | "Fix filters" (too vague) |
| description | Can an agent do the work reading ONLY this? | Description says "see mission for details" |
| acceptance_criteria | How does the agent verify they're done? | "It works" (not testable) |
| stakeholder | Who cares about this and why? | Missing entirely |
| priority | How urgent relative to other tasks? | Missing entirely |
| depends_on | What must be done first? | Not checked against other tasks |
| constraints | What are the technical limits? | Missing entirely |
| mission_ref | Which mission does this serve? | Missing entirely |
| decisions | Which decision(s) does this implement? | Missing entirely |

**Hard question:** "If I give this DNA to an agent who has never seen the mission, can they do the work?"

### Gate 2: Embedded Context

The description MUST embed the relevant research findings, not reference them.

| Bad | Good |
|-----|------|
| "See Research Task E for the schema" | The full proposed schema embedded in the description |
| "Replace hardcoded values in kanban.js" | "Replace COLUMNS (lines 30-38), STATUS_COLORS (lines 46-53), ROLE_COLORS (lines 55-58), terminal checks (lines 78, 82, 130, 151)" |
| "Remove the buttons" | "Remove Active button (kanban.html:21), All button (kanban.html:22), button handler (kanban.js:336-344). Reason: buttons and dropdown fight — changing dropdown deactivates buttons, clicking button doesn't sync dropdown." |

**Hard question:** "Does the description contain file paths, line numbers, and the reasoning — or just a summary?"

### Gate 3: Decision Coverage

After creating all tasks, LIAISON MUST verify:

```
For each decision D1..Dn in the mission:
  Find task(s) that implement this decision
  If no task → GAP — create the task
```

**Hard question:** "Is there any decision in the mission that has no corresponding task?"

### Gate 4: Dependency Verification

For each task with depends_on:
- Does the dependency task exist?
- Is the dependency's output the input this task needs?
- Could this task start without the dependency? If yes, remove the dependency.

For each task without depends_on:
- Does it truly have no prerequisites?
- Could it produce conflicting changes with another task?

**Hard question:** "If the team starts T1 and T2 in parallel, will they step on each other?"

### Gate 5: Verification Protocol

For each task, LIAISON must define:
- **What** to verify (specific checks, not "verify it works")
- **How** to verify (grep, sandbox screenshot, file read — the actual command or action)
- **Evidence** format (screenshot, grep output, file content)

**Hard question:** "When this task comes back as 'done', what exactly will I check?"

### Gate 6: PDSA-First (Workflow Compliance)

Every task MUST start with `role=pdsa`. The PDSA Design Path (WORKFLOW.md v19) is:

```
pending → ready(pdsa) → active(pdsa) → approval(human) → approved
→ testing(qa) → ready(dev) → active(dev) → review chain → complete
```

DEV never receives a task directly. PDSA designs first. Human approves. QA writes tests. Then DEV implements.

**What LIAISON got wrong:** Created 5 tasks with `role=dev` — T3 (refactor kanban.js), T4 (remove buttons), T5 (cancelled to DONE), T7 (structural comments), T8 (ux-state.yaml). These skip PDSA design and human approval entirely.

**What should happen:** Each task starts as `role=pdsa`. PDSA produces the design (proposed_design in DNA). Task goes to `approval` for Thomas to review. After approval, the workflow engine routes to QA then DEV. The same task flows through the entire pipeline — you don't create separate pdsa/dev/qa tasks for the same work.

**Hard question:** "Is this task's initial role `pdsa`? If not, why does it skip design?"

Only exceptions:
- Liaison content tasks (WORKFLOW.md "Liaison Content Path"): `role=liaison`
- Tasks that are pure documentation with no design needed: still start pdsa for review

---

<!-- @section: todo | v:1 -->
## TODO: Enforcement via A2A

### The problem today

The A2A OBJECT_CREATE handler (`api/routes/a2a-message.ts:721-733`) has **zero validation** on task creation:
- No check that initial role = pdsa
- No check for required DNA fields (9 mandatory)
- No check that description is self-contained (length threshold)
- No check for stakeholder, constraints
- Accepts any role, any DNA, any status

LIAISON (me) and the A2A LIAISON agent both use the same endpoint. If the endpoint doesn't validate, both will make the same mistakes.

### The solution: A2A validation gate

Add validation to OBJECT_CREATE for tasks:

```javascript
// In handleObjectCreate, case 'task':
const dna = payload.dna || {};

// Gate 6: PDSA-first
if (dna.role && dna.role !== 'pdsa' && dna.role !== 'liaison') {
  return res.status(400).json({ 
    type: 'ERROR', 
    error: 'Tasks must start with role=pdsa (PDSA Design Path). DEV and QA receive work through the workflow, not direct assignment.' 
  });
}

// Gate 1: Required DNA fields
const required = ['title', 'description', 'acceptance_criteria', 'stakeholder', 'priority', 'constraints'];
const missing = required.filter(f => !dna[f]);
if (missing.length > 0) {
  return res.status(400).json({ 
    type: 'ERROR', 
    error: `Task DNA missing required fields: ${missing.join(', ')}. All 9 mandatory fields required.` 
  });
}

// Gate 2: Self-contained (minimum description length)
if (dna.description && dna.description.length < 200) {
  return res.status(400).json({ 
    type: 'ERROR', 
    error: `Task description too short (${dna.description.length} chars). Must be self-contained (>200 chars) with embedded context, file paths, and reasoning.` 
  });
}
```

This makes the A2A server enforce the same gates regardless of whether LIAISON is a human-session CLI agent or the autonomous A2A LIAISON agent. One set of rules, one enforcement point.

### Why A2A, not MCP

Thomas preference: A2A. Rationale:
- The A2A LIAISON agent and this CLI session both use the same A2A endpoint
- One validation gate covers all callers
- MCP would be a separate channel with separate rules — divergence risk
- A2A is already the protocol for all agent communication

### Status: Not yet implemented

This is documented as a TODO. The validation gate should be added to the A2A OBJECT_CREATE handler as part of a future mission. For now, LIAISON must self-enforce Gates 1-6 manually before calling OBJECT_CREATE.

---

<!-- @section: checklist | v:1 -->
## Pre-Flight Checklist

Before activating tasks for the team, LIAISON runs this checklist:

```
□ Every task starts with role=pdsa (PDSA-first, Gate 6)
□ Every decision has at least one task (Gate 3)
□ Every task has all 9 DNA fields (Gate 1)
□ Every description embeds context — file paths, line numbers, reasoning (Gate 2)
□ Every task passes the self-contained test (Gate 2)
□ Dependencies form a valid DAG — no cycles (Gate 4)
□ Only tasks with zero unresolved dependencies are set to ready (Gate 4)
□ Tasks stay at pending until team is activated — announcer auto-advances ready/rework/approval
□ Verification protocol defined for each task (Gate 5)
□ Tasks created in the correct system (BETA for development, PROD for mission tracking)
```

---

<!-- @section: antipatterns | v:1 -->
## Anti-Patterns (from MISSION-TASK-VIEW-UX)

| Anti-pattern | What happened | Prevention |
|-------------|--------------|------------|
| **Thin DNA** | 200-char descriptions, no file paths, no embedded context | Gate 1 + Gate 2: self-contained test |
| **Decision gaps** | D2, D3 had no tasks — 2 of 7 decisions lost | Gate 3: systematic check |
| **Missing stakeholder** | No task said who cares | Gate 1: mandatory field |
| **Missing constraints** | No task said what the limits are | Gate 1: mandatory field |
| **Auto-advance** | Task announcer claimed T1/T2 before agents existed | Set status to `pending` — announcer ignores pending. Only transition to `ready` when team is active. |
| **Reference, don't embed** | "See mission Research Task E" instead of embedding the schema | Gate 2: embedded context |
| **DEV tasks without PDSA** | T3-T5, T7-T8 created as role=dev, skipping PDSA design + approval | Gate 6: PDSA-first enforcement |

---

<!-- @section: iteration | v:1 -->
## Iteration Plan

This is v1.0.0 — the first articulation of what went wrong and how to prevent it. Expected iterations:

| Version | Trigger | What changes |
|---------|---------|-------------|
| v1.0.0 | MISSION-TASK-VIEW-UX reflection | Initial gates and checklist |
| v1.1.0 | Next mission execution | Refine based on what agents actually struggled with |
| v1.2.0 | Cross-project reuse | Generalize beyond Mindspace tasks |

The gates should become part of the workflow engine eventually — hard-coded validation that rejects tasks with missing DNA fields. But first, prove the pattern manually.
