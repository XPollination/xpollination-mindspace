import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { createLease } from '../services/lease-service.js';
import { broadcastTaskAvailable } from '../services/task-broadcast.js';

export const taskClaimingRouter = Router({ mergeParams: true });

// POST /:taskId/claim — claim a task
taskClaimingRouter.post('/:taskId/claim', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (task.claimed_by && task.claimed_by !== user.id) {
    res.status(409).json({ error: 'Task already claimed by another user' });
    return;
  }

  db.prepare(
    `UPDATE tasks SET claimed_by = ?, claimed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND project_slug = ?`
  ).run(user.id, taskId, slug);

  // Create lease on claim with role-based duration
  const lease = createLease(db, taskId, user.id, task.current_role || 'dev');

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json({ ...updated as any, lease });
});

// DELETE /:taskId/claim — unclaim a task
taskClaimingRouter.delete('/:taskId/claim', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  db.prepare(
    `UPDATE tasks SET claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now')
     WHERE id = ? AND project_slug = ?`
  ).run(taskId, slug);

  // Broadcast TASK_AVAILABLE on unclaim
  broadcastTaskAvailable(taskId, slug, task.current_role || 'dev');

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json(updated);
});
