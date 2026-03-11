# PDSA: Viz Mission Dashboard — Capability Dependency Graph

**Task:** h1-5-viz-mission-dashboard
**Version:** v0.0.1
**Status:** Design

## Plan

### Goal

Add a "Mission" view to the viz dashboard showing the 10 seeded capabilities as a dependency graph. Each capability node displays title, progress percentage, and status color. Clicking a capability drills down (future task h1-6).

### Existing Infrastructure

- **Capabilities API**: `GET /api/projects/:projectSlug/capabilities` — list all capabilities (supports `?mission_id=` filter)
- **Progress API**: `GET /api/projects/:projectSlug/capabilities/:capId/progress` — returns `progress_percent`, task counts by status
- **DB schema**: `capabilities` table with `id, mission_id, title, description, status, dependency_ids (JSON array), sort_order`
- **Seed data**: 10 capabilities seeded via `seed-mission-capabilities.js` (commit 743ec75)
- **Viz version**: Currently v0.0.15 (or v0.0.16 if polling optimization lands first)

### Design

#### 1. New API Endpoint: Mission Overview

Create `GET /api/projects/:projectSlug/missions/:missionId/overview` that returns all capabilities with their progress in a single call (avoids N+1 per-capability progress queries from the viz):

```ts
// Response shape
{
  mission: { id, title, status },
  capabilities: [
    {
      id, title, status, dependency_ids, sort_order,
      progress_percent, task_counts: { complete, active, pending, total }
    }
  ]
}
```

Implementation: join capabilities + compute progress inline (same logic as `/:capId/progress` but batched).

#### 2. Viz Dashboard: Mission Tab/View

Add a "Mission" button/tab in the viz header (next to existing views). When active:

- Fetch `/api/projects/:projectSlug/missions/:missionId/overview`
- Render capabilities as a **simple grid layout** (not a complex graph library — keep it vanilla JS/CSS)
- Each capability card:
  - Title (bold)
  - Progress bar (width = progress_percent)
  - Status badge (color-coded: active=blue, complete=green, blocked=red, draft=gray)
  - Task count label (e.g., "3/7 tasks")
- Dependency arrows: Draw SVG lines between cards based on `dependency_ids`
- Layout: 2-column grid, sorted by `sort_order`, dependency arrows as SVG overlay

#### 3. Card Design

```
┌──────────────────────────┐
│ C1: Foundation           │
│ ████████░░░░ 67%         │
│ 4/6 tasks    ● active    │
└──────────────────────────┘
```

Status colors:
- `active` → `#4fc3f7` (blue)
- `complete` → `#66bb6a` (green)
- `blocked` → `#ef5350` (red)
- `draft` → `#9e9e9e` (gray)

#### 4. Dependency Arrows (SVG)

Simple arrow rendering using SVG overlay:
- For each capability, draw a line from each dependency to itself
- Lines are drawn between card center-right → card center-left
- Arrow heads at target end
- Use `dependency_ids` JSON array to resolve connections

### Files to Change

1. `api/routes/capabilities.ts` — UPDATE: Add `GET /:missionId/overview` on missions router (or add to capabilities router with mission aggregation)
2. `viz/versions/v0.0.X/index.html` — CREATE (copy latest): Add Mission view tab, capability grid, SVG dependency arrows
3. `viz/index.html` — UPDATE: Mirror
4. `viz/active` — UPDATE symlink
5. `viz/changelog.json` — UPDATE

### Out of Scope

- Drill-down on capability click (h1-6)
- Breadcrumb navigation (h1-7)
- Drag/zoom on the graph
- Complex graph layout algorithms (use simple grid)

## Do

Implementation by DEV agent.

## Study

- Mission view accessible via tab/button in viz header
- 10 capability cards render with correct progress and status
- Dependency arrows connect correct cards
- Progress updates reflect actual task status
- API returns batched data (single request, no N+1)

## Act

Verify on TEST (:4200) with seeded capability data.
