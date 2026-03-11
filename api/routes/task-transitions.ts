import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { validateTransition, computeRole } from '../services/task-state-machine.js';
import { checkAndUnblock } from '../services/blocked-status.js';
import { broadcastTaskAvailable } from '../services/task-broadcast.js';

export const taskTransitionsRouter = Router({ mergeParams: true });

// POST / — execute a task transition
taskTransitionsRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const { to_status, actor, reason } = req.body;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (!to_status) {
    res.status(400).json({ error: 'Missing required field: to_status' });
    return;
  }

  const validation = validateTransition(task.status, to_status);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const newRole = computeRole(task.status, to_status, actor);

  // Record transition in history
  db.prepare(
    'INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, actor_role, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), taskId, task.status, to_status, actor || null, newRole || task.current_role, reason || null);

  // Update task status and role
  if (newRole) {
    db.prepare(
      "UPDATE tasks SET status = ?, current_role = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(to_status, newRole, taskId);
  } else {
    db.prepare(
      "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(to_status, taskId);
  }

  // Auto-unblock: when task completes, check dependents and unblock if all deps satisfied
  let auto_unblocked: string[] = [];
  if (to_status === 'complete') {
    auto_unblocked = checkAndUnblock(db, taskId);
  }

  // Auto-create approval_request on approval transition
  let approval_request_id: string | null = null;
  if (to_status === 'approval') {
    const user = (req as any).user;
    approval_request_id = randomUUID();
    db.prepare(
      'INSERT INTO approval_requests (id, task_id, project_slug, requested_by, status) VALUES (?, ?, ?, ?, ?)'
    ).run(approval_request_id, taskId, slug, user?.id || null, 'pending');
  }

  // Broadcast TASK_AVAILABLE when task enters ready or unclaimed state
  if (to_status === 'ready' || to_status === 'rework') {
    broadcastTaskAvailable(taskId, slug, newRole || task.current_role, task.title);
  }

  // Also broadcast for auto-unblocked tasks
  for (const unblockedId of auto_unblocked) {
    const unblockedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(unblockedId) as any;
    if (unblockedTask) {
      broadcastTaskAvailable(unblockedId, slug, unblockedTask.current_role, unblockedTask.title);
    }
  }

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json({
    transition: { from: task.status, to: to_status },
    role: newRole || task.current_role,
    task: updatedTask,
    auto_unblocked,
    approval_request_id
  });
});

// GET / — list transition history for a task
taskTransitionsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const transitions = db.prepare(
    'SELECT * FROM task_transitions WHERE task_id = ? ORDER BY created_at DESC'
  ).all(taskId);

  res.status(200).json(transitions);
});
