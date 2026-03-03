# PDSA: Viz+Workflow Refactor — Loop Visualization, Agent Visibility, Version Symlinking

**Track:** visualization/workflow-loop-refactor
**Version:** v0.0.1
**Date:** 2026-03-03
**Status:** Plan
**Actor:** PDSA agent
**Task:** viz-workflow-loop-refactor

## Context

The mindspace viz (`viz/index.html`) currently renders tasks as a top-down funnel with 6 horizontal sections: QUEUE → ACTIVE → REVIEW → APPROVED → COMPLETE → BLOCKED. But the actual workflow (WORKFLOW.md v15) is a **loop** — tasks cycle through rework, re-review, and multi-role review chains. The funnel hides the loop nature, making it impossible to see where tasks are cycling.

Additionally, tasks in the section areas show status color but NOT which agent is assigned. Thomas needs at-a-glance visibility: "task X is with PDSA, task Y is with QA".

Finally, the viz directory is flat — no versioning, no rollback capability. Thomas requires symlink-to-active-version pattern for instant rollback.

## Problem Statement

1. **Visual model is wrong.** The funnel implies a linear flow but the workflow has 4+ rework re-entry points and a 3-stage review chain. Tasks visually "disappear" from ACTIVE and reappear in QUEUE on rework — the looping is invisible.
2. **Agent assignment invisible.** Tasks in section areas (QUEUE, ACTIVE, REVIEW, etc.) show status color and title but not the `dna.role` field. Only the stations at the top show agent_id, and only for the one task currently held. The other 5-10 tasks in review/rework show no role attribution.
3. **No versioning.** `viz/` is a flat directory. Any change to `index.html` or `server.js` is immediately live. No way to roll back without git revert.

## Current State (Investigation)

### Visual Layout (index.html)

```
┌──────────────────────────────────────────────────┐
│ STATIONS (y:20)                                   │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ LIAISON │ │  PDSA   │ │   DEV   │ │   QA    │ │
│ │[agent]  │ │[agent]  │ │[agent]  │ │[agent]  │ │
│ │ task    │ │ task    │ │ task    │ │ task    │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
├──────────────────────────────────────────────────┤
│ QUEUE (y:250)    [pending, ready, rework]         │
│ ┌─────┐ ┌─────┐ ┌─────┐                         │
│ │task │ │task │ │task │ ...                      │
│ └─────┘ └─────┘ └─────┘                         │
├──────────────────────────────────────────────────┤
│ ACTIVE (y:360)   [active, testing]                │
├──────────────────────────────────────────────────┤
│ REVIEW (y:470)   [review, approval]               │
├──────────────────────────────────────────────────┤
│ APPROVED (y:580) [approved]                       │
├──────────────────────────────────────────────────┤
│ COMPLETE (y:670) [complete]                       │
├──────────────────────────────────────────────────┤
│ BLOCKED (y:760)  [blocked, cancelled]             │
└──────────────────────────────────────────────────┘
```

**Key observations:**
- `renderSection()` places tasks in a grid (8 columns × N rows) within each section band
- Tasks are filtered by status array, NOT by role
- Each task shows: status color (CSS class), type badge (3-char), title (truncated 12 chars), project badge (multi-project mode)
- `renderStations()` renders 4 agent boxes horizontally, each showing `current_object_id` as an embedded package
- `renderPackageInStation()` renders the one actively-held task inside the station box
- The server exports `stations` table with `role, name, agent_id, current_object_id, status`

### Workflow Loop (WORKFLOW.md v15)

The actual flow has these loop paths:

```
pending → ready+pdsa → active+pdsa → approval → approved → active+qa → testing
                ↑ rework                                                    │
                └────────────────────────────────────────────── rework+pdsa ┘
                                                                    │
                                                              ready+dev →─┐
                                                                          │
                          rework+dev ← review+qa ← active+dev ←──────────┘
                               │           │
                               └──►active──┘
                                              review+qa → review+pdsa → review+liaison → complete
                                                                                           │
                                                                              rework ←─────┘
```

Key loops:
- `rework+pdsa → active+pdsa → approval → ...` (full restart from PDSA)
- `rework+dev → active+dev → review+qa → ...` (dev restart)
- `rework+qa → active+qa → testing → ...` (QA restart)
- `complete → rework+{role}` (human reopen)

### Directory Structure

```
viz/
├── index.html          (41KB, monolithic)
├── server.js           (11.5KB)
├── agent-monitor.cjs   (11.5KB)
├── pm-status.cjs       (6KB)
├── *.test.ts           (test files)
├── export-data.js
├── start-server.sh
└── data.json           (static fallback)
```

No `versions/` directory. No symlinks. No rollback capability.

## Plan

### Sub-Problem 1: Loop Visualization

**Approach: Replace vertical funnel with circular/loop layout.**

The current 6-section vertical funnel has fixed Y positions. Replace with a loop topology that shows the cyclic nature of the workflow.

**Proposed layout: Circular workflow ring**

```
                    ┌─────────┐
              ┌─────│  QUEUE  │─────┐
              │     │ pending │     │
              │     │  ready  │     │
              │     │ rework  │     │
              │     └─────────┘     │
              │          │          │
              │          ▼          │
     ┌────────┤    ┌─────────┐     │
     │ BLOCKED│    │ ACTIVE  │     │
     │blocked │    │ active  │     │
     │canceld │    │ testing │     │
     └────────┘    └─────────┘     │
                        │          │
                        ▼          │
              ┌─────────────────┐  │
              │     REVIEW      │  │
              │ review+qa       │  │
              │ review+pdsa     │  │
              │ review+liaison  │  │
              │ approval        │  │
              └────────┬────────┘  │
                       │           │
              ┌────────▼────────┐  │
              │    APPROVED     │  │
              │   approved      │  │
              └────────┬────────┘  │
                       │           │
              ┌────────▼────────┐  │
              │    COMPLETE     │──┘ (rework loops back to QUEUE)
              │   complete      │
              └─────────────────┘
```

**But more importantly: show the LOOP ARROWS.**

The key insight is not just rearranging boxes — it's adding **visible flow arrows** showing:
1. The forward path: QUEUE → ACTIVE → REVIEW → APPROVED → COMPLETE
2. The rework loops: REVIEW → QUEUE (via rework), COMPLETE → QUEUE (via reopen)
3. The review chain: review+qa → review+pdsa → review+liaison (sub-steps within REVIEW)

**Implementation approach:**

Instead of the 6 horizontal bands, render:
- A **central ring** of status areas arranged in a roughly circular/racetrack shape
- **Flow arrows** (SVG paths) connecting the areas showing forward flow AND rework loops
- **Rework arrows** in a different color (e.g., orange) looping back from REVIEW/COMPLETE to QUEUE
- Station boxes remain at top or along the side for agent visibility

**Minimal change approach** (recommended for v0.0.1):
- Keep the 6 sections but **add flow arrows** between them
- Add a **rework arrow** that visually loops from REVIEW back to QUEUE
- Add a **reopen arrow** from COMPLETE back to QUEUE
- This preserves the existing rendering logic while adding the loop visualization

**CONFIG changes:**
```javascript
// Add flow arrows configuration
const FLOW_ARROWS = [
  { from: 'queue', to: 'active', color: '#22c55e', label: 'claim' },
  { from: 'active', to: 'review', color: '#22c55e', label: 'submit' },
  { from: 'review', to: 'approved', color: '#22c55e', label: 'approve' },
  { from: 'approved', to: 'active', color: '#3b82f6', label: 'ready(dev)' },
  { from: 'review', to: 'queue', color: '#f59e0b', label: 'rework', curved: true },
  { from: 'complete', to: 'queue', color: '#ef4444', label: 'reopen', curved: true },
];
```

**New `renderFlowArrows()` function:**
- Draws SVG `<path>` elements between section areas
- Forward arrows on the right side (straight)
- Rework/reopen arrows on the left side (curved, different color)
- Each arrow labeled with transition name

### Sub-Problem 2: Agent Visibility

**Approach: Add role badge to every task in section rendering.**

Currently `renderSection()` renders tasks without role info. The `dna.role` field exists on every task.

**Changes to `renderSection()`:**

Add a role badge to each rendered package:
```javascript
// After title label, before project badge
const role = node.dna?.role;
if (role) {
  const roleBadge = createSVGElement('text', {
    x: x + CONFIG.queuePackageWidth - 5,
    y: y + 12,
    'text-anchor': 'end',
    'font-size': '9px',
    'font-weight': '600',
    fill: ROLE_COLORS[role] || '#888'
  });
  roleBadge.textContent = role.toUpperCase();
  g.appendChild(roleBadge);
}
```

**Role color mapping:**
```javascript
const ROLE_COLORS = {
  liaison: '#e94560',  // red (matches existing accent)
  pdsa: '#22c55e',     // green
  dev: '#3b82f6',      // blue
  qa: '#f59e0b',       // amber
};
```

**Also enhance `renderPackageInStation()`:**
- Add role label to station-held packages (currently only shows title)
- This makes station + role visible in one glance

**Detail panel already shows role** (line 1161: `dna.role || '-'`), so no change needed there.

**Review chain visibility:**

In the REVIEW section, tasks appear as `review` regardless of which review stage (qa/pdsa/liaison). With the role badge, Thomas can now see:
- `review` + `QA` badge = QA reviewing dev implementation
- `review` + `PDSA` badge = PDSA verifying design match
- `review` + `LIAISON` badge = liaison presenting to human

This solves the "which agent is on what" problem.

### Sub-Problem 3: Version Symlinking

**Approach: Directory restructuring with symlink pattern.**

Current `viz/` → restructure to:

```
viz/
├── versions/
│   └── v0.0.1/
│       ├── index.html
│       ├── server.js
│       └── start-server.sh
├── active -> versions/v0.0.1     (symlink)
├── agent-monitor.cjs             (stays at root — not versioned, it's infrastructure)
├── pm-status.cjs                 (stays at root — infrastructure)
├── export-data.js                (stays at root — utility)
├── data.json                     (stays at root — static fallback)
└── *.test.ts                     (stay at root — test infrastructure)
```

**What gets versioned (the "deployable"):**
- `index.html` — the UI
- `server.js` — the API server
- `start-server.sh` — the launcher

**What stays at root (infrastructure, not versioned):**
- `agent-monitor.cjs` — monitoring tool, runs independently
- `pm-status.cjs` — status tool, runs independently
- `export-data.js` — utility
- `data.json` — static fallback
- `*.test.ts` — test files

**How it works:**
1. `active` symlink points to `versions/v0.0.1`
2. `start-server.sh` updated to: `node viz/active/server.js`
3. New version: create `versions/v0.0.2/`, copy+modify files
4. Deploy: `ln -sfn versions/v0.0.2 viz/active`
5. Rollback: `ln -sfn versions/v0.0.1 viz/active`

**Migration steps:**
1. Create `viz/versions/v0.0.1/`
2. Copy `index.html`, `server.js`, `start-server.sh` into it
3. Create `viz/active` symlink → `versions/v0.0.1`
4. Update `start-server.sh` at root to delegate to `active/start-server.sh`
5. Keep originals in place temporarily for backward compat (remove in v0.0.2)

**Server.js path resolution:**
`server.js` uses `__dirname` for static file serving. When it runs from `viz/active/` (which resolves to `viz/versions/v0.0.1/`), `__dirname` will correctly point to the version directory. The `index.html` is in the same directory, so static serving works without changes.

**WORKSPACE_PATH stays hardcoded** in server.js for now — that's a separate concern (project-discovery task).

### Acceptance Criteria Mapping

| AC | Sub-Problem | How Met |
|----|-------------|---------|
| Viz shows loop-based workflow | 1 | Flow arrows + rework/reopen loop arrows added to existing sections |
| Each task shows assigned agent | 2 | Role badge (color-coded, uppercase) on every task package |
| Status + agent visible at a glance | 2 | Role badge renders next to type badge in section packages |
| Version symlinking: active symlink | 3 | `viz/active` → `viz/versions/v0.0.1` symlink |
| New versions built in parallel | 3 | `viz/versions/v0.0.2/` created alongside |
| Rollback is instant | 3 | `ln -sfn versions/v0.0.1 viz/active` |
| Lazy versioning refactoring applied | 3 | Track structure + symlink pattern |
| Brain synced with architectural decisions | — | Brain contribution after design approval |

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `viz/versions/v0.0.1/index.html` | CREATE | Copy of current + flow arrows + role badges |
| `viz/versions/v0.0.1/server.js` | CREATE | Copy of current server.js |
| `viz/versions/v0.0.1/start-server.sh` | CREATE | Copy of current start-server.sh |
| `viz/active` | CREATE | Symlink → `versions/v0.0.1` |
| `viz/start-server.sh` | EDIT | Delegate to `active/start-server.sh` |
| `viz/index.html` | EDIT | Add flow arrows + role badges (pre-versioning) |

### Risk Assessment

- **Low risk:** Flow arrows are additive — existing section rendering unchanged
- **Low risk:** Role badges are additive — existing package rendering unchanged
- **Medium risk:** Symlink pattern changes how server.js resolves `__dirname`. Test before deploying.
- **No risk:** Test files stay at root, unaffected

### Implementation Order

1. **First: Role badges** (Sub-Problem 2) — smallest change, biggest value for Thomas
2. **Second: Flow arrows** (Sub-Problem 1) — additive SVG rendering
3. **Third: Version symlinking** (Sub-Problem 3) — directory restructuring, done last

## Do

_To be filled during implementation_

## Study

_To be filled after implementation_

## Act

_To be filled after study_
