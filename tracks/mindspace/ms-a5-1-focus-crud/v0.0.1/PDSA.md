# PDSA: Focus Table + Set/Get/Clear Endpoints

**Task:** ms-a5-1-focus-crud
**Status:** Design
**Version:** v0.0.1

## Plan

Create a project focus mechanism. Focus defines what a project team should concentrate on — a text scope that can be used to filter and prioritize tasks.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table (focus references tasks)
- **t1-3-repos-bootstrap** (complete)

### Investigation

**DNA description:** project_focus table, PUT/GET/DELETE with admin-only set, human gate.

**Design decisions:**
- One focus per project (singleton pattern — UNIQUE on project_slug)
- Focus has: scope text, optional task_ids array (which tasks are in focus), set_by user
- PUT = set/update focus (admin only — human gate)
- GET = read current focus (viewer accessible)
- DELETE = clear focus (admin only)
- Focus is a simple text scope, not a complex filter system (ms-a5-2 handles filtering)

## Do

### File Changes

#### 1. `api/db/migrations/016-project-focus.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS project_focus (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL UNIQUE REFERENCES projects(slug),
  scope TEXT NOT NULL,
  task_ids TEXT,
  set_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`task_ids` is a JSON array stored as TEXT (e.g., `["task-1", "task-2"]`). Optional — focus can be scope-only without explicit task IDs.

#### 2. `api/routes/focus.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const focusRouter = Router({ mergeParams: true });

// GET / — get current focus (viewer)
focusRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const focus = db.prepare('SELECT * FROM project_focus WHERE project_slug = ?').get(slug) as any;
  if (!focus) {
    res.status(200).json({ project_slug: slug, focus: null });
    return;
  }

  res.status(200).json({
    project_slug: slug,
    focus: {
      id: focus.id,
      scope: focus.scope,
      task_ids: focus.task_ids ? JSON.parse(focus.task_ids) : [],
      set_by: focus.set_by,
      created_at: focus.created_at,
      updated_at: focus.updated_at
    }
  });
});

// PUT / — set or update focus (admin only — human gate)
focusRouter.put('/', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { scope, task_ids } = req.body;

  if (!scope) {
    res.status(400).json({ error: 'Missing required field: scope' });
    return;
  }

  if (task_ids !== undefined && !Array.isArray(task_ids)) {
    res.status(400).json({ error: 'task_ids must be an array' });
    return;
  }

  const db = getDb();
  const taskIdsJson = task_ids ? JSON.stringify(task_ids) : null;

  const existing = db.prepare('SELECT id FROM project_focus WHERE project_slug = ?').get(slug);
  if (existing) {
    db.prepare(
      "UPDATE project_focus SET scope = ?, task_ids = ?, set_by = ?, updated_at = datetime('now') WHERE project_slug = ?"
    ).run(scope, taskIdsJson, user.id, slug);
  } else {
    const id = randomUUID();
    db.prepare(
      'INSERT INTO project_focus (id, project_slug, scope, task_ids, set_by) VALUES (?, ?, ?, ?, ?)'
    ).run(id, slug, scope, taskIdsJson, user.id);
  }

  const focus = db.prepare('SELECT * FROM project_focus WHERE project_slug = ?').get(slug) as any;
  res.status(200).json({
    project_slug: slug,
    focus: {
      id: focus.id,
      scope: focus.scope,
      task_ids: focus.task_ids ? JSON.parse(focus.task_ids) : [],
      set_by: focus.set_by,
      updated_at: focus.updated_at
    }
  });
});

// DELETE / — clear focus (admin only)
focusRouter.delete('/', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM project_focus WHERE project_slug = ?').get(slug);
  if (!existing) {
    res.status(404).json({ error: 'No focus set for this project' });
    return;
  }

  db.prepare('DELETE FROM project_focus WHERE project_slug = ?').run(slug);
  res.status(204).send();
});
```

#### 3. `api/routes/projects.ts` (UPDATE)

```typescript
import { focusRouter } from './focus.js';
projectsRouter.use('/:slug/focus', focusRouter);
```

## Study

### Test Cases (12 total)

**GET focus (3):**
1. Returns null focus when none set
2. Returns focus object with scope, task_ids, set_by
3. task_ids parsed from JSON to array in response

**SET focus (4):**
4. PUT creates new focus, returns 200
5. PUT updates existing focus
6. Returns 400 when scope missing
7. Returns 400 when task_ids is not an array

**CLEAR focus (2):**
8. DELETE removes focus, returns 204
9. DELETE returns 404 when no focus exists

**Access control (3):**
10. Viewer can GET focus
11. Viewer cannot PUT focus (403)
12. Viewer cannot DELETE focus (403)

## Act

### Deployment

- Migration 016 creates project_focus table
- 3 files: migration (NEW), focus.ts (NEW), projects.ts (UPDATE)
- Singleton per project (UNIQUE on project_slug)
