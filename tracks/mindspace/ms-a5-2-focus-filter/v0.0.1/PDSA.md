# PDSA: Task Filtering by Focus Scope

**Task:** ms-a5-2-focus-filter
**Status:** Design
**Version:** v0.0.1

## Plan

When a project focus is set, allow GET /api/projects/:slug/tasks to filter by focus scope. The focus stores task_ids (JSON array) — when ?focus=true, only return tasks whose IDs are in the focus list.

### Dependencies

- **ms-a5-1-focus-crud** (complete): project_focus table with scope and task_ids
- **ms-a3-1-tasks-crud** (complete): Tasks GET endpoint

### Investigation

**Existing focus table (016-project-focus.sql):**
- `task_ids TEXT` — JSON array of task IDs in focus
- `scope TEXT NOT NULL` — descriptive scope name

**Existing focus route (focus.ts):** GET/PUT/DELETE at /api/projects/:slug/focus

**DNA description:** When focus is set, GET /api/projects/:slug/tasks?focus=true returns only tasks related to focus target. Agent WELCOME message includes current focus.

**Design decisions:**
- Add `?focus=true` query param to existing tasks GET handler
- When focus=true: read project_focus.task_ids, filter tasks to those IDs
- If no focus is set and ?focus=true, return empty array (no focus = no focused tasks)
- Also add focus info to task GET single endpoint (enrichment)
- WELCOME message focus is handled by A2A layer (out of scope here, just the filter)

## Do

### File Changes

#### 1. `api/routes/tasks.ts` (UPDATE — extend GET / handler)

Add focus filter to the existing GET handler:

```typescript
// Inside GET / handler, after existing query params:
const { focus } = req.query;

if (focus === 'true') {
  const focusRecord = db.prepare('SELECT task_ids FROM project_focus WHERE project_slug = ?').get(slug) as any;
  if (!focusRecord || !focusRecord.task_ids) {
    res.status(200).json([]);
    return;
  }

  const focusedIds = JSON.parse(focusRecord.task_ids) as string[];
  if (focusedIds.length === 0) {
    res.status(200).json([]);
    return;
  }

  const placeholders = focusedIds.map(() => '?').join(',');
  const focusSql = `SELECT * FROM tasks WHERE project_slug = ? AND id IN (${placeholders}) ORDER BY created_at DESC`;
  const tasks = db.prepare(focusSql).all(slug, ...focusedIds);
  res.status(200).json(tasks);
  return;
}
```

## Study

### Test Cases (8 total)

**Focus filter (4):**
1. ?focus=true with focus set returns only focused tasks
2. ?focus=true with no focus set returns empty array
3. ?focus=true with empty task_ids returns empty array
4. ?focus=true returns tasks in correct order

**No focus filter (2):**
5. Without ?focus=true, all tasks returned normally (backward compatible)
6. ?focus=false returns all tasks (same as no filter)

**Combined filters (2):**
7. ?focus=true can combine with ?status filter
8. ?focus=true can combine with ?current_role filter

## Act

### Deployment

- 1 file: tasks.ts (UPDATE — add focus filter to GET handler)
- No migration needed
- Backward compatible — existing behavior unchanged without ?focus=true
