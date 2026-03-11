# PDSA: Dependency-Aware Task Filtering

**Task:** ms-a8-4-dep-filtering
**Status:** Design
**Version:** v0.0.1

## Plan

Enhance `GET /api/projects/:slug/tasks` to support true dependency-aware filtering. Current `available_only=true` only checks `claimed_by IS NULL AND status != 'blocked'` — it doesn't consult the `task_dependencies` table. This task adds real dependency checking: a task is "blocked" if it has any incomplete dependency in `task_dependencies`.

### Dependencies

- `ms-a8-3-auto-unblock` (auto-unblock on completion)
- `t1-3-repos-bootstrap` (base API)

### Investigation

**Current state (`api/routes/tasks.ts`):**
- `available_only=true` → `claimed_by IS NULL AND status != 'blocked'` (line 86-87)
- `blocked=true/false` → filters by `status = 'blocked'` / `status != 'blocked'` (lines 93-100)
- No JOIN on `task_dependencies` table
- GET single task (`:taskId`) returns task + requirement info, no dependency status

**Problem:** Filtering by `status = 'blocked'` is unreliable — a task can have incomplete dependencies but not be in `blocked` status. The dependency graph is the source of truth for blockage, not the status field.

**Design decisions:**

1. **`is_blocked` computation:** A task is blocked if it has ANY row in `task_dependencies` where the `blocked_by_task_id` task's status is NOT `complete`. This uses the dependency table as source of truth.

2. **`available_only=true` enhancement:** In addition to `claimed_by IS NULL AND status != 'blocked'`, also exclude tasks that have incomplete dependencies. Uses a LEFT JOIN subquery.

3. **`blocked_only=true` filter:** New filter that returns only tasks with at least one incomplete dependency. Replaces the current `blocked=true` behavior (which checked status field).

4. **Response enrichment:** Both list and single-task endpoints include `is_blocked` (boolean) and `blocking_tasks` (array of `{id, title, status}` for incomplete deps).

5. **SQL approach:** Use a subquery/CTE pattern rather than inline JOINs to keep the dynamic filter building clean.

## Do

### File Changes

#### 1. `api/routes/tasks.ts` (UPDATE)

**Changes to GET `/` (list tasks):**

Replace the `available_only` and `blocked` filter logic (lines 85-101) with dependency-aware versions:

```typescript
// GET / — list tasks for project
tasksRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, current_role, claimed, blocked_only, available_only, focus } = req.query;
  const db = getDb();

  let sql = `
    SELECT t.*,
      CASE WHEN EXISTS (
        SELECT 1 FROM task_dependencies td
        JOIN tasks dep ON dep.id = td.blocked_by_task_id
        WHERE td.task_id = t.id AND dep.status != 'complete'
      ) THEN 1 ELSE 0 END as is_blocked
    FROM tasks t
    WHERE t.project_slug = ?`;
  const params: any[] = [slug];

  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  if (current_role) {
    sql += ' AND t.current_role = ?';
    params.push(current_role);
  }

  if (available_only === 'true') {
    // Available = unclaimed + not blocked status + no incomplete dependencies
    sql += ' AND t.claimed_by IS NULL AND t.status != ?';
    params.push('blocked');
    sql += ` AND NOT EXISTS (
      SELECT 1 FROM task_dependencies td
      JOIN tasks dep ON dep.id = td.blocked_by_task_id
      WHERE td.task_id = t.id AND dep.status != 'complete'
    )`;
  } else {
    if (claimed === 'true') {
      sql += ' AND t.claimed_by IS NOT NULL';
    } else if (claimed === 'false') {
      sql += ' AND t.claimed_by IS NULL';
    }
    if (blocked_only === 'true') {
      // Tasks with at least one incomplete dependency
      sql += ` AND EXISTS (
        SELECT 1 FROM task_dependencies td
        JOIN tasks dep ON dep.id = td.blocked_by_task_id
        WHERE td.task_id = t.id AND dep.status != 'complete'
      )`;
    }
  }

  // ... focus filter unchanged ...

  sql += ' ORDER BY t.created_at DESC';
  const tasks = db.prepare(sql).all(...params);

  // Enrich each task with blocking_tasks array
  const blockingQuery = db.prepare(`
    SELECT dep.id, dep.title, dep.status
    FROM task_dependencies td
    JOIN tasks dep ON dep.id = td.blocked_by_task_id
    WHERE td.task_id = ? AND dep.status != 'complete'
  `);

  const enriched = (tasks as any[]).map(task => ({
    ...task,
    is_blocked: task.is_blocked === 1,
    blocking_tasks: blockingQuery.all(task.id)
  }));

  res.status(200).json(enriched);
});
```

**Changes to GET `/:taskId` (single task):**

Add `is_blocked` and `blocking_tasks` to single task response:

```typescript
tasksRouter.get('/:taskId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Dependency status
  const blockingTasks = db.prepare(`
    SELECT dep.id, dep.title, dep.status
    FROM task_dependencies td
    JOIN tasks dep ON dep.id = td.blocked_by_task_id
    WHERE td.task_id = ? AND dep.status != 'complete'
  `).all(taskId);

  // Requirement info
  let requirement = null;
  if (task.requirement_id) {
    requirement = db.prepare(
      'SELECT id, req_id_human, title, status, priority FROM requirements WHERE id = ?'
    ).get(task.requirement_id);
  }

  res.status(200).json({
    ...task,
    is_blocked: blockingTasks.length > 0,
    blocking_tasks: blockingTasks,
    requirement
  });
});
```

## Study

### Test Cases (10 total)

**available_only filter (3):**
1. `?available_only=true` excludes tasks with incomplete dependencies (even if status is not 'blocked')
2. `?available_only=true` includes tasks whose ALL dependencies are complete
3. `?available_only=true` includes tasks with no dependencies at all

**blocked_only filter (3):**
4. `?blocked_only=true` returns only tasks with at least one incomplete dependency
5. `?blocked_only=true` returns empty array when no tasks have incomplete deps
6. `?blocked_only=true` does NOT return tasks in 'blocked' status that have no dependency entries

**Response enrichment (2):**
7. List response includes `is_blocked: true` and `blocking_tasks: [{id, title, status}]` for blocked task
8. Single task GET includes `is_blocked: false` and `blocking_tasks: []` for unblocked task

**Edge cases (2):**
9. Task with mix of complete and incomplete deps → `is_blocked: true`, `blocking_tasks` only shows incomplete
10. Completing a blocking task updates dependent task's `is_blocked` to false on next query (no caching)

## Act

### Deployment

- 1 file: `api/routes/tasks.ts` (UPDATE)
- No migration needed — uses existing `task_dependencies` table
- Breaking change: `blocked=true` query param replaced by `blocked_only=true` (dependency-based, not status-based)
- Response shape change: all task list/single responses now include `is_blocked` and `blocking_tasks` fields
