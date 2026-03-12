# PDSA: Viz Breadcrumb Navigation

**Task:** `h1-7-viz-breadcrumb-nav`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The viz currently supports two navigation levels: Mission overview (capability cards) and Capability detail (requirements + tasks list). Navigation between levels uses a single "Back" button that returns to the mission overview. There is no breadcrumb trail showing the user's position in the hierarchy, and no way to drill further into individual requirements or tasks from the capability detail view.

The task DNA requests: "Add breadcrumb navigation to viz: Mission > Capability > Requirement > Task. Allows navigating up and down the hierarchy from any level."

### Current State

**Navigation (v0.0.21):**
- `loadMissionDashboard()` → renders capability cards with progress
- `showCapabilityDetail(capId)` → renders requirements list + tasks list with "Back" button
- `hideDetail()` → returns to mission overview
- No intermediate requirement detail or task detail views

**Data Model:**
- `missions` table: id, title, description, status
- `capabilities` table: id, mission_id, title, description, status, sort_order
- `capability_requirements` join table: capability_id, requirement_ref (currently empty — no requirements table exists)
- `capability_tasks` join table: capability_id, task_slug
- `mindspace_nodes` table: id, type, status, parent_ids (JSON array), slug, dna_json

**Current data:** 1 mission ("Mindspace Platform"), 1 capability ("Foundation"), 4 tasks. No requirements linked yet.

**Server endpoints:**
- `GET /api/mission-overview` → `{ capabilities: [...] }` with progress
- `GET /api/capabilities/:capId` → `{ id, title, requirements, tasks, ... }`

### Design Decisions

**D1: Breadcrumb is a navigation trail rendered above the detail panel content.**

A horizontal breadcrumb bar at the top of the content area showing the current position: `Missions > [Mission Title] > [Capability Title]` (when viewing a capability). Each segment is clickable to navigate to that level.

The breadcrumb replaces the current "Back" button approach with a richer navigation model. The "Back" button is removed — breadcrumb segments serve the same purpose with more flexibility.

**D2: Three navigation levels implemented; requirement detail is deferred.**

The `capability_requirements` table is currently empty and no `requirements` table exists. Implementing requirement-level drill-down with no data to display adds complexity for zero user value.

Implemented levels:
1. **Mission overview** — capability cards (existing, unchanged)
2. **Capability detail** — requirements + tasks (existing, add breadcrumb)
3. **Task detail** — task DNA summary (NEW — clickable from capability view)

Deferred:
4. **Requirement detail** — deferred until requirements table exists and is populated

The breadcrumb will show the correct level even without requirement detail: `Missions > Mindspace Platform > Foundation > [task-slug]`. When requirement detail is added later, it inserts between capability and task.

**D3: Navigation state is a stack, not URL-based.**

The viz is a single-page app with no URL routing. Navigation state is maintained as a JavaScript array (stack) that tracks the current path through the hierarchy. Each entry has `{ level, id, title }`.

```javascript
let navStack = []; // e.g., [{ level: 'mission', id: 'b649...', title: 'Mindspace Platform' }]
```

Pushing to the stack navigates deeper. Clicking a breadcrumb segment pops the stack to that level.

**D4: Task detail shows DNA summary — not full DNA dump.**

When clicking a task in the capability detail view, a task detail panel shows: slug, title, status, role, description, depends_on, and pdsa_ref. This is a read-only summary — no edit capability. The existing task-card click behavior (selecting in the mindspace graph) is preserved; task detail opens from the capability drill-down only.

**D5: Server needs a task-detail endpoint.**

The existing `/api/capabilities/:capId` endpoint returns task slugs with title/status/role. For task detail, the server needs to return full DNA for a single task. The capability endpoint already enriches tasks with `dna_json` parsing — a dedicated task endpoint is cleaner than overloading the capability response.

New endpoint: `GET /api/tasks/:slug` → `{ slug, title, status, role, description, depends_on, pdsa_ref, requirement_refs, group }`

**D6: Breadcrumb resolves parent context via API, not parent_ids.**

The `parent_ids` column in `mindspace_nodes` is a DAG reference. But the hierarchy (Mission → Capability → Task) is tracked via join tables (`capability_tasks`), not `parent_ids`. The breadcrumb must traverse join tables to find a task's parent capability and the capability's parent mission.

The `/api/tasks/:slug` endpoint includes `parent_capability` and `parent_mission` in its response so the client can build the full breadcrumb in one fetch.

### Breadcrumb UI Specification

**Location:** Top of the detail panel content area (inside `#detail-panel`), above the existing detail-header.

**HTML structure:**
```html
<div class="breadcrumb-bar" id="breadcrumb-bar">
  <span class="breadcrumb-segment" onclick="navigateTo('missions')">Missions</span>
  <span class="breadcrumb-separator">></span>
  <span class="breadcrumb-segment" onclick="navigateTo('mission', 'id')">Mindspace Platform</span>
  <span class="breadcrumb-separator">></span>
  <span class="breadcrumb-segment active">Foundation</span>
</div>
```

**Styling:**
```css
.breadcrumb-bar {
  padding: 8px 12px;
  font-size: 12px;
  color: #888;
  border-bottom: 1px solid #333;
  background: #0d1117;
}
.breadcrumb-segment {
  color: #8ab4f8;
  cursor: pointer;
}
.breadcrumb-segment:hover {
  text-decoration: underline;
}
.breadcrumb-segment.active {
  color: #eee;
  cursor: default;
}
.breadcrumb-separator {
  margin: 0 6px;
  color: #555;
}
```

**Behavior by level:**

| View | Breadcrumb | Detail panel state |
|------|-----------|-------------------|
| Mission overview | (no breadcrumb — breadcrumb bar hidden) | Detail panel closed |
| Capability detail | `Missions > [Mission Title] > **[Capability Title]**` | Detail panel open |
| Task detail | `Missions > [Mission Title] > [Capability Title] > **[Task Slug]**` | Detail panel open |

### Navigation Functions

**`navigateTo(level, id)`** — Navigate to a specific breadcrumb segment:
- `navigateTo('missions')` → `hideDetail()`, reset navStack
- `navigateTo('mission', missionId)` → `hideDetail()`, reset navStack (mission overview is the top level; no mission-specific view exists yet)
- `navigateTo('capability', capId)` → `showCapabilityDetail(capId)`, pop navStack to capability level

**`showTaskDetail(slug)`** — New function:
- Fetches `GET /api/tasks/:slug`
- Renders task DNA summary in detail panel
- Pushes task to navStack
- Updates breadcrumb

**Modified `showCapabilityDetail(capId)`:**
- Existing logic preserved
- Adds: push capability to navStack, render breadcrumb
- Requirements and tasks become clickable (tasks → `showTaskDetail(slug)`)

### Server Changes

**New endpoint: `GET /api/tasks/:slug`**

```javascript
// GET /api/tasks/:slug?project=<name>
// Returns task DNA summary + parent hierarchy for breadcrumb
if (pathname.match(/^\/api\/tasks\/([^/]+)$/)) {
  const slug = pathname.split('/')[3];
  const projectName = url.searchParams.get('project');
  // ... project iteration pattern (same as capabilities) ...

  const node = db.prepare(
    'SELECT * FROM mindspace_nodes WHERE slug = ?'
  ).get(slug);

  if (node) {
    const dna = node.dna_json ? JSON.parse(node.dna_json) : {};

    // Find parent capability via capability_tasks
    const capLink = db.prepare(
      `SELECT ct.capability_id, c.title, c.mission_id, m.title AS mission_title
       FROM capability_tasks ct
       JOIN capabilities c ON c.id = ct.capability_id
       JOIN missions m ON m.id = c.mission_id
       WHERE ct.task_slug = ?`
    ).get(slug);

    sendJson(res, {
      slug: node.slug,
      title: dna.title || node.slug,
      status: node.status,
      role: dna.role || null,
      description: dna.description || null,
      depends_on: dna.depends_on || [],
      pdsa_ref: dna.pdsa_ref || null,
      requirement_refs: dna.requirement_refs || [],
      group: dna.group || null,
      parent_capability: capLink ? {
        id: capLink.capability_id,
        title: capLink.title
      } : null,
      parent_mission: capLink ? {
        id: capLink.mission_id,
        title: capLink.mission_title
      } : null
    });
    return;
  }
}
```

**Modified `/api/capabilities/:capId` response:**

Add `mission_id` and `mission_title` to the response (currently returns `id, title, description, status, requirements, tasks` but not mission context). This allows the client to build the breadcrumb without an extra fetch.

```javascript
// Add to existing capability detail response:
const mission = db.prepare('SELECT id, title FROM missions WHERE id = ?')
  .get(cap.mission_id);

sendJson(res, {
  // ...existing fields...
  mission_id: cap.mission_id,
  mission_title: mission ? mission.title : null
});
```

### Task Detail View

**Rendered in the detail panel when a task row is clicked in capability view.**

```html
<div class="detail-header" style="padding:12px;border-bottom:1px solid #333;">
  <h3 style="font-size:16px;">${task.title}</h3>
  <span class="badge status-${task.status}">${task.status}</span>
  ${task.role ? `<span class="badge role-badge" style="color:${ROLE_COLORS[task.role]}">${task.role.toUpperCase()}</span>` : ''}
</div>

<div class="detail-section" style="padding:12px;">
  <div><strong>Slug:</strong> ${task.slug}</div>
  ${task.description ? `<div style="margin-top:8px;color:#ccc;">${task.description}</div>` : ''}
  ${task.group ? `<div style="margin-top:8px;"><strong>Group:</strong> ${task.group}</div>` : ''}
  ${task.depends_on.length ? `
    <div style="margin-top:8px;">
      <strong>Depends on:</strong>
      ${task.depends_on.map(d => `<span class="badge" style="margin:2px;font-size:10px;background:#0f3460;color:#8ab4f8;">${d}</span>`).join('')}
    </div>
  ` : ''}
  ${task.pdsa_ref ? `<div style="margin-top:8px;"><strong>PDSA:</strong> ${task.pdsa_ref}</div>` : ''}
</div>
```

### Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.22/index.html` | Breadcrumb bar, navStack, `navigateTo()`, `showTaskDetail()`, modified `showCapabilityDetail()` |
| `viz/versions/v0.0.22/server.js` | New `GET /api/tasks/:slug` endpoint, add mission context to capability response |
| `viz/versions/v0.0.22/changelog.json` | Version metadata |
| `viz/active` | Symlink updated to v0.0.22 |

### Verification Plan

1. **Breadcrumb at capability level:** Click a capability card → breadcrumb shows `Missions > Mindspace Platform > Foundation`. "Foundation" is active (non-clickable). "Missions" and "Mindspace Platform" are clickable.
2. **Breadcrumb at task level:** Click a task in capability view → breadcrumb shows `Missions > Mindspace Platform > Foundation > h1-1-hierarchy-data-model`. Task slug is active. Other segments clickable.
3. **Navigate up via breadcrumb:** At task detail, click "Foundation" → returns to capability detail. Click "Missions" → returns to mission overview.
4. **Task detail content:** Task detail shows slug, title, status, role, description, depends_on badges, pdsa_ref.
5. **Back button removed:** No "Back" button in capability or task detail views — breadcrumb replaces it.
6. **Mission overview:** No breadcrumb visible. Capability cards render as before.
7. **API: tasks endpoint:** `GET /api/tasks/h1-1-hierarchy-data-model` returns DNA summary with `parent_capability` and `parent_mission`.
8. **API: capability with mission:** `GET /api/capabilities/:id` response includes `mission_id` and `mission_title`.
9. **Empty state:** Task with no parent capability → breadcrumb shows only `Missions > [Task Slug]`.
10. **Light mode:** Breadcrumb styling works in both dark and light themes.

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
