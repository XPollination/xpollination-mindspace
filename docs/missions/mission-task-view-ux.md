# Task View UX — Filtering, State Visibility, and Agent Awareness

**Ref:** MISSION-TASK-VIEW-UX
**Version:** v1.0.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — research phase

<!-- @section: progression | v:1 -->
## Mission Progression

| # | Mission | What it built | What it revealed |
|---|---------|--------------|-----------------|
| 1 | Runner Architecture | Interactive terminals, team panel, +1 buttons | UI exists but agent doesn't see what human sees |
| 2 | A2A Agent Delivery | Config-driven workflow, DELIVER handler | No task creation UI. Agents assume UX state. |
| 3 | SSE Delivery Channel | SSE bridges, real-time team updates, TC-1 in 90s | Prod vs beta divergence. Filters broken. |
| 4 | **This mission** | — | — |

---

<!-- @section: problem | v:1 -->
## Problem Statement

### What Thomas reported
1. "Active" and "All" buttons are redundant
2. "+1 day" filter doesn't work as intended
3. "This all does not work as it was intended"

### What LIAISON observed (sandbox audit 2026-04-07)

**PROD (mindspace.xpollination.earth/kanban):**
- 5 columns: Queue, Active, Review, Approved, Done
- Missing columns: Rework, Blocked (defined in WORKFLOW.md)
- Missing: completed-tasks filter dropdown (Active only / +1d / +7d / +30d / All)
- Missing: team panel (+Full Team, +1 role buttons)
- Present but redundant: Active/All toggle buttons
- Stats: "1 active / 616 total"
- No task creation mechanism

**BETA (beta-mindspace.xpollination.earth/kanban):**
- 7 columns: Queue, Active, Review, Approved, Rework, Blocked, Done
- Has completed-tasks dropdown: Active only, +1 day, +7 days, +30 days, All
- Has team panel with spawn buttons
- Same redundant Active/All toggle buttons
- Stats: "0 active / 572 total"

**Delta between prod and beta:**
- Prod is missing 2 columns, completed filter, and team panel
- Both have the redundant Active/All buttons

### What agents don't know
Agents working on the kanban have NO way to know:
- What the user actually sees in the UI
- Whether their changes are reflected
- If filters hide their work from the user
- What columns exist and what they represent

This is the "silent divergence" from the Structure, Not Retrieval reflection: agent and human think they share context. They don't.

---

<!-- @section: research-a | v:1 -->
## Research Task A: Documentation That IS Knowledge

**Question:** How should code-level documentation be structured so it PRODUCES the knowledge that agents need to understand the interface?

### Current state
- UI components have NO documentation
- kanban.js is 600+ lines with no structural markers
- Column definitions are hardcoded in JS
- Filter logic is scattered across multiple event handlers
- An agent reading the code can figure out what exists — but can't know what the user SEES

### Requirement (from brain: 9 mandatory sections)
1. **ID** — unique reference
2. **Title** — human-readable
3. **Description** — what and why
4. **Acceptance criteria** — how to verify
5. **Stakeholder** — who cares
6. **Priority** — how urgent
7. **Dependencies** — what blocks
8. **Constraints** — technical limits
9. **Provenance** — where it came from

### Proposed approach
Each UI component gets a **structural comment block** at the top of its section:

```javascript
// @component: kanban-filter
// @description: Controls which tasks are visible in the board
// @user-sees: Two buttons (Active/All) + dropdown (Active only/+1d/+7d/+30d/All)
// @behavior: Active = non-terminal tasks. All = includes completed. Dropdown controls completed window.
// @columns: Queue(pending,ready,rework), Active(active,testing), Review(review,approval), Approved(approved), Rework(rework), Blocked(blocked), Done(complete)
// @known-issues: Active/All buttons overlap with completed dropdown functionality
// @last-verified: 2026-04-07 via Chrome CDP sandbox
```

Agents read these markers. They know what the user sees without reading 600 lines of code. When the UI changes, the marker is updated in the same commit.

---

<!-- @section: research-b | v:1 -->
## Research Task B: Filtering UX Flow

### Current filtering controls (beta)

| Control | Type | Values | What it does |
|---------|------|--------|-------------|
| Project filter | Dropdown | All Projects, xpollination-mindspace, ... | Filters tasks by project |
| Search | Text input | Free text | Filters by title match |
| **Active button** | Toggle | Active (blue) / not active | When active: shows tasks NOT in complete/cancelled |
| **All button** | Toggle | All / not active | When active: shows ALL tasks including completed |
| **Completed filter** | Dropdown | Active only, +1 day, +7 days, +30 days, All | Controls how many completed tasks to show |
| Liaison mode | Dropdown | Manual, Semi, Auto-Approval, Autonomous | Controls LIAISON approval behavior |

### The redundancy problem

"Active" button + "Active only" in dropdown = same thing said twice.
"All" button + "All" in dropdown = same thing said twice.

The "+1 day / +7 days / +30 days" options have NO equivalent in the Active/All buttons. These are the USEFUL options that the buttons can't express.

### Proposed simplification

**Remove** the Active/All buttons. **Keep** the completed-tasks dropdown. Add clearer labels:

| Option | Shows |
|--------|-------|
| Active tasks | Tasks in queue, active, review, approved, rework, blocked |
| + Completed (1 day) | Active + tasks completed in last 24h |
| + Completed (7 days) | Active + tasks completed in last week |
| + Completed (30 days) | Active + tasks completed in last month |
| All tasks | Everything including old completed tasks |

One control instead of two overlapping controls.

### Columns mapping to WORKFLOW.md

| Column | Statuses | From WORKFLOW.md |
|--------|----------|-----------------|
| QUEUE | pending, ready | Waiting to be claimed |
| ACTIVE | active, testing | Work in progress |
| REVIEW | review, approval | Being reviewed/approved |
| APPROVED | approved | Human approved, awaiting next step |
| REWORK | rework | Returned for fixes |
| BLOCKED | blocked | Paused (external issue) |
| DONE | complete, cancelled | Finished |

WORKFLOW.md defines 11 statuses. The kanban maps them to 7 columns. This mapping MUST be documented so agents know where tasks appear.

---

<!-- @section: research-c | v:1 -->
## Research Task C: Agent UX Awareness

**Problem:** Agents can't see the interface. They operate on DB state and assume UI state.

### Current gap examples
- Agent transitions task to "rework" → user on prod doesn't see it (no Rework column on prod)
- Agent creates a task → user has no way to find it in UI (no create button, no notification)
- Agent changes filter logic → no documentation of what the user now sees differently

### Proposed mechanism: UX State Document

A machine-readable document that describes the CURRENT UI state. Updated on every deployment. Agents read it before making UI-facing decisions.

```yaml
# ux-state.yaml — what the user sees right now
last_verified: 2026-04-07
verified_by: LIAISON via Chrome CDP

pages:
  kanban:
    url: /kanban
    toolbar:
      - project_filter: dropdown, values: [all, project slugs]
      - search: text input
      - completed_filter: dropdown, values: [active, 1d, 7d, 30d, all]
      - liaison_mode: dropdown, values: [manual, semi, auto-approval, autonomous]
      - team_panel: [+Full Team, +Liaison, +PDSA, +Dev, +QA]
    columns: [Queue, Active, Review, Approved, Rework, Blocked, Done]
    status_mapping:
      Queue: [pending, ready]
      Active: [active, testing]
      Review: [review, approval]
      Approved: [approved]
      Rework: [rework]
      Blocked: [blocked]
      Done: [complete, cancelled]
    task_creation: not_available
    known_issues:
      - "Active/All buttons overlap with completed filter"
      - "Prod missing Rework + Blocked columns"
```

---

<!-- @section: tests | v:1 -->
## Test Cases

### TC-UX-1: Completed filter replaces Active/All buttons
```
GIVEN: Kanban open
WHEN: Active/All buttons are removed
AND: Completed filter dropdown is the only filter control
THEN: Default shows active tasks (non-terminal)
AND: User can switch to include completed tasks (+1d, +7d, etc.)
AND: No redundancy in filter controls
```

### TC-UX-2: All 7 columns visible
```
GIVEN: Kanban open
THEN: 7 columns visible: Queue, Active, Review, Approved, Rework, Blocked, Done
AND: Each column shows correct task count
AND: Column mapping matches WORKFLOW.md status definitions
```

### TC-UX-3: Agent reads UX state
```
GIVEN: ux-state.yaml exists in the repo
WHEN: Agent needs to understand what user sees
THEN: Agent reads ux-state.yaml instead of parsing 600 lines of JS
AND: Agent's understanding matches reality (verified via Chrome CDP)
```

### TC-UX-4: Prod/beta parity
```
GIVEN: Feature deployed to beta and verified
WHEN: Feature deployed to prod
THEN: Same columns, same filters, same team panel
AND: No regression from beta features
```

---

<!-- @section: decisions | v:1 -->
## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Remove Active/All buttons | Redundant with completed-tasks dropdown. One control, not two. |
| D2 | Structural comments in code | Agent reads markers, not 600 lines. Updated in same commit as code change. |
| D3 | ux-state.yaml for agent awareness | Machine-readable. Verified via sandbox. Single source of truth for what user sees. |
| D4 | Column mapping documented | WORKFLOW.md defines statuses. Kanban maps to columns. Both must agree. |
