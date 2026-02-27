# PDSA: Mindspace Viz — All Projects Dropdown Filter

**Slug:** `mindspace-viz-all-projects-dropdown`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN

---

## PLAN

### Problem
The mindspace viz already has a project dropdown (server auto-discovers DBs), but:
- No "All Projects" aggregation option
- Default view is a single project, not the full landscape
- Thomas wants to see everything immediately on page load

### Goal
Add "All Projects" as default dropdown option that aggregates tasks from all 3 databases.

---

## DO

### Architecture (Current)

```
Browser → GET /api/data?project=ProjectName → server queries single DB → JSON response
```

Project dropdown already exists (`<select id="project-selector">`). Server auto-discovers projects via `discoverProjects()`. Each project maps to a separate SQLite DB.

### Changes

#### 1. Backend: server.js — Add `/api/data?project=all` endpoint

When `project=all`, query ALL discovered databases and merge results:

```javascript
// In the /api/data handler:
if (projectName === 'all') {
  const allProjects = discoverProjects();
  const mergedNodes = [];
  const mergedStations = [];
  let totalCount = 0;

  for (const proj of allProjects) {
    const db = new Database(proj.db, { readonly: true });
    const nodes = db.prepare('SELECT * FROM mindspace_nodes').all();
    // Tag each node with project name
    for (const node of nodes) {
      const dna = JSON.parse(node.dna_json || '{}');
      dna._project = proj.name; // Add project tag to DNA
      node.dna_json = JSON.stringify(dna);
      mergedNodes.push(node);
    }
    // Merge stations too
    const stations = db.prepare('SELECT * FROM stations').all();
    for (const s of stations) {
      s.project = proj.name;
      mergedStations.push(s);
    }
    db.close();
  }

  return { nodes: mergedNodes, stations: mergedStations, project: 'All Projects', ... };
}
```

**Key design:** Tag nodes with `dna._project` so the frontend can display project origin. Use `_project` (underscore prefix) to distinguish from user-defined DNA fields.

#### 2. Frontend: index.html — Default "All Projects" + project badges

**Dropdown change (loadProjects):**
```javascript
// After populating project options, prepend "All Projects"
const allOption = document.createElement('option');
allOption.value = 'all';
allOption.textContent = 'All Projects';
selector.prepend(allOption);
selector.value = 'all'; // Default selection
```

**Project badge on task cards:**
When in All Projects view, show project name on each task card:
```javascript
// In renderNode() or the card rendering function:
if (currentProject === 'all' && node.dna._project) {
  // Add small project label badge below title
  // Color: different color per project for quick visual scanning
}
```

**Project color mapping:**
```javascript
const PROJECT_COLORS = {
  'best-practices': '#3b82f6',        // Blue
  'xpollination-mcp-server': '#8b5cf6', // Purple
  'HomePage': '#10b981'                // Green
};
```

#### 3. Auto-refresh with All Projects

The existing polling uses `currentProject` in the fetch URL. Setting `currentProject = 'all'` by default ensures auto-refresh works with the aggregated view.

### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `viz/server.js` | EDIT | Add `project=all` handling in `/api/data` — merge all DBs |
| `viz/index.html` | EDIT | Prepend "All Projects" to dropdown, default selection, project badges |

### Acceptance Criteria Mapping

| AC | How Met |
|----|---------|
| Dropdown with All Projects + 3 individual projects | Prepend "All Projects" option to existing dropdown |
| All Projects default on page load | `selector.value = 'all'` after populating |
| All Projects shows tasks from all 3 DBs | Server merges nodes from all discovered DBs |
| Individual project filter works | Existing functionality preserved (no change) |
| Task cards show project in All Projects view | `dna._project` badge with project-specific color |

### Edge Cases

- If a DB is missing or locked: skip that project in merge, log warning
- Node ID collisions across projects: UUIDs are globally unique, no collision risk
- Station merging: prefix station IDs with project name to avoid collision

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
