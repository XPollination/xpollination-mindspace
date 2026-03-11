import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { broadcastBugReported } from '../services/bug-broadcast.js';

export const bugReportsRouter = Router({ mergeParams: true });

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['open', 'investigating', 'resolved', 'closed'];

// POST / — submit bug report (viewer can submit)
bugReportsRouter.post('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { title, description, severity, task_id } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Missing required field: title' });
    return;
  }

  const bugSeverity = severity || 'medium';
  if (!VALID_SEVERITIES.includes(bugSeverity)) {
    res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
    return;
  }

  const db = getDb();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO bug_reports (id, project_slug, title, description, severity, task_id, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, slug, title, description || null, bugSeverity, task_id || null, user.id);

  const bug = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(id) as any;

  // Broadcast BUG_REPORTED event to connected agents
  broadcastBugReported(id, slug, title, bugSeverity);

  res.status(201).json(bug);
});

// GET / — list bugs (viewer, filters: ?status, ?severity via query)
bugReportsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, severity } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM bug_reports WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (severity) {
    sql += ' AND severity = ?';
    params.push(severity);
  }

  sql += ' ORDER BY created_at DESC';
  const bugs = db.prepare(sql).all(...params);
  res.status(200).json(bugs);
});

// GET /:bugId — get single bug (viewer)
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

// POST /:bugId/create-task — convert bug to task (admin only)
bugReportsRouter.post('/:bugId/create-task', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, bugId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const bug = db.prepare('SELECT * FROM bug_reports WHERE id = ? AND project_slug = ?').get(bugId, slug) as any;
  if (!bug) {
    res.status(404).json({ error: 'Bug report not found' });
    return;
  }

  // Pre-fill task from bug data
  const taskTitle = `Bug: ${bug.title}`;
  const taskDescription = [bug.description, bug.steps_to_reproduce].filter(Boolean).join('\n\n');
  const taskId = randomUUID();

  db.prepare(
    `INSERT INTO tasks (id, project_slug, title, description, status, current_role, bug_id, created_by)
     VALUES (?, ?, ?, ?, 'pending', 'pdsa', ?, ?)`
  ).run(taskId, slug, taskTitle, taskDescription || null, bugId, user.id);

  // Update bug status to triaged
  db.prepare(
    "UPDATE bug_reports SET status = 'triaged', updated_at = datetime('now') WHERE id = ? AND project_slug = ?"
  ).run(bugId, slug);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(201).json({ task, bug_id: bugId });
});

// PUT /:bugId — update bug (contributor required). Use closed status instead of DELETE
bugReportsRouter.put('/:bugId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, bugId } = req.params;
  const { title, description, severity, status, task_id } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM bug_reports WHERE id = ? AND project_slug = ?').get(bugId, slug) as any;
  if (!existing) {
    res.status(404).json({ error: 'Bug report not found' });
    return;
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const updatedTitle = title || existing.title;
  const updatedDesc = description !== undefined ? description : existing.description;
  const updatedSeverity = severity || existing.severity;
  const updatedStatus = status || existing.status;
  const updatedTaskId = task_id !== undefined ? task_id : existing.task_id;

  db.prepare(
    `UPDATE bug_reports SET title = ?, description = ?, severity = ?, status = ?, task_id = ?, updated_at = datetime('now')
     WHERE id = ? AND project_slug = ?`
  ).run(updatedTitle, updatedDesc, updatedSeverity, updatedStatus, updatedTaskId, bugId, slug);

  const bug = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(bugId);
  res.status(200).json(bug);
});
