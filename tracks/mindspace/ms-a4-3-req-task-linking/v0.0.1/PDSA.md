# PDSA: Requirement ↔ Task Linking

**Task:** ms-a4-3-req-task-linking
**Status:** Design
**Version:** v0.0.1

## Plan

Enable bidirectional navigation between requirements and tasks. Tasks already have a `requirement_id` FK. This task adds query endpoints for navigating from requirements to their linked tasks and enriches task responses with requirement info.

### Dependencies

- **ms-a4-1-requirements-crud** (complete): Requirements table
- **ms-a3-1-tasks-crud** (complete): Tasks table with requirement_id column
- **t1-3-repos-bootstrap** (complete)

### Investigation

**Current state:**
- Tasks table has `requirement_id TEXT` (nullable, no FK constraint yet)
- No endpoint to list tasks by requirement
- Task GET response doesn't include requirement details

**Design decisions:**
- No new table needed — `requirement_id` on tasks is the link
- Add FK constraint via migration (requirement_id REFERENCES requirements)
- Add `GET /:reqId/tasks` to requirements router
- Enrich task GET with requirement title/status when requirement_id is set

## Do

### File Changes

#### 1. `api/routes/requirements.ts` (UPDATE)

Add endpoint to list tasks linked to a requirement:

```typescript
// GET /:reqId/tasks — list tasks linked to this requirement
requirementsRouter.get('/:reqId/tasks', requireProjectAccess('viewer'), (req, res) => {
  const { slug, reqId } = req.params;
  const db = getDb();

  // Dual lookup
  let requirement = db.prepare('SELECT * FROM requirements WHERE id = ? AND project_slug = ?').get(reqId, slug) as any;
  if (!requirement) {
    requirement = db.prepare('SELECT * FROM requirements WHERE req_id_human = ? AND project_slug = ?').get(reqId, slug) as any;
  }
  if (!requirement) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE requirement_id = ? AND project_slug = ? ORDER BY created_at DESC'
  ).all(requirement.id, slug);

  res.status(200).json({ requirement_id: requirement.id, req_id_human: requirement.req_id_human, tasks });
});
```

#### 2. `api/routes/tasks.ts` (UPDATE)

Enrich GET /:taskId response with requirement info:

```typescript
// In GET /:taskId handler, after fetching task:
const enriched = { ...(task as any) };
if (enriched.requirement_id) {
  const req = db.prepare('SELECT req_id_human, title, status FROM requirements WHERE id = ?')
    .get(enriched.requirement_id) as any;
  if (req) {
    enriched.requirement = { id: enriched.requirement_id, req_id_human: req.req_id_human, title: req.title, status: req.status };
  }
}
res.status(200).json(enriched);
```

### No New Migration

The `requirement_id` column already exists on tasks. Adding a FK constraint in SQLite requires recreating the table (SQLite limitation). Since the column already exists and we validate via application logic, no migration is needed. The linking is purely via query endpoints.

## Study

### Test Cases (10 total)

**Requirement → tasks navigation (3):**
1. GET /:reqId/tasks returns all tasks linked by requirement_id
2. Supports dual lookup (UUID and req_id_human)
3. Returns 404 for non-existent requirement

**Task → requirement enrichment (3):**
4. GET /:taskId includes requirement object when requirement_id is set
5. Requirement object contains req_id_human, title, status
6. GET /:taskId without requirement_id returns no requirement field

**Linking (4):**
7. Creating a task with requirement_id links it to the requirement
8. Updating task requirement_id changes the link
9. Setting requirement_id to null removes the link
10. Invalid requirement_id (non-existent) still stores the ID (no FK validation — future improvement)

## Act

### Deployment

- 2 files: requirements.ts (UPDATE), tasks.ts (UPDATE)
- No migration needed
- No breaking changes — existing responses are enhanced with optional fields
