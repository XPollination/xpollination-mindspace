# Task View UX — Filtering, State Visibility, and Agent Awareness

**Ref:** MISSION-TASK-VIEW-UX
**Version:** v1.2.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Ready — research complete, 6 tasks created, awaiting execution

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

**Current state (beta-mindspace.xpollination.earth/kanban):**
- 7 columns: Queue, Active, Review, Approved, Rework, Blocked, Done
- Completed-tasks dropdown: Active only, +1 day, +7 days, +30 days, All
- Team panel with spawn buttons (+Full Team, +Liaison, +PDSA, +Dev, +QA)
- Redundant Active/All toggle buttons alongside the dropdown
- Stats: "0 active / 572 total"
- 571 cancelled tasks appearing in BLOCKED column (semantically wrong)
- No task creation mechanism

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

### TC-UX-6: REWORK column visible and documented
```
GIVEN: Kanban open
THEN: REWORK column exists between APPROVED and BLOCKED
AND: Tasks with status 'rework' appear in REWORK column
AND: Column mapping matches updated WORKFLOW.md
```

---

<!-- @section: research-e | v:1 -->
## Research Task E: Kanban + Workflow as Reusable Pattern

### The opportunity

While touching this code, Thomas asked: how can the kanban board and workflow be abstracted so it works for Mindspace tasks today, but also for any other use case — rename the columns, define different gates, different roles?

### Current state: where the abstraction already exists

**The workflow engine IS already abstract.** `api/lib/workflow-engine.ts` reads `api/config/workflow.yaml` and provides validation, routing, and instruction building. The comment on line 1 says it: *"The engine is GENERIC — all process logic comes from the config."*

`workflow.yaml` defines:
- **Transitions:** `from_status → to_status` with actors, gates, events
- **Gates:** named validators with field + validation rule + error message
- **Role routing:** fixed roles, review chain
- **Instructions:** what each role does at each state

Change the YAML → change the workflow. No code changes. This is already separation of concerns on the backend.

### Current state: where the abstraction DOES NOT exist

**The kanban UI has domain knowledge hardcoded everywhere.**

| What | Where | Domain-specific? |
|------|-------|-----------------|
| Column definitions | `kanban.js:30-38` COLUMNS array | **Configurable** — but only at code level |
| Status colors | `kanban.js:46-53` STATUS_COLORS | **Hardcoded** — every status name is written out |
| Role colors | `kanban.js:55-58` ROLE_COLORS | **Hardcoded** — liaison, pdsa, dev, qa |
| Terminal status check | `kanban.js:78,82,130,151` `['complete','cancelled']` | **Hardcoded** — repeated 4 times |
| Filter logic | `kanban.js:73-101` filterTasks() | **Hardcoded** — assumes terminal = complete/cancelled |
| Blocked reason display | `kanban.js:153-154` | **Hardcoded** — checks `status === 'blocked'` |
| Active status check | `kanban.js:201` | **Hardcoded** — checks `status === 'active'` |
| Card CSS classes | `kanban.js:156` | **Hardcoded** — `.completed`, `.cancelled` |

The backend is a reusable engine. The frontend is a Mindspace-specific rendering.

### Reflection: What needs to change

The pattern has **three layers**:

```
┌─────────────────────────────────────────────┐
│  Layer 3: Domain Configuration              │
│  "Mindspace tasks use these columns,        │
│   these statuses, these gates, these roles"  │
│  ─ board-config.yaml (NEW)                  │
│  ─ workflow.yaml (EXISTS)                   │
├─────────────────────────────────────────────┤
│  Layer 2: Generic Kanban Board (UI)         │
│  "Render columns, cards, filters from       │
│   configuration. Emit events."              │
│  ─ kanban-board.js (REFACTOR from kanban.js)│
├─────────────────────────────────────────────┤
│  Layer 1: Generic Workflow Engine (API)     │
│  "Validate transitions, enforce gates,      │
│   route to roles from configuration."       │
│  ─ workflow-engine.ts (EXISTS)              │
│  ─ workflow.yaml (EXISTS)                   │
└─────────────────────────────────────────────┘
```

**Layer 1 (engine) — already done.** Config-driven. Reusable.

**Layer 2 (UI) — needs refactoring.** The kanban board should receive its configuration, not know it. What changes:

| Current (hardcoded) | Abstracted (from config) |
|---------------------|-------------------------|
| `const COLUMNS = [...]` | Read from `board-config.yaml` or API endpoint |
| `['complete','cancelled']` repeated 4x | `config.terminalStatuses` — defined once |
| `STATUS_COLORS = {...}` | `config.statuses[name].color` |
| `ROLE_COLORS = {...}` | `config.roles[name].color` |
| `status === 'blocked'` | `config.statuses[name].isBlocked` or `config.blockedStatuses` |
| `status === 'active'` | `config.statuses[name].isActive` or `config.activeStatuses` |
| Filter options hardcoded in HTML | Generated from config |

**Layer 3 (domain config) — new.** A configuration file that the board reads:

```yaml
# board-config.yaml — what the kanban board shows
# One per use case. Mindspace tasks, content pipeline, hiring, etc.

name: Mindspace Task Board
description: PDSA-driven agent task workflow

columns:
  - id: queue
    label: Queue
    statuses: [pending, ready]
    color: "#4CAF50"
  - id: active
    label: Active
    statuses: [active, testing]
    color: "#2196F3"
  # ...

statuses:
  pending:  { color: "#9E9E9E", terminal: false }
  ready:    { color: "#4CAF50", terminal: false }
  active:   { color: "#2196F3", terminal: false }
  complete: { color: "#4CAF50", terminal: true }
  cancelled:{ color: "#F44336", terminal: true }
  blocked:  { color: "#FF9800", terminal: false, showReason: true }
  # ...

roles:
  liaison: { color: "#FF9800", label: "Liaison" }
  pdsa:    { color: "#9C27B0", label: "PDSA" }
  dev:     { color: "#4CAF50", label: "Dev" }
  qa:      { color: "#2196F3", label: "QA" }

filters:
  - { value: "active", label: "Active tasks", showTerminal: false }
  - { value: "1d",     label: "+ Completed (1 day)", showTerminalDays: 1 }
  - { value: "7d",     label: "+ Completed (7 days)", showTerminalDays: 7 }
  - { value: "30d",    label: "+ Completed (30 days)", showTerminalDays: 30 }
  - { value: "all",    label: "All tasks", showTerminal: true }
```

### What a reuse looks like

A different project (e.g., content pipeline) defines its own config:

```yaml
name: Content Pipeline
columns:
  - id: ideas
    label: Ideas
    statuses: [draft, proposed]
  - id: writing
    label: Writing
    statuses: [writing, editing]
  - id: review
    label: Review
    statuses: [fact_check, editorial]
  - id: published
    label: Published
    statuses: [published]
    
statuses:
  draft:      { color: "#9E9E9E", terminal: false }
  proposed:   { color: "#FF9800", terminal: false }
  writing:    { color: "#2196F3", terminal: false }
  published:  { color: "#4CAF50", terminal: true }

roles:
  writer:  { color: "#2196F3", label: "Writer" }
  editor:  { color: "#9C27B0", label: "Editor" }

filters:
  - { value: "active", label: "In progress" }
  - { value: "all",    label: "All articles" }
```

Same kanban board component. Same workflow engine. Different configuration. Different columns, different gates, different roles.

### The separation of concerns principle

| Concern | Owns | Doesn't know about |
|---------|------|---------------------|
| **Board component** | Rendering columns, cards, filters, events | What statuses mean, what roles exist, what gates enforce |
| **Workflow engine** | Transition validation, gate enforcement, role routing | How the UI renders, which columns exist |
| **Domain config** | Status names, column mapping, role definitions, gate definitions | How rendering works, how validation is implemented |
| **CSS/theme** | Colors, spacing, typography | Business logic, status meaning |

### What this means for this mission

The filter fix (D1) and the cancelled-in-blocked fix (D5) should be implemented as **configuration changes**, not code changes. If the board reads its config from a file:

- D1 (remove Active/All buttons): `filters` section in config defines what controls exist
- D5 (move cancelled to DONE): change `columns` config — move `cancelled` from blocked to done
- D6 (keep REWORK column): already in config — just keep it

The code change becomes: **make kanban.js read from config instead of hardcoding**. Then all future column/filter/status changes are config-only.

---

<!-- @section: tasks | v:1 -->
## Task Breakdown

### Execution order (dependency chain)

```
                                                                      ┌──> ux-remove-filter-buttons (dev) ──┐
ux-board-config-schema (pdsa) ──> ux-kanban-config-driven (dev) ──────┼──> ux-cancelled-to-done (dev) ──────┼──> ux-sandbox-verification (qa)
                                                                      ├──> ux-structural-comments (dev)     ├──> ux-state-yaml (dev)
ux-workflow-rework-column (pdsa) ─────────────────────────────────────┘                                     │
                                                                                                            │
```

### Tasks (BETA system — 8 tasks, all with rich DNA)

| # | Slug | Role | Priority | Depends on | Decision | Status |
|---|------|------|----------|------------|----------|--------|
| 1 | `ux-board-config-schema` | pdsa | high | — | D7 | ready |
| 2 | `ux-workflow-rework-column` | pdsa | medium | — | D6 | ready |
| 3 | `ux-kanban-config-driven` | dev | high | T1 | D7 | pending |
| 4 | `ux-remove-filter-buttons` | dev | high | T3 | D1 | pending |
| 5 | `ux-cancelled-to-done` | dev | medium | T3 | D5 | pending |
| 6 | `ux-sandbox-verification` | qa | high | T4, T5 | — | pending |
| 7 | `ux-structural-comments` | dev | medium | T3 | D2 | pending |
| 8 | `ux-state-yaml` | dev | medium | T4, T5 | D3 | pending |

**Dependencies:**
- T1 + T2: no dependencies — can start immediately (both PDSA)
- T3: blocked by T1 — needs the schema before refactoring
- T4, T5, T7: blocked by T3 — need config-driven board first
- T6, T8: blocked by T4 + T5 — verify/document the end result

**Start state:** T1 and T2 ready for PDSA. All others pending until dependencies resolve.

**DNA richness:** All 8 tasks have: title, description (690-3000 chars), acceptance criteria, stakeholder, constraints, depends_on, mission_ref, decisions. Self-contained — agent reads DNA, not the mission.

---

<!-- @section: verification | v:1 -->
## LIAISON Verification Protocol

After each task completes, LIAISON verifies via Chrome CDP sandbox before transitioning forward.

### T1: `ux-board-config-schema` (PDSA → LIAISON reviews)

**What to verify:**
1. File `board-config.yaml` exists in `api/config/` or `viz/config/`
2. Schema has all required sections: `columns`, `statuses`, `roles`, `filters`
3. Each column has: `id`, `label`, `statuses[]`, `color`
4. Each status has: `color`, `terminal` (boolean)
5. `filters` array defines: `value`, `label`, `showTerminal` or `showTerminalDays`
6. Mindspace task board config is the first instance — all 7 columns, 11 statuses, 4 roles, 5 filter options
7. No overlap with `workflow.yaml` — board-config owns rendering, workflow.yaml owns transitions

**How to test:**
```
Read board-config.yaml → validate YAML parses → check all fields present → 
compare statuses against workflow.yaml → verify column-status mapping covers all 11 statuses
```

### T2: `ux-workflow-rework-column` (PDSA → LIAISON reviews)

**What to verify:**
1. WORKFLOW.md Visualization Categories has 7 entries (was 6)
2. REWORK is its own category with `[rework]`
3. COMPLETE/DONE category includes `[complete, cancelled]`
4. BLOCKED category has only `[blocked]`
5. No status is missing from any category (all 11 covered)

**How to test:**
```
Read WORKFLOW.md → find "Visualization Categories" table → 
verify 7 rows → verify rework is separate → verify cancelled is with complete
```

### T3: `ux-kanban-config-driven` (DEV → QA reviews → LIAISON verifies)

**What to verify:**
1. `kanban.js` imports/fetches board-config at init
2. No hardcoded status names remain in JS — grep for `'complete'`, `'cancelled'`, `'blocked'`, `'active'`, `'pending'`, `'ready'` as string literals
3. `COLUMNS` array reads from config
4. `STATUS_COLORS` and `ROLE_COLORS` read from config
5. `filterTasks()` uses `config.terminalStatuses` instead of `['complete','cancelled']`
6. Board still renders correctly on beta (sandbox screenshot)

**How to test:**
```
1. grep -c "'complete'" kanban.js → must be 0
2. grep -c "'cancelled'" kanban.js → must be 0
3. grep -c "'blocked'" kanban.js → must be 0
4. Sandbox: navigate to beta kanban → screenshot → verify 7 columns render
5. Sandbox: click filter options → verify cards appear/disappear correctly
```

### T4: `ux-remove-filter-buttons` (DEV → QA reviews → LIAISON verifies)

**What to verify:**
1. No `.filter-btn` elements in kanban HTML
2. No `data-filter` attributes in HTML
3. No `filter-btn` event handlers in JS
4. Dropdown `#completed-filter` is the only filter control
5. Dropdown options match config: Active tasks, + Completed (1 day), etc.
6. Visual: no contradictory states possible

**How to test (sandbox):**
```
1. Screenshot beta kanban → verify no Active/All buttons visible
2. Open dropdown → screenshot → verify 5 options with correct labels
3. Select each option → verify board updates correctly
4. Refresh page → verify filter state persists (sessionStorage)
```

### T5: `ux-cancelled-to-done` (DEV → QA reviews → LIAISON verifies)

**What to verify:**
1. In board-config.yaml: `done` column statuses include `cancelled`
2. In board-config.yaml: `blocked` column statuses do NOT include `cancelled`
3. Visual: cancelled tasks appear in DONE column, not BLOCKED

**How to test (sandbox):**
```
1. Read board-config.yaml → verify column mappings
2. Sandbox: set filter to "All tasks" → screenshot
3. Verify: BLOCKED column shows 0 or only truly blocked tasks
4. Verify: DONE column shows both complete and cancelled tasks
5. Verify: cancelled tasks have distinct visual badge (different color from complete)
```

### T6: `ux-sandbox-verification` (QA runs all TC-UX tests)

**What LIAISON verifies:** QA's test report covers all 6 TC-UX cases with screenshots as evidence.

| Test Case | What LIAISON checks in the report |
|-----------|----------------------------------|
| TC-UX-1 | Screenshot shows dropdown only, no buttons |
| TC-UX-2 | Screenshot shows 7 columns with correct labels |
| TC-UX-3 | board-config.yaml exists and matches what sandbox shows |
| TC-UX-4 | Screenshot with "All" filter: cancelled in DONE, not BLOCKED |
| TC-UX-5 | Screenshots of each filter option: selection always indicated |
| TC-UX-6 | Screenshot shows REWORK column between APPROVED and BLOCKED |

### T7: `ux-structural-comments` (DEV → LIAISON verifies)

**What to verify:**
1. `grep '@component' kanban.js` returns 3+ matches
2. Each block has `@description`, `@user-sees`, `@behavior`
3. `@config` references point to board-config.yaml
4. `@user-sees` accurately describes what sandbox shows

**How to test:**
```
grep '@component' kanban.js → count matches
For each @user-sees → compare text against sandbox screenshot
```

### T8: `ux-state-yaml` (DEV → LIAISON verifies)

**What to verify:**
1. File exists at `viz/config/ux-state.yaml`
2. Has `last_verified` date, `verified_by`, `pages.kanban` section
3. Toolbar controls match what sandbox shows
4. References board-config.yaml for columns/filters (no duplication)
5. `known_issues` is empty or accurately reflects real issues

**How to test (sandbox):**
```
Read ux-state.yaml → for each control listed → verify it exists in sandbox screenshot
Compare ux-state.yaml columns against board-config.yaml columns → must match
```

---

<!-- @section: decisions | v:3 -->
## Decisions

| # | Decision | Rationale | Status |
|---|----------|-----------|--------|
| D1 | Remove Active/All buttons | Redundant with completed-tasks dropdown. Sandbox testing proved they fight: changing dropdown deactivates buttons, clicking buttons doesn't sync dropdown. Three unnamed states. | Proposed |
| D2 | Structural comments in code | Agent reads markers, not 600 lines. Updated in same commit as code change. | Proposed |
| D3 | ux-state.yaml for agent awareness | Machine-readable. Verified via sandbox. Single source of truth for what user sees. | Proposed |
| D4 | Column mapping documented | WORKFLOW.md defines statuses. Kanban maps to columns. Both must agree. | Proposed |
| D5 | Move `cancelled` from BLOCKED to DONE | Cancelled is terminal like complete. 571 cancelled tasks in BLOCKED column looks like 571 stuck tasks. Semantically wrong. | Proposed |
| D6 | Keep REWORK column (diverge from WORKFLOW.md) | Dedicated REWORK column gives better visibility than mixing with QUEUE. Different urgency signal. Update WORKFLOW.md to match kanban. | Proposed |
| D7 | Abstract kanban board as config-driven reusable pattern | Backend engine is already config-driven (workflow.yaml). Frontend is not. Introduce board-config.yaml so columns, statuses, roles, filters are configuration, not code. Same component, different config = different board for any use case. | Proposed |
