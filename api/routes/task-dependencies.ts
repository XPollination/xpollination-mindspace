import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { detectCycle } from '../services/cycle-detection.js';

export const taskDependenciesRouter = Router({ mergeParams: true });

// GET /dependencies — forward: what this task depends on (what blocks it)
taskDependenciesRouter.get('/dependencies', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const deps = db.prepare(
    `SELECT td.*, t.title as blocked_by_title, t.status as blocked_by_status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.blocked_by_task_id
     WHERE td.task_id = ?
     ORDER BY td.created_at DESC`
  ).all(taskId);

  res.status(200).json(deps);
});

// GET /dependents — reverse: what depends on this task (what this task blocks)
taskDependenciesRouter.get('/dependents', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const dependents = db.prepare(
    `SELECT td.*, t.title as task_title, t.status as task_status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.task_id
     WHERE td.blocked_by_task_id = ?
     ORDER BY td.created_at DESC`
  ).all(taskId);

  res.status(200).json(dependents);
});

// POST /dependencies — add dependency edge
taskDependenciesRouter.post('/dependencies', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const { blocked_by_task_id } = req.body;
  const user = (req as any).user;
  const db = getDb();

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (!blocked_by_task_id) {
    res.status(400).json({ error: 'Missing required field: blocked_by_task_id' });
    return;
  }

  // Prevent self-dependency
  if (taskId === blocked_by_task_id) {
    res.status(400).json({ error: 'A task cannot depend on itself' });
    return;
  }

  const blockedBy = db.prepare('SELECT id FROM tasks WHERE id = ?').get(blocked_by_task_id);
  if (!blockedBy) {
    res.status(404).json({ error: 'Blocked-by task not found' });
    return;
  }

  // Cycle detection: check if adding this edge would create a cycle
  const cycleResult = detectCycle(db, taskId, blocked_by_task_id);
  if (cycleResult.hasCycle) {
    res.status(409).json({ error: 'Circular dependency detected', cycle_path: cycleResult.path });
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
    'INSERT INTO task_dependencies (id, task_id, blocked_by_task_id, created_by) VALUES (?, ?, ?, ?)'
  ).run(id, taskId, blocked_by_task_id, user?.id || null);

  const dep = db.prepare('SELECT * FROM task_dependencies WHERE id = ?').get(id);
  res.status(201).json(dep);
});

// DELETE /dependencies/:depId — remove dependency edge
taskDependenciesRouter.delete('/dependencies/:depId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { depId } = req.params;
  const db = getDb();

  const dep = db.prepare('SELECT * FROM task_dependencies WHERE id = ?').get(depId);
  if (!dep) {
    res.status(404).json({ error: 'Dependency not found' });
    return;
  }

  db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(depId);
  res.status(204).send();
});
