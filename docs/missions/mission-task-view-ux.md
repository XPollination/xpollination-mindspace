# Task View UX — Filtering, State Visibility, and Agent Awareness

**Ref:** MISSION-TASK-VIEW-UX
**Version:** v1.1.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — deep analysis complete

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

<!-- @section: research-b | v:2 -->
## Research Task B: Filtering UX Flow

### Current filtering controls (beta — verified 2026-04-07 via Chrome CDP)

| Control | Type | Values | What it does |
|---------|------|--------|-------------|
| Project filter | Dropdown (`#project-filter`) | All Projects, Runner Architecture Verification, XPollination Mindspace, Xpollination Governance | Filters tasks by project |
| Search | Text input (`#search`) | Free text | Filters by title/slug match |
| **Active button** | Toggle (`.filter-btn`, `data-filter="active"`) | Blue when active | Sets `currentFilter = 'active'` |
| **All button** | Toggle (`.filter-btn`, `data-filter="all"`) | Blue when active | Sets `currentFilter = 'all'` |
| **Completed filter** | Dropdown (`#completed-filter`) | Active only, + Last 1 day, + Last 7 days, + Last 30 days, All | Also sets `currentFilter` to same variable |
| Liaison mode | Dropdown (`#liaison-mode`) | Manual, Semi, Auto-Approval, Autonomous | Controls LIAISON approval behavior |
| Team panel | Buttons | +Full Team, +Liaison, +PDSA, +Dev, +QA | Spawns agents |
| Stats | Text | "0 active / 572 total" | Shows active vs total task counts |

### Deep analysis: How buttons and dropdown interact (sandbox-verified)

Both controls modify the **same variable** (`currentFilter`). They do NOT sync with each other.

**Button click handler** (kanban.js:336-343):
```javascript
btn.classList.add('active');
currentFilter = btn.dataset.filter; // 'active' or 'all'
// Does NOT update completedFilterEl.value
```

**Dropdown change handler** (kanban.js:350-355):
```javascript
currentFilter = completedFilterEl.value;
document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
// Deactivates BOTH buttons — UI shows no button highlighted
```

### Verified filter states (sandbox test matrix, 7 combinations)

| Action | Active btn | All btn | Dropdown | Visible cards | Problem |
|--------|-----------|---------|----------|---------------|---------|
| Initial (Active) | **on** | off | active | 0 (no active tasks) | — |
| Click All | off | **on** | active | 572 (all tasks) | Dropdown still says "Active only" — misleading |
| All + change to 1d | off | **off** | 1d | 0 | **Neither button highlighted.** User lost |
| Click Active | **on** | off | 1d | 0 | Dropdown still shows "1d" — state mismatch |
| Change to 7d | **off** | off | 7d | 0 | Clicking dropdown removes Active highlight |
| Change to "All" (dropdown) | off | off | all | 572 | **All button NOT highlighted** even though showing all tasks |
| Reset | off | off | active | 0 | Neither button active after reset |

### The three UX bugs

1. **Buttons and dropdown fight.** Changing dropdown deactivates buttons. Clicking button doesn't sync dropdown. User sees contradictory state.
2. **Three unnamed states.** (a) Active highlighted, (b) All highlighted, (c) Neither highlighted + dropdown controls. State (c) has no visual indicator — user doesn't know which filter is in effect.
3. **"+1 day" shows nothing because there are no active tasks.** The filter logic is: show non-terminal + terminal within N days. When 0 non-terminal exist and no tasks were completed recently, all options show 0. The feature is correct but useless without active tasks.

### The redundancy problem (confirmed)

"Active" button + "Active only" in dropdown = same `currentFilter = 'active'`.
"All" button + "All" in dropdown = same `currentFilter = 'all'`.

The "+1 day / +7 days / +30 days" options have NO equivalent in the Active/All buttons. These are the USEFUL options that the buttons can't express.

### Proposed simplification

**Remove** the Active/All buttons. **Keep** the completed-tasks dropdown as the single filter control. Add clearer labels:

| Option | Shows |
|--------|-------|
| Active tasks | Tasks in queue, active, review, approved, rework, blocked |
| + Completed (1 day) | Active + tasks completed in last 24h |
| + Completed (7 days) | Active + tasks completed in last week |
| + Completed (30 days) | Active + tasks completed in last month |
| All tasks | Everything including old completed tasks |

One control instead of two overlapping controls. No state conflicts. No unnamed states.

---

<!-- @section: research-d | v:1 -->
## Research Task D: Column Process Flow Analysis

### Columns: kanban.js vs WORKFLOW.md

| Column | kanban.js statuses | WORKFLOW.md Viz Category | Delta |
|--------|-------------------|--------------------------|-------|
| QUEUE | pending, ready | QUEUE: pending, ready, **rework** | **Mismatch:** workflow puts rework in QUEUE |
| ACTIVE | active, testing | ACTIVE: active, testing | Match |
| REVIEW | review, approval | REVIEW: review, approval | Match |
| APPROVED | approved | APPROVED: approved | Match |
| REWORK | rework | *(not defined)* | **Kanban adds this column** |
| BLOCKED | blocked, **cancelled** | BLOCKED: blocked, cancelled | Match (but semantically wrong) |
| DONE | complete | COMPLETE: complete | Match (name differs) |

### Analysis: Should REWORK have its own column?

WORKFLOW.md says rework belongs in QUEUE. The kanban has a dedicated REWORK column.

**Argument for REWORK column (kanban's current approach):**
- Rework tasks have different urgency than new tasks — they represent returned work
- Mixing "waiting to start" (QUEUE) with "needs fixes" (rework) hides urgency
- A dedicated column gives immediate visibility to tasks that need attention
- UX best practice: separate visual signal for "action needed" vs "waiting"

**Argument against (WORKFLOW.md approach):**
- Rework is just a re-entry to the flow — semantically it IS a queue
- More columns = more horizontal scrolling
- PDSA design path shows rework → active as a simple re-claim

**Recommendation:** Keep the REWORK column. It provides better visibility. Update WORKFLOW.md to match.

### Analysis: Should cancelled be in BLOCKED?

Current: `cancelled` is mapped to BLOCKED column.
WORKFLOW.md: Agrees — puts cancelled in BLOCKED category.

**But this is semantically wrong:**
- BLOCKED = paused, will resume → blocked tasks have `blocked_from_state` + `blocked_from_role`
- CANCELLED = terminal, will not resume → cancelled is a final state like complete
- A user seeing 571 "CANCELLED" cards in the BLOCKED column thinks 571 tasks are stuck. They're not stuck — they're done.

**2026 UX best practice:** Terminal states (complete, cancelled) should be visually grouped. Non-terminal states should not mix with terminal ones.

**Recommendation:** Move `cancelled` from BLOCKED to DONE. Both are terminal. The DONE column becomes "finished work" (complete + cancelled). The BLOCKED column becomes purely "paused work."

Updated column mapping:

| Column | Statuses | Description |
|--------|----------|-------------|
| QUEUE | pending, ready | Waiting to be claimed |
| ACTIVE | active, testing | Work in progress |
| REVIEW | review, approval | Being reviewed/approved |
| APPROVED | approved | Human approved, awaiting next step |
| REWORK | rework | Returned for fixes |
| BLOCKED | blocked | Paused (external issue) |
| DONE | **complete, cancelled** | Finished (completed or cancelled) |

### Columns mapping (current vs proposed)

| Column | Current (kanban.js:30-38) | Proposed | Change |
|--------|--------------------------|----------|--------|
| QUEUE | pending, ready | pending, ready | No change |
| ACTIVE | active, testing | active, testing | No change |
| REVIEW | review, approval | review, approval | No change |
| APPROVED | approved | approved | No change |
| REWORK | rework | rework | No change |
| BLOCKED | blocked, **cancelled** | blocked | **Remove cancelled** |
| DONE | complete | **complete, cancelled** | **Add cancelled** |

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

### TC-UX-4: Cancelled tasks in DONE, not BLOCKED
```
GIVEN: Kanban with completed and cancelled tasks
WHEN: Filter shows all tasks
THEN: Cancelled tasks appear in DONE column (not BLOCKED)
AND: BLOCKED column only contains actively blocked tasks
AND: Cancelled tasks are visually distinct from completed tasks (badge color)
```

### TC-UX-5: Filter state consistency
```
GIVEN: Kanban open with unified filter dropdown
WHEN: User selects any filter option
THEN: Current selection is always visually indicated
AND: No contradictory states (e.g., button says Active, dropdown says All)
AND: Filter state persists in sessionStorage
```

### TC-UX-6: Prod/beta parity
```
GIVEN: Feature deployed to beta and verified
WHEN: Feature deployed to prod
THEN: Same columns, same filters, same team panel
AND: No regression from beta features
```

---

<!-- @section: decisions | v:2 -->
## Decisions

| # | Decision | Rationale | Status |
|---|----------|-----------|--------|
| D1 | Remove Active/All buttons | Redundant with completed-tasks dropdown. Sandbox testing proved they fight: changing dropdown deactivates buttons, clicking buttons doesn't sync dropdown. Three unnamed states. | Proposed |
| D2 | Structural comments in code | Agent reads markers, not 600 lines. Updated in same commit as code change. | Proposed |
| D3 | ux-state.yaml for agent awareness | Machine-readable. Verified via sandbox. Single source of truth for what user sees. | Proposed |
| D4 | Column mapping documented | WORKFLOW.md defines statuses. Kanban maps to columns. Both must agree. | Proposed |
| D5 | Move `cancelled` from BLOCKED to DONE | Cancelled is terminal like complete. 571 cancelled tasks in BLOCKED column looks like 571 stuck tasks. Semantically wrong. | Proposed |
| D6 | Keep REWORK column (diverge from WORKFLOW.md) | Dedicated REWORK column gives better visibility than mixing with QUEUE. Different urgency signal. Update WORKFLOW.md to match kanban. | Proposed |
