# PDSA: Bug → Task Creation Endpoint

**Task:** ms-a16-4-bug-to-task
**Status:** Design
**Version:** v0.0.1

## Plan

Admin endpoint to convert a bug report into a task. Pre-fills task title/description from bug data, links bug_id to the new task.

### Dependencies
- ms-a16-1-bug-reports (bug_reports table)
- ms-a3-1-tasks-crud (task creation)

### Investigation

**Existing task creation (`api/routes/tasks.ts`):**
- POST `/` creates task with title, description, status, etc.
- Auto-generates feature flag

**Design decisions:**
1. POST `/api/projects/:slug/bugs/:bugId/create-task` (admin only)
2. Pre-fills: `title = "Bug: [bug title]"`, `description = bug.description + bug.steps_to_reproduce`
3. Sets task status to 'pending', role to 'pdsa' (needs design first)
4. Links bug_id in task metadata or adds bug_id column to tasks
5. Updates bug status to 'triaged'

## Do

### File Changes

#### 1. `api/routes/bug-reports.ts` (UPDATE — add nested route)
```typescript
// POST /:bugId/create-task — convert bug to task (admin only)
bugReportsRouter.post('/:bugId/create-task', requireProjectAccess('admin'), (req, res) => {
  const { slug, bugId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const bug = db.prepare('SELECT * FROM bug_reports WHERE id = ? AND project_slug = ?').get(bugId, slug) as any;
  if (!bug) return res.status(404).json({ error: 'Bug report not found' });

  const taskId = randomUUID();
  const title = `Bug: ${bug.title}`;
  const description = `${bug.description}\n\nSteps to reproduce:\n${bug.steps_to_reproduce || 'N/A'}\n\nOriginal bug: ${bugId}`;

  db.prepare(
    "INSERT INTO tasks (id, project_slug, title, description, status, current_role, created_by, bug_id) VALUES (?, ?, ?, ?, 'pending', 'pdsa', ?, ?)"
  ).run(taskId, slug, title, description, user.id, bugId);

  // Update bug status
  db.prepare("UPDATE bug_reports SET status = 'triaged', updated_at = datetime('now') WHERE id = ?").run(bugId);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(201).json({ task, bug_id: bugId });
});
```

Note: May need `ALTER TABLE tasks ADD COLUMN bug_id TEXT` migration if not present.

## Study

### Test Cases (8)
1. POST creates task from bug with pre-filled title
2. Task description includes bug description + steps
3. Task starts at 'pending' with role 'pdsa'
4. Bug status updated to 'triaged'
5. Bug not found → 404
6. Non-admin → 403
7. Task links to bug_id
8. Auto-generated feature flag created for new task

## Act
- 1 route update (or new file), possibly 1 migration for bug_id column
