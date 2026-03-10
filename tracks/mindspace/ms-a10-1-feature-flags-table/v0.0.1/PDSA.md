# PDSA: Feature Flags Table + CRUD

**Task:** ms-a10-1-feature-flags-table
**Status:** Design
**Version:** v0.0.1

## Plan

Create a feature flags system. Each task can have a feature flag controlling whether its code is active. Flags have states (off/on) with human gate for toggling ON (admin only).

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table (flags reference tasks)
- **t1-3-repos-bootstrap** (complete)

### Investigation

**DNA description:** feature_flags table with id, project_slug, task_id, flag_name, state, toggled_by, toggled_at, created_at, expires_at. CRUD under /api/projects/:slug/flags.

**Design decisions:**
- Flag name format: `flag_<task_slug>` (convention, not enforced)
- States: `off`, `on` (simple boolean-like)
- `toggled_by` tracks who last changed the state
- `expires_at` is optional — for time-limited flags
- UNIQUE(project_slug, flag_name) — one flag per name per project
- task_id is optional — not all flags must be tied to a task
- Toggling ON is admin-only (human gate)
- CRUD: POST (create, contributor), GET list (viewer), GET single (viewer), PUT (toggle, admin for ON, contributor for OFF), DELETE (admin)

## Do

### File Changes

#### 1. `api/db/migrations/018-feature-flags.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  task_id TEXT REFERENCES tasks(id),
  flag_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'off' CHECK(state IN ('off', 'on')),
  toggled_by TEXT REFERENCES users(id),
  toggled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  UNIQUE(project_slug, flag_name)
);

CREATE INDEX idx_feature_flags_project ON feature_flags(project_slug);
CREATE INDEX idx_feature_flags_task ON feature_flags(task_id);
CREATE INDEX idx_feature_flags_state ON feature_flags(project_slug, state);
```

#### 2. `api/routes/feature-flags.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const featureFlagsRouter = Router({ mergeParams: true });

// POST / — create flag (contributor)
featureFlagsRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { flag_name, task_id, expires_at } = req.body;

  if (!flag_name) {
    res.status(400).json({ error: 'Missing required field: flag_name' });
    return;
  }

  const db = getDb();

  // Check duplicate
  const existing = db.prepare('SELECT id FROM feature_flags WHERE project_slug = ? AND flag_name = ?').get(slug, flag_name);
  if (existing) {
    res.status(409).json({ error: `Flag '${flag_name}' already exists in this project` });
    return;
  }

  // Validate task_id if provided
  if (task_id) {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(task_id, slug);
    if (!task) {
      res.status(400).json({ error: 'Invalid task_id: task not found in this project' });
      return;
    }
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO feature_flags (id, project_slug, task_id, flag_name, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, slug, task_id || null, flag_name, expires_at || null);

  const flag = db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(id);
  res.status(201).json(flag);
});

// GET / — list flags (viewer)
featureFlagsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { state } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM feature_flags WHERE project_slug = ?';
  const params: any[] = [slug];

  if (state) {
    sql += ' AND state = ?';
    params.push(state);
  }

  sql += ' ORDER BY created_at DESC';
  const flags = db.prepare(sql).all(...params);
  res.status(200).json(flags);
});

// GET /:flagId — get single flag (viewer)
featureFlagsRouter.get('/:flagId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, flagId } = req.params;
  const db = getDb();

  const flag = db.prepare('SELECT * FROM feature_flags WHERE id = ? AND project_slug = ?').get(flagId, slug);
  if (!flag) {
    res.status(404).json({ error: 'Flag not found' });
    return;
  }

  res.status(200).json(flag);
});

// PUT /:flagId — toggle flag (admin for ON, contributor for OFF)
featureFlagsRouter.put('/:flagId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, flagId } = req.params;
  const user = (req as any).user;
  const { state } = req.body;

  if (!state || !['on', 'off'].includes(state)) {
    res.status(400).json({ error: "state must be 'on' or 'off'" });
    return;
  }

  const db = getDb();
  const flag = db.prepare('SELECT * FROM feature_flags WHERE id = ? AND project_slug = ?').get(flagId, slug) as any;
  if (!flag) {
    res.status(404).json({ error: 'Flag not found' });
    return;
  }

  // Human gate: toggling ON requires admin
  if (state === 'on') {
    const access = (req as any).projectAccess;
    if (access.level < 2) {
      res.status(403).json({ error: 'Toggling flag ON requires admin role (human gate)' });
      return;
    }
  }

  db.prepare(
    "UPDATE feature_flags SET state = ?, toggled_by = ?, toggled_at = datetime('now') WHERE id = ?"
  ).run(state, user.id, flagId);

  const updated = db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(flagId);
  res.status(200).json(updated);
});

// DELETE /:flagId — delete flag (admin)
featureFlagsRouter.delete('/:flagId', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, flagId } = req.params;
  const db = getDb();

  const flag = db.prepare('SELECT id FROM feature_flags WHERE id = ? AND project_slug = ?').get(flagId, slug);
  if (!flag) {
    res.status(404).json({ error: 'Flag not found' });
    return;
  }

  db.prepare('DELETE FROM feature_flags WHERE id = ?').run(flagId);
  res.status(204).send();
});
```

#### 3. `api/routes/projects.ts` (UPDATE)

```typescript
import { featureFlagsRouter } from './feature-flags.js';
projectsRouter.use('/:slug/flags', featureFlagsRouter);
```

## Study

### Test Cases (16 total)

**Create flag (4):**
1. Creates flag with flag_name, returns 201
2. Creates flag with task_id and expires_at
3. Returns 409 for duplicate flag_name in same project
4. Returns 400 for invalid task_id

**List flags (2):**
5. Lists all flags for project
6. Filters by state (on/off)

**Get single flag (2):**
7. Returns flag by ID
8. Returns 404 for non-existent flag

**Toggle flag (4):**
9. Contributor can toggle flag OFF
10. Admin can toggle flag ON
11. Contributor cannot toggle flag ON (403 — human gate)
12. Returns 400 for invalid state value

**Delete flag (2):**
13. Admin can delete flag (204)
14. Returns 404 for non-existent flag

**Access control (2):**
15. Viewer can list/get flags but not create/toggle/delete
16. Contributor can create and toggle OFF but not delete

## Act

### Deployment

- Migration 018 creates feature_flags table with 3 indexes
- 3 files: 018-feature-flags.sql (NEW), feature-flags.ts (NEW), projects.ts (UPDATE)
- Human gate: toggling ON requires admin role
