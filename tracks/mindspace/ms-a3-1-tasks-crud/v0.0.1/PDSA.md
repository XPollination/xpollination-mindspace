# PDSA: Tasks Table + Basic CRUD

**Task:** ms-a3-1-tasks-crud
**Status:** Design
**Version:** v0.0.1

## Plan

Create the tasks table and basic CRUD endpoints. Tasks are scoped to projects and represent units of work that agents claim and transition through a state machine.

### Problem

The mindspace API has no task management. Agents need to discover, claim, and work on tasks. This task creates the foundation: table schema and basic CRUD operations. State machine transitions (ms-a3-2) and claiming (ms-a3-3) are separate tasks.

### Dependencies

- **ms-a0-7-migrations** (complete): Migration infrastructure
- **ms-a2-3-access-middleware** (complete): Project access control
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**Existing patterns:**
- Projects use slug-based routing with `/:slug` params
- Agent pool is nested under projects: `/:slug/agents` with `mergeParams`
- Access middleware `requireProjectAccess(minRole)` checks membership
- UUIDs via `randomUUID()` for IDs
- All tables use `datetime('now')` for timestamps

**DNA schema (from task description):**
id, project_slug, requirement_id, title, description, status, current_role, claimed_by, claimed_at, feature_flag_name, created_at, created_by

**Design decisions:**
- Tasks are project-scoped: `project_slug` FK to projects table
- `requirement_id` is optional nullable — not all tasks link to requirements
- `status` defaults to 'pending' — state machine (ms-a3-2) will define valid transitions
- `current_role` tracks which role should work on the task (pdsa/dev/qa/liaison)
- `claimed_by` references agents table (agent claiming the task)
- `feature_flag_name` is optional — will be used by ms-a10-x for feature flag integration
- Basic CRUD only: create, read (single + list), update, delete. No transitions or claiming in this task.

## Do

### File Changes

#### 1. `api/db/migrations/011-tasks.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  requirement_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'active', 'review', 'approval', 'approved', 'testing', 'rework', 'blocked', 'complete')),
  current_role TEXT CHECK(current_role IN ('pdsa', 'dev', 'qa', 'liaison', NULL)),
  claimed_by TEXT REFERENCES agents(id),
  claimed_at TEXT,
  feature_flag_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_slug);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_role ON tasks(current_role);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
```

**Note:** If ms-a2-4-system-admin takes migration 011, this becomes 012. The migration runner handles ordering.

#### 2. `api/routes/tasks.ts` (NEW)

Task CRUD router, nested under projects at `/:slug/tasks`.

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const tasksRouter = Router({ mergeParams: true });

const VALID_STATUSES = ['pending', 'ready', 'active', 'review', 'approval', 'approved', 'testing', 'rework', 'blocked', 'complete'];
const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison'];

// All task routes require at least viewer access to the project
tasksRouter.use(requireProjectAccess('viewer'));

// POST / — create task (requires contributor role)
tasksRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { title, description, requirement_id, status, current_role, feature_flag_name } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Missing required field: title' });
    return;
  }

  // Validate optional status
  const taskStatus = status || 'pending';
  if (!VALID_STATUSES.includes(taskStatus)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  // Validate optional current_role
  if (current_role && !VALID_ROLES.includes(current_role)) {
    res.status(400).json({ error: `Invalid current_role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const db = getDb();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO tasks (id, project_slug, requirement_id, title, description, status, current_role, feature_flag_name, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, slug, requirement_id || null, title, description || null, taskStatus, current_role || null, feature_flag_name || null, user.id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(task);
});

// GET / — list tasks for project (optional filters: status, current_role)
tasksRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, current_role } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM tasks WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (current_role) {
    sql += ' AND current_role = ?';
    params.push(current_role);
  }

  sql += ' ORDER BY created_at DESC';
  const tasks = db.prepare(sql).all(...params);
  res.status(200).json(tasks);
});

// GET /:taskId — get single task
tasksRouter.get('/:taskId', (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  res.status(200).json(task);
});

// PUT /:taskId — update task (requires contributor role)
tasksRouter.put('/:taskId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const { title, description, requirement_id, current_role, feature_flag_name } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!existing) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Validate optional current_role
  if (current_role !== undefined && current_role !== null && !VALID_ROLES.includes(current_role)) {
    res.status(400).json({ error: `Invalid current_role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const updatedTitle = title || existing.title;
  const updatedDescription = description !== undefined ? description : existing.description;
  const updatedRequirementId = requirement_id !== undefined ? requirement_id : existing.requirement_id;
  const updatedRole = current_role !== undefined ? current_role : existing.current_role;
  const updatedFlag = feature_flag_name !== undefined ? feature_flag_name : existing.feature_flag_name;

  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, requirement_id = ?, current_role = ?, feature_flag_name = ?, updated_at = datetime('now')
     WHERE id = ? AND project_slug = ?`
  ).run(updatedTitle, updatedDescription, updatedRequirementId, updatedRole, updatedFlag, taskId, slug);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json(task);
});

// DELETE /:taskId — delete task (requires admin role)
tasksRouter.delete('/:taskId', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
  if (!existing) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  db.prepare('DELETE FROM tasks WHERE id = ? AND project_slug = ?').run(taskId, slug);
  res.status(204).send();
});
```

#### 3. `api/routes/projects.ts` (UPDATE)

Add tasks router mount:

```typescript
// Add import
import { tasksRouter } from './tasks.js';

// Add mount (after agent pool)
projectsRouter.use('/:slug/tasks', tasksRouter);
```

### Access Control

| Operation | Minimum Role |
|-----------|-------------|
| List tasks | viewer |
| Get task | viewer |
| Create task | contributor |
| Update task | contributor |
| Delete task | admin |

**Note:** Status changes are NOT allowed via PUT — that's the state machine's job (ms-a3-2). PUT only updates metadata fields.

## Study

### Test Cases (17 total)

**Migration (1):**
1. tasks table exists with all columns and correct constraints

**Create task (4):**
2. Creates task with title, returns 201 with generated id
3. Creates task with all optional fields (description, requirement_id, status, current_role, feature_flag_name)
4. Returns 400 when title is missing
5. Returns 400 for invalid status or current_role

**List tasks (3):**
6. Returns all tasks for a project
7. Filters by status query parameter
8. Filters by current_role query parameter

**Get task (2):**
9. Returns task by id within project
10. Returns 404 for non-existent task

**Update task (3):**
11. Updates title and description, returns updated task
12. Returns 404 for non-existent task
13. Returns 400 for invalid current_role

**Delete task (2):**
14. Deletes task, returns 204
15. Returns 404 for non-existent task

**Access control (2):**
16. Viewer cannot create tasks (403)
17. Contributor cannot delete tasks (403)

## Act

### Deployment

- Migration creates tasks table — no data migration needed
- Mount at `/api/projects/:slug/tasks` in projects.ts
- 3 files: migration (NEW), tasks.ts (NEW), projects.ts (UPDATE)
- No breaking changes to existing endpoints
