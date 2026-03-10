# PDSA: Dependency Table + Add/Remove Endpoints

**Task:** ms-a8-1-dependency-table
**Status:** Design
**Version:** v0.0.1

## Plan

Create a relational dependency table replacing the current DNA-embedded `depends_on` arrays. Provides forward dependencies (what blocks me), reverse dependencies (what I block), and CRUD operations.

### Problem

Current `depends_on` in task DNA is document-embedded and forward-only. Reverse lookup (what does task X unblock?) requires scanning ALL tasks. This is O(n) for every query. A relational table enables indexed bidirectional queries and downstream visibility.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**Liaison design input (incorporated):**
1. Reverse index API — GET dependents (who depends on me?)
2. Transitive closure query for full chain visualization
3. Migration strategy from DNA depends_on to relational table
4. DOWNSTREAM VISIBILITY — task response includes `blocks` field

**Design decisions:**
- Table stores directed edges: task_id depends on blocked_by_task_id
- Both tasks must be in the same project (no cross-project deps)
- Transitive closure is deferred to ms-a8-2 (cycle detection) — this task does direct deps only
- `blocks` field (reverse lookup) is a computed query, not stored

## Do

### File Changes

#### 1. `api/db/migrations/014-task-dependencies.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  blocked_by_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, blocked_by_task_id),
  CHECK(task_id != blocked_by_task_id)
);

CREATE INDEX IF NOT EXISTS idx_deps_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_deps_blocked_by ON task_dependencies(blocked_by_task_id);
```

**Key constraints:**
- `UNIQUE(task_id, blocked_by_task_id)` — no duplicate edges
- `CHECK(task_id != blocked_by_task_id)` — no self-dependencies
- `ON DELETE CASCADE` — removing a task cleans up its deps

#### 2. `api/routes/task-dependencies.ts` (NEW)

Nested under tasks router at `/:taskId/dependencies`.

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const taskDependenciesRouter = Router({ mergeParams: true });

// GET /:taskId/dependencies — list what blocks this task (forward deps)
taskDependenciesRouter.get(
  '/:taskId/dependencies',
  requireProjectAccess('viewer'),
  (req: Request, res: Response) => {
    const { slug, taskId } = req.params;
    const db = getDb();

    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const deps = db.prepare(
      `SELECT td.id, td.blocked_by_task_id, t.title, t.status, td.created_at
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.blocked_by_task_id
       WHERE td.task_id = ?
       ORDER BY td.created_at`
    ).all(taskId);

    res.status(200).json({ task_id: taskId, depends_on: deps });
  }
);

// GET /:taskId/dependents — list what this task blocks (reverse deps)
taskDependenciesRouter.get(
  '/:taskId/dependents',
  requireProjectAccess('viewer'),
  (req: Request, res: Response) => {
    const { slug, taskId } = req.params;
    const db = getDb();

    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const dependents = db.prepare(
      `SELECT td.id, td.task_id, t.title, t.status, td.created_at
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE td.blocked_by_task_id = ?
       ORDER BY td.created_at`
    ).all(taskId);

    res.status(200).json({ task_id: taskId, blocks: dependents });
  }
);

// POST /:taskId/dependencies — add a dependency
taskDependenciesRouter.post(
  '/:taskId/dependencies',
  requireProjectAccess('contributor'),
  (req: Request, res: Response) => {
    const { slug, taskId } = req.params;
    const { blocked_by_task_id } = req.body;

    if (!blocked_by_task_id) {
      res.status(400).json({ error: 'Missing required field: blocked_by_task_id' });
      return;
    }

    if (taskId === blocked_by_task_id) {
      res.status(400).json({ error: 'A task cannot depend on itself' });
      return;
    }

    const db = getDb();

    // Verify both tasks exist in the same project
    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const blockedBy = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(blocked_by_task_id, slug);
    if (!blockedBy) {
      res.status(404).json({ error: 'Blocking task not found in this project' });
      return;
    }

    // Check for duplicate
    const existing = db.prepare(
      'SELECT id FROM task_dependencies WHERE task_id = ? AND blocked_by_task_id = ?'
    ).get(taskId, blocked_by_task_id);
    if (existing) {
      res.status(409).json({ error: 'Dependency already exists' });
      return;
    }

    const id = randomUUID();
    db.prepare(
      'INSERT INTO task_dependencies (id, task_id, blocked_by_task_id) VALUES (?, ?, ?)'
    ).run(id, taskId, blocked_by_task_id);

    const dep = db.prepare('SELECT * FROM task_dependencies WHERE id = ?').get(id);
    res.status(201).json(dep);
  }
);

// DELETE /:taskId/dependencies/:depId — remove a dependency
taskDependenciesRouter.delete(
  '/:taskId/dependencies/:depId',
  requireProjectAccess('contributor'),
  (req: Request, res: Response) => {
    const { slug, taskId, depId } = req.params;
    const db = getDb();

    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const dep = db.prepare(
      'SELECT id FROM task_dependencies WHERE id = ? AND task_id = ?'
    ).get(depId, taskId);
    if (!dep) {
      res.status(404).json({ error: 'Dependency not found' });
      return;
    }

    db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(depId);
    res.status(204).send();
  }
);
```

#### 3. `api/routes/tasks.ts` (UPDATE)

Mount dependencies router:

```typescript
import { taskDependenciesRouter } from './task-dependencies.js';
tasksRouter.use(taskDependenciesRouter);
```

## Study

### Test Cases (16 total)

**Migration (2):**
1. task_dependencies table exists with correct columns
2. UNIQUE constraint prevents duplicate dependencies

**Add dependency (4):**
3. POST creates dependency, returns 201
4. Returns 400 for self-dependency
5. Returns 404 when blocking task not in same project
6. Returns 409 for duplicate dependency

**List forward deps (2):**
7. GET /dependencies returns all tasks that block this task with title/status
8. Returns 404 for non-existent task

**List reverse deps (2):**
9. GET /dependents returns all tasks this task blocks with title/status
10. Returns 404 for non-existent task

**Remove dependency (2):**
11. DELETE removes dependency, returns 204
12. Returns 404 for non-existent dependency

**Cascade (2):**
13. Deleting a task cascades to its dependency entries
14. Deleting a blocking task cascades to dependency entries

**Access control (2):**
15. Viewer can list dependencies (GET)
16. Viewer cannot add dependencies (POST returns 403)

## Act

### Deployment

- Migration 014 creates task_dependencies table
- 3 files: migration (NEW), task-dependencies.ts (NEW), tasks.ts (UPDATE)
- Future: ms-a8-2 adds cycle detection on POST
- Future: ms-a8-4 adds dependency-aware task filtering (promotability)
- Migration from DNA depends_on: a separate script can read existing DNA and populate the table
