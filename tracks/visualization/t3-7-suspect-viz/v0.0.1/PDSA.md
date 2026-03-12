# PDSA: Suspect Status Visualization in Viz Dashboard

**Task:** `t3-7-suspect-viz`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Context

The `suspect_links` table (created by t3-2, migration 029) tracks downstream artifacts that may need re-validation when upstream requirements/decisions change. Each link has:
- `source_type` / `target_type`: requirement, code, test, decision
- `status`: suspect, cleared, accepted_risk
- `project_slug`: links to a project

The API routes exist on develop (`api/routes/suspect-links.ts`):
- `GET /:slug/suspect-links` — list with filters
- `GET /:slug/suspect-links/stats` — counts by status
- `POST /:slug/suspect-links` — create
- `PUT /:slug/suspect-links/:id` — update status

The mission dashboard (h1-5, viz v0.0.16) has capability cards in a 2-column grid. Currently `loadMissionDashboard()` is a stub.

### Design: 3 Components

#### Component 1: Viz Server Endpoint — `GET /api/suspect-links/stats`

**File:** `viz/server.js`

Add a new endpoint that queries the `suspect_links` table directly (same pattern as `/api/data`):

```javascript
if (pathname === '/api/suspect-links/stats') {
  const projectName = url.searchParams.get('project');
  const projects = discoverProjects();

  if (projectName === 'all') {
    // Merge stats from all projects
    const merged = { suspect: 0, cleared: 0, accepted_risk: 0, total: 0, by_source_type: {} };
    for (const proj of projects) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        const rows = db.prepare(
          'SELECT status, source_type, COUNT(*) as count FROM suspect_links GROUP BY status, source_type'
        ).all();
        for (const row of rows) {
          merged[row.status] = (merged[row.status] || 0) + row.count;
          merged.total += row.count;
          if (!merged.by_source_type[row.source_type]) merged.by_source_type[row.source_type] = { suspect: 0, cleared: 0, accepted_risk: 0 };
          merged.by_source_type[row.source_type][row.status] += row.count;
        }
        db.close();
      } catch (err) { /* skip project */ }
    }
    sendJson(res, merged);
  } else {
    // Single project stats
    // ... same pattern with single DB
  }
  return;
}
```

**Response shape:**
```json
{
  "suspect": 3,
  "cleared": 7,
  "accepted_risk": 1,
  "total": 11,
  "by_source_type": {
    "requirement": { "suspect": 2, "cleared": 5, "accepted_risk": 0 },
    "code": { "suspect": 1, "cleared": 2, "accepted_risk": 1 }
  }
}
```

**Note:** The table may not exist in all project databases. The query must handle `SQLITE_ERROR` (table doesn't exist) gracefully — return `{ suspect: 0, cleared: 0, accepted_risk: 0, total: 0 }`.

#### Component 2: Suspect Status Bar in Kanban Header

**File:** `viz/index.html` (new viz version)

Add a suspect status summary bar at the top of the kanban board, below the stats line. This is the primary "how many nodes affected" and "clearance progress" display.

**Rendering:**
```html
<div id="suspect-status-bar" style="display:none; padding: 8px 16px; background: #1a1e2e; border-bottom: 1px solid #333; font-size: 12px;">
  <span style="color: #ef4444;">● <span id="suspect-count">0</span> suspect</span>
  <span style="color: #22c55e; margin-left: 12px;">● <span id="cleared-count">0</span> cleared</span>
  <span style="color: #f59e0b; margin-left: 12px;">● <span id="risk-count">0</span> accepted risk</span>
  <span style="margin-left: 16px;">
    <span id="suspect-progress-bar" style="display:inline-block; width: 100px; height: 6px; background: #333; border-radius: 3px; vertical-align: middle;">
      <span id="suspect-progress-fill" style="display:block; height:100%; background: #22c55e; border-radius: 3px; width: 0%;"></span>
    </span>
    <span id="suspect-progress-pct" style="color: #888; margin-left: 4px;">0%</span> cleared
  </span>
</div>
```

**Data loading:**
```javascript
async function loadSuspectStats() {
  try {
    const projectParam = currentProject ? `?project=${currentProject}` : '';
    const res = await fetch('/api/suspect-links/stats' + projectParam);
    const stats = await res.json();

    if (stats.total === 0) {
      document.getElementById('suspect-status-bar').style.display = 'none';
      return;
    }

    document.getElementById('suspect-status-bar').style.display = '';
    document.getElementById('suspect-count').textContent = stats.suspect || 0;
    document.getElementById('cleared-count').textContent = stats.cleared || 0;
    document.getElementById('risk-count').textContent = stats.accepted_risk || 0;

    const resolvedPct = stats.total > 0
      ? Math.round(((stats.cleared + stats.accepted_risk) / stats.total) * 100)
      : 0;
    document.getElementById('suspect-progress-fill').style.width = resolvedPct + '%';
    document.getElementById('suspect-progress-pct').textContent = resolvedPct + '%';
  } catch (e) {
    // Hide bar on error (no table, etc.)
    document.getElementById('suspect-status-bar').style.display = 'none';
  }
}
```

**Call on load and on poll:**
- Call `loadSuspectStats()` on initial load
- Call on each poll cycle (piggyback on `pollData()` or separate interval — every 30s is fine since suspect links change infrequently)

#### Component 3: Suspect Badge on Mission Dashboard Capability Cards

**File:** Same new viz version `index.html`

When the mission dashboard is loaded and `loadMissionDashboard()` renders capability cards, add a suspect link count badge on each card. This requires:

1. Querying suspect stats per-source-ref (capability slug)
2. Displaying a small red badge on capability cards that have suspect links

**However**, the current `loadMissionDashboard()` is a stub that doesn't load real data. The mission dashboard integration should wait until h1-6 (capability drill-down) makes it functional. For now, the suspect bar in the kanban header is the primary visualization.

**Recommendation:** Implement Components 1 and 2 now. Component 3 deferred to after h1-6 makes the mission dashboard functional.

### Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | Add `GET /api/suspect-links/stats` endpoint |
| `viz/index.html` (new viz version) | Add suspect status bar HTML + JS |

### Verification Plan

1. **Endpoint returns stats:** `curl -s http://10.33.33.1:4200/api/suspect-links/stats?project=all` returns JSON with suspect/cleared/accepted_risk counts
2. **Empty table handling:** When no suspect_links exist, bar is hidden (display:none)
3. **With data:** Create a test suspect link via API, verify bar appears with count=1, progress=0%
4. **Clearance progress:** Clear the link, verify progress bar fills to 100%
5. **Colors match palette:** suspect=red (#ef4444), cleared=green (#22c55e), accepted_risk=amber (#f59e0b)

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
