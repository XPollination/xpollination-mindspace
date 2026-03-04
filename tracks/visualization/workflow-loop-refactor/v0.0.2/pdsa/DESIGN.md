# PDSA: Viz Workflow Redesign — v0.0.2

## REWORK CONTEXT

> **Thomas feedback (2026-03-04, liaison_rework_reason_2):**
> "I like the addition of role badges and version symlinking but what I do not like are the loop arrows. It does not solve the usability and user interface. Rework for research a fully new solution of how to present the current workflow. Full re design."

Thomas APPROVED: role badges (role colors + badge styling) and version symlinking concept.
Thomas REJECTED: loop flow arrows (do not solve usability).
Thomas REQUIRED: remove non-process stations (Dev HOMEPAGE, Human HOMEPAGE, Liaison HOMEPAGE).

## PLAN

### Problem

The current viz uses a "warehouse" metaphor: 6 horizontal section bands stacked vertically, with tasks placed in grids inside each band. This is fundamentally a **funnel** model — but the workflow is a **loop**. Adding arrows on top of a funnel doesn't fix the model; it adds visual noise.

Thomas needs a UI that:
1. Naturally shows task flow AND rework loops without explicit arrows
2. Shows which agent is working on which task at a glance
3. Is clean — no non-process stations, no clutter

### Research: Visualization Approaches Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Kanban board** (columns per phase) | Universally understood, position IS state, rework = card moves back | Many statuses (11) need grouping | **Selected** |
| State machine diagram | Shows all transitions | Thomas rejected arrows; graph layout is noisy | Rejected |
| Timeline / swimlane | Good temporal view | Complex, not suited for real-time state | Rejected |
| Current funnel + arrows | Already built | Thomas rejected it | Rejected |

### Design: Kanban Board with Phase Columns

Replace the 6-band warehouse with a **horizontal Kanban board** where:
- Each column represents a workflow phase
- Tasks are cards within their current column
- Card position IS the state — no arrows needed
- Rework is natural: card appears back in an earlier column
- Agent assignment visible via role badges on cards (already approved)

#### Column Layout (5 columns, left-to-right)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  QUEUE   │  ACTIVE  │  REVIEW  │ APPROVED │ COMPLETE │
│          │          │          │          │          │
│ pending  │ active   │ review   │ approved │ complete │
│ ready    │ testing  │ approval │          │          │
│ rework   │          │          │          │          │
│          │          │          │          │          │
│ [cards]  │ [cards]  │ [cards]  │ [cards]  │ [cards]  │
└──────────┴──────────┴──────────┴──────────┴──────────┘
         BLOCKED (bottom bar, separate from main flow)
```

- **QUEUE**: pending, ready, rework — tasks waiting to be claimed
- **ACTIVE**: active, testing — someone is working on it
- **REVIEW**: review, approval — being evaluated (includes human gates)
- **APPROVED**: approved — passed gate, waiting for next phase
- **COMPLETE**: complete — done
- **BLOCKED**: blocked, cancelled — shown as a separate bottom bar (not a column — these are paused, not in flow)

#### Task Card Design

```
┌──────────────────────────┐
│ [PDSA] task-slug-name    │  ← role badge (color-coded, from v0.0.1)
│ project-name             │  ← project label
│ review+liaison           │  ← full status+role (e.g., "review+liaison")
│ ▸ 2m ago                 │  ← time since last update
└──────────────────────────┘
```

Card colors use the approved ROLE_COLORS from v0.0.1:
- LIAISON: red left-border (#ef4444)
- PDSA: green left-border (#22c55e)
- DEV: blue left-border (#3b82f6)
- QA: amber left-border (#f59e0b)

The left-border color instantly shows which agent owns the task.

#### What Gets Removed

1. **Flow arrows** (drawFlowArrows function, lines ~1165-1252) — DELETED
2. **Arrowhead marker defs** — DELETED
3. **Non-process stations** (Dev HOMEPAGE, Human HOMEPAGE, Liaison HOMEPAGE) — REMOVED from stations data and rendering
4. **Stations row at top** — REPLACED with agent status panel (see below)
5. **Warehouse section bands** (renderSection grid layout) — REPLACED with Kanban columns

#### Agent Status Panel (replaces stations row)

Instead of station boxes at the top, show a compact **agent status bar**:

```
┌─────────────────────────────────────────────────────────┐
│ LIAISON: idle │ PDSA: working on task-x │ DEV: idle │ QA: reviewing task-y │
└─────────────────────────────────────────────────────────┘
```

Each agent shows: role badge + current status + current task (if any).
This replaces the station boxes AND removes non-process stations (HOMEPAGE entries).

#### Detail Panel

Keep the existing detail panel (click a card → shows full DNA). Upgrade the Role field to use color-coded badge (already done in v0.0.1, keep it).

### Changes Required

1. **`viz/index.html`** (major rewrite of rendering):
   - Replace renderSection() with renderKanbanColumn()
   - Replace 6-band section layout with 5-column Kanban layout
   - Replace stations row with agent status bar
   - DELETE drawFlowArrows() function entirely
   - DELETE arrowhead SVG marker defs
   - KEEP: role badge colors, detail panel, task click handlers, polling logic, project selector
   - KEEP: settings panel, approval mode controls, confirm/rework buttons
   - CSS: Add Kanban column styles, card styles with left-border color

2. **`viz/server.js`** (minor):
   - Filter non-process stations from `/api/data` response (or mark them with `process: false`)
   - No new endpoints needed

3. **`viz/versions/v0.0.2/`** (versioned copy):
   - Copy updated index.html + server.js + start-server.sh
   - Update `viz/active` symlink to point to v0.0.2

4. **Tests** (update existing):
   - Remove flow arrow tests (AC-LOOP1-3)
   - Add Kanban column tests
   - Keep role badge tests (AC-AGENT1-4)
   - Keep version symlink tests (AC-VER1-3)

### What This Does NOT Do

- Does NOT add drag-and-drop (manual transitions still via CLI/API)
- Does NOT add swimlanes per project (projects shown on cards, not as lanes)
- Does NOT change the workflow engine or transitions
- Does NOT add performance analytics or WIP limits

### Acceptance Criteria (Updated for v0.0.2)

1. Viz shows Kanban board with 5 phase columns (QUEUE, ACTIVE, REVIEW, APPROVED, COMPLETE)
2. Tasks appear as cards in their correct column based on status
3. Each card shows role badge with approved color scheme
4. Rework tasks appear in QUEUE column (natural loop — no arrows needed)
5. Blocked/cancelled tasks shown in separate bottom bar
6. Agent status bar at top shows which agent is working on what
7. Non-process stations (HOMEPAGE entries) removed from UI
8. Flow arrows completely removed
9. Detail panel still works (click card → full DNA)
10. Version symlinking: v0.0.2 directory + active symlink updated

## DO

Implementation by DEV agent. Major changes to index.html (rewrite rendering), minor changes to server.js.

## STUDY

After implementation:
- Visual inspection: does the Kanban board make task flow intuitive?
- Agent visibility: can Thomas see who is working on what at a glance?
- Rework visibility: do rework tasks clearly appear back in QUEUE?
- Clean UI: no non-process stations, no arrows, no clutter?

## ACT

If Thomas approves: this becomes the standard viz pattern. If further refinement needed: iterate on card design and column grouping.
