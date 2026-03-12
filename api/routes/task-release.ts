import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const taskReleaseRouter = Router();

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

taskReleaseRouter.use(requireApiKeyOrJwt);

// POST /api/tasks/:taskId/release — voluntary release of claimed task
taskReleaseRouter.post('/:taskId/release', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { reason } = req.body;
  const user = (req as any).user;

  if (!reason) {
    res.status(400).json({ error: 'Missing required field: reason' });
    return;
  }

  const db = getDb();

  // Validate task exists
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Validate task is claimed by this user
  if (task.claimed_by !== user.id) {
    res.status(403).json({ error: 'Task not claimed by you' });
    return;
  }

  // Find active lease
  const lease = db.prepare(
    "SELECT * FROM leases WHERE task_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(taskId) as any;

  // Set lease status to released (if exists)
  if (lease) {
    db.prepare(
      "UPDATE leases SET status = 'released' WHERE id = ?"
    ).run(lease.id);
  }

  // Unclaim task: set claimed_by = NULL
  db.prepare(
    'UPDATE tasks SET claimed_by = NULL WHERE id = ?'
  ).run(taskId);

  // Auto-contribute release reason to brain (best-effort, preserves for tokenomics)
  try {
    await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`
      },
      body: JSON.stringify({
        prompt: `Task released: ${task.title || taskId}. Reason: ${reason}`,
        agent_id: user.id,
        agent_name: user.name || 'SYSTEM',
        thought_category: 'task_outcome',
        topic: `task-${taskId}`,
        context: `voluntary release by ${user.id}`
      })
    });
  } catch {
    // Best-effort — don't block release on brain failure
  }

  res.status(200).json({ released: true, task_id: taskId, reason });
});
