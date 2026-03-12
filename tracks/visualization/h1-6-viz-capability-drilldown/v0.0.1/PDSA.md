# PDSA: Viz Capability Drill-Down View

**Task:** `h1-6-viz-capability-drilldown`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Context

The mission dashboard (h1-5, viz v0.0.16) renders capability cards in a 2-column grid. Currently `loadMissionDashboard()` is a stub — it shows "Loading..." without fetching data. The API exists: `GET /:missionId/overview` returns capabilities with `progress_percent`, `task_count`, `complete_count`, `dependency_ids`.

This task adds:
1. **Working mission dashboard** — fetch data from the API and render capability cards
2. **Drill-down view** — clicking a capability card shows its requirements and tasks

### Data Model (on develop)

```
missions → capabilities (1:N via mission_id)
capabilities → capability_requirements (1:N via capability_id → requirement_ref)
capabilities → capability_tasks (1:N via capability_id → task_slug)
requirements (id, req_id_human, title, description, status, priority)
```

### Design: 3 Parts

#### Part 1: API Endpoint — `GET /:missionId/capabilities/:capId`

**File:** `api/routes/missions.ts`

New endpoint returns capability details with linked requirements and tasks:

```javascript
missionsRouter.get('/:missionId/capabilities/:capId', requireProjectAccess('viewer'), (req, res) => {
  const { slug, missionId, capId } = req.params;
  const db = getDb();

  const cap = db.prepare(
    'SELECT * FROM capabilities WHERE id = ? AND mission_id = ?'
  ).get(capId, missionId);

  if (!cap) {
    return res.status(404).json({ error: 'Capability not found' });
  }

  // Get linked requirements
  const requirements = db.prepare(
    `SELECT r.id, r.req_id_human, r.title, r.status, r.priority
     FROM capability_requirements cr
     JOIN requirements r ON r.id = cr.requirement_ref
     WHERE cr.capability_id = ?
     ORDER BY r.req_id_human ASC`
  ).all(capId);

  // Get linked tasks with status
  const tasks = db.prepare(
    `SELECT ct.task_slug, t.id, t.title, t.status, t.dna_json
     FROM capability_tasks ct
     LEFT JOIN mindspace_nodes t ON t.slug = ct.task_slug
     WHERE ct.capability_id = ?
     ORDER BY t.status ASC`
  ).all(capId);

  // Parse dna_json to extract role
  const enrichedTasks = tasks.map(t => ({
    slug: t.task_slug,
    title: t.title || t.task_slug,
    status: t.status || 'unknown',
    role: t.dna_json ? JSON.parse(t.dna_json).role : null
  }));

  res.status(200).json({
    id: cap.id,
    title: cap.title,
    description: cap.description,
    status: cap.status,
    requirements,
    tasks: enrichedTasks,
    task_count: enrichedTasks.length,
    complete_count: enrichedTasks.filter(t => t.status === 'complete').length
  });
});
```

**Note:** The `mindspace_nodes` table (viz DB) stores tasks, not a separate `tasks` table. The join uses `slug` matching.

#### Part 2: Viz Server Proxy — `GET /api/capabilities/:capId`

**File:** `viz/server.js`

The viz server queries the DB directly (no Fastify API server dependency). Add a capability detail endpoint:

```javascript
if (pathname.match(/^\/api\/capabilities\/([^/]+)$/)) {
  const capId = pathname.split('/')[3];
  const projectName = url.searchParams.get('project');
  // ... query capabilities + capability_requirements + capability_tasks
  // ... join with requirements table for titles
  // ... join with mindspace_nodes for task status
}
```

**Alternatively**, since the viz on TEST (4200) connects to the Fastify API, the viz client can call the Fastify API directly if CORS allows. But the viz currently uses its own server endpoints. **Recommendation:** Add the endpoint to `viz/server.js` for consistency.

#### Part 3: Viz UI — Capability Drill-Down Panel

**File:** New viz version `index.html`

**3a. Make mission dashboard functional:**

Replace the `loadMissionDashboard()` stub with:

```javascript
async function loadMissionDashboard() {
  const capsContainer = document.getElementById('mission-caps');
  try {
    const projectParam = currentProject ? `?project=${currentProject}` : '';
    const res = await fetch('/api/mission-overview' + projectParam);
    const data = await res.json();

    if (!data.capabilities || data.capabilities.length === 0) {
      capsContainer.innerHTML = '<div style="color:#888;">No capabilities found</div>';
      return;
    }

    capsContainer.innerHTML = data.capabilities.map(cap => `
      <div class="cap-card" data-cap-id="${cap.id}" onclick="showCapabilityDetail('${cap.id}')" style="cursor:pointer;">
        <h3>${cap.title}</h3>
        <div class="cap-progress">
          <div class="cap-progress-fill" style="width: ${cap.progress_percent}%"></div>
        </div>
        <div class="cap-stats">
          ${cap.complete_count}/${cap.task_count} tasks complete (${cap.progress_percent}%)
        </div>
      </div>
    `).join('');
  } catch (e) {
    capsContainer.innerHTML = '<div style="color:#ef4444;">Failed to load mission data</div>';
  }
}
```

**Note:** This needs a new viz server endpoint `GET /api/mission-overview` that returns all capabilities with progress (wrapper around the missions API). Or call the existing Fastify API from the viz client.

**3b. Capability detail panel (drill-down):**

When a capability card is clicked, show a detail panel (reuse the existing right-side detail panel pattern or replace the kanban view):

```javascript
async function showCapabilityDetail(capId) {
  const projectParam = currentProject ? `?project=${currentProject}` : '';
  const res = await fetch(`/api/capabilities/${capId}` + projectParam);
  const cap = await res.json();

  // Replace detail panel content (or overlay)
  const detailPanel = document.getElementById('detail-panel');
  detailPanel.innerHTML = `
    <div class="detail-header">
      <button onclick="hideDetail()" style="...">Back</button>
      <h3>${cap.title}</h3>
      <span class="badge status-${cap.status}">${cap.status}</span>
    </div>

    <div class="detail-section">
      <h4>Requirements (${cap.requirements.length})</h4>
      ${cap.requirements.map(r => `
        <div class="req-row" style="padding: 6px 0; border-bottom: 1px solid #333;">
          <span class="badge" style="font-size: 10px; background: #0f3460; color: #8ab4f8;">${r.req_id_human}</span>
          <span style="margin-left: 8px; color: #eee;">${r.title}</span>
          <span class="badge status-${r.status}" style="float:right;">${r.status}</span>
        </div>
      `).join('')}
    </div>

    <div class="detail-section" style="margin-top: 12px;">
      <h4>Tasks (${cap.complete_count}/${cap.task_count})</h4>
      ${cap.tasks.map(t => `
        <div class="task-row" style="padding: 6px 0; border-bottom: 1px solid #333;">
          <span class="status-dot ${t.status}" style="display:inline-block;width:8px;height:8px;border-radius:50%;"></span>
          <span style="margin-left: 8px; color: #eee;">${t.title}</span>
          <span class="badge status-${t.status}" style="float:right;">${t.status}</span>
          ${t.role ? `<span class="badge role-badge" style="float:right; margin-right:4px; color:${ROLE_COLORS[t.role]||'#888'}; border-color:${ROLE_COLORS[t.role]||'#888'};">${t.role.toUpperCase()}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  detailPanel.classList.add('open');
}
```

### Viz Server Endpoints Needed

| Endpoint | Purpose |
|----------|---------|
| `GET /api/mission-overview?project=X` | Returns all capabilities with progress for the mission (wraps missions API data) |
| `GET /api/capabilities/:capId?project=X` | Returns capability detail: requirements + tasks with status |

Both query SQLite directly (same pattern as `/api/data`).

### Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | Add `GET /api/mission-overview` and `GET /api/capabilities/:capId` endpoints |
| `viz/index.html` (new viz version) | Replace `loadMissionDashboard()` stub, add `showCapabilityDetail()`, add CSS for req-row/task-row |

### Verification Plan

1. **Mission overview endpoint:** `curl -s http://10.33.33.1:4200/api/mission-overview?project=xpollination-mcp-server` returns capabilities with progress
2. **Capability detail endpoint:** `curl -s http://10.33.33.1:4200/api/capabilities/<capId>?project=xpollination-mcp-server` returns requirements + tasks
3. **Dashboard renders:** Mission view shows capability cards with progress bars (not "Loading...")
4. **Drill-down works:** Clicking a capability card shows requirements list and tasks with status badges
5. **Back navigation:** Back button returns to mission overview

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
