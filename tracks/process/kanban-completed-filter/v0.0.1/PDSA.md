# PDSA: kanban-completed-filter

## Plan

Add a completed tasks filter to show recently completed work in the Done column.

### Current Behavior
- Kanban only shows non-terminal tasks (active filter)
- `currentFilter = 'active'` on line 26
- No way to see completed tasks

### Design

**Filter dropdown** in kanban header (next to project filter):
```html
<select id="completed-filter">
  <option value="active">Active only</option>
  <option value="1d">+ Completed (1 day)</option>
  <option value="7d">+ Completed (7 days)</option>
  <option value="30d">+ Completed (30 days)</option>
  <option value="all">All</option>
</select>
```

### Changes

1. **kanban.html** — add `<select id="completed-filter">` in header bar
2. **kanban.js** — 
   - Listen for filter change
   - When non-active selected, query completed tasks with `updated_after` filter
   - Merge completed tasks into the Done column
   - Completed tasks rendered with muted opacity (0.6)
   - Store selection in `sessionStorage('kanban-completed-filter')`
   - Restore on page load
3. **A2A query** — if OBJECT_QUERY doesn't support `updated_after`, add it to the handler. Query: `{ type: 'task', status: 'complete', updated_after: '2026-03-30T00:00:00Z' }`
4. **kanban.css** — completed card muted styling

### File Changes

| File | Change |
|------|--------|
| `viz/versions/v0.0.38/kanban.html` | Add filter dropdown |
| `viz/versions/v0.0.38/js/kanban.js` | Filter logic, query completed, merge into board |
| `viz/versions/v0.0.38/kanban.css` | Muted completed card style |
| `src/a2a/handlers/` (if needed) | Add updated_after support to OBJECT_QUERY |

### Dev Instructions
1. Add dropdown to kanban.html
2. Implement filter change handler in kanban.js
3. Calculate `updated_after` date from filter selection
4. Query completed tasks and merge into board data
5. Apply muted styling to completed cards
6. Persist filter in sessionStorage
7. Check if A2A OBJECT_QUERY supports updated_after — if not, add it
8. Git add, commit, push

### What NOT To Do
- Do NOT paginate completed results (limit to 100)
- Do NOT add sorting within the Done column
- Do NOT change the default behavior (Active only stays default)
