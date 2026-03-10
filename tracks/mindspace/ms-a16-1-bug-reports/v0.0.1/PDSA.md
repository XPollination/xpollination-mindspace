# PDSA: Bug Reports Table + Submission Endpoint

**Task:** ms-a16-1-bug-reports
**Status:** Design
**Version:** v0.0.1

## Plan

Create a bug reporting system where project members can submit and track bug reports per project.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table (bugs may link to tasks)
- **t1-3-repos-bootstrap** (complete)

### Investigation

**DNA description:** Migration: bug_reports table. POST /api/projects/:slug/bugs for submission. GET for list. AC: Bugs can be submitted and listed per project.

**Design decisions:**
- Scoped per project: /api/projects/:slug/bugs
- Fields: title, description, severity (low/medium/high/critical), status (open/investigating/resolved/closed), reported_by, task_id (optional link to related task)
- Any project viewer can submit bugs (low barrier)
- Any viewer can list/get
- Status changes require contributor
- No DELETE — bugs are closed, not deleted (audit trail)

## Do

### File Changes

#### 1. `api/db/migrations/021-bug-reports.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS bug_reports (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved', 'closed')),
  task_id TEXT REFERENCES tasks(id),
  reported_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bug_reports_project ON bug_reports(project_slug);
CREATE INDEX idx_bug_reports_status ON bug_reports(project_slug, status);
CREATE INDEX idx_bug_reports_severity ON bug_reports(project_slug, severity);
```

#### 2. `api/routes/bug-reports.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const bugReportsRouter = Router({ mergeParams: true });

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['open', 'investigating', 'resolved', 'closed'];

// POST / — submit bug report (viewer)
bugReportsRouter.post('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { title, description, severity, task_id } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Missing required field: title' });
    return;
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
    return;
  }

  const db = getDb();

  if (task_id) {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(task_id, slug);
    if (!task) {
      res.status(400).json({ error: 'Invalid task_id: task not found in this project' });
      return;
    }
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO bug_reports (id, project_slug, title, description, severity, task_id, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, slug, title, description || null, severity || 'medium', task_id || null, user.id);

  const bug = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(id);
  res.status(201).json(bug);
});

// GET / — list bug reports (viewer)
bugReportsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, severity } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM bug_reports WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (severity) { sql += ' AND severity = ?'; params.push(severity); }

  sql += ' ORDER BY created_at DESC';
  const bugs = db.prepare(sql).all(...params);
  res.status(200).json(bugs);
});

// GET /:bugId — get single bug report (viewer)
bugReportsRouter.get('/:bugId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, bugId } = req.params;
  const db = getDb();

  const bug = db.prepare('SELECT * FROM bug_reports WHERE id = ? AND project_slug = ?').get(bugId, slug);
  if (!bug) {
    res.status(404).json({ error: 'Bug report not found' });
    return;
  }

  res.status(200).json(bug);
});

// PUT /:bugId — update bug report (contributor for status, viewer for own description)
bugReportsRouter.put('/:bugId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, bugId } = req.params;
  const { title, description, severity, status, task_id } = req.body;

  const db = getDb();
  const bug = db.prepare('SELECT * FROM bug_reports WHERE id = ? AND project_slug = ?').get(bugId, slug) as any;
  if (!bug) {
    res.status(404).json({ error: 'Bug report not found' });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
    return;
  }

  db.prepare(
    "UPDATE bug_reports SET title = ?, description = ?, severity = ?, status = ?, task_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(
    title || bug.title,
    description !== undefined ? description : bug.description,
    severity || bug.severity,
    status || bug.status,
    task_id !== undefined ? task_id : bug.task_id,
    bugId
  );

  const updated = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(bugId);
  res.status(200).json(updated);
});
```

#### 3. `api/routes/projects.ts` (UPDATE)

```typescript
import { bugReportsRouter } from './bug-reports.js';
projectsRouter.use('/:slug/bugs', bugReportsRouter);
```

## Study

### Test Cases (14 total)

**Submit bug (4):**
1. Creates bug with title only, returns 201 with default severity/status
2. Creates bug with all fields (description, severity, task_id)
3. Returns 400 for invalid severity
4. Returns 400 for invalid task_id

**List bugs (3):**
5. Lists all bugs for project
6. Filters by status and severity
7. Returns empty array when no bugs

**Get single (2):**
8. Returns bug by ID
9. Returns 404 for non-existent bug

**Update bug (3):**
10. Updates status, severity, description
11. Returns 404 for non-existent bug
12. Returns 400 for invalid status

**Access control (2):**
13. Viewer can submit and list bugs
14. Viewer cannot update bugs (requires contributor)

## Act

### Deployment

- Migration 021 creates bug_reports table with 3 indexes
- 3 files: 021-bug-reports.sql (NEW), bug-reports.ts (NEW), projects.ts (UPDATE)
- Scoped per project at /api/projects/:slug/bugs
- No DELETE — bugs are closed, not deleted
