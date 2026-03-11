import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';
import { renewLease } from '../services/lease-service.js';

export const taskHeartbeatRouter = Router();

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

// Role-based lease durations in hours (mirror of lease-service)
const ROLE_DURATIONS: Record<string, number> = {
  pdsa: 4,
  dev: 6,
  qa: 3,
  liaison: 2,
};

taskHeartbeatRouter.use(requireApiKeyOrJwt);

// POST /api/tasks/:taskId/heartbeat — validate liveness, reset lease expiry
taskHeartbeatRouter.post('/:taskId/heartbeat', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { brain_thought_id } = req.body;
  const user = (req as any).user;

  if (!brain_thought_id) {
    res.status(400).json({ error: 'Missing required field: brain_thought_id' });
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

  // Find active lease for this task
  const lease = db.prepare(
    "SELECT * FROM leases WHERE task_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(taskId) as any;

  if (!lease) {
    res.status(404).json({ error: 'No active lease found for this task' });
    return;
  }

  // Reset expires_at by role duration
  const role = task.current_role || 'dev';
  const hours = ROLE_DURATIONS[role.toLowerCase()] || 4;
  const updatedLease = renewLease(db, lease.id, hours);

  // Best-effort brain thought validation (non-blocking)
  try {
    await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`
      },
      body: JSON.stringify({
        prompt: `Validate thought exists: ${brain_thought_id}`,
        agent_id: 'system',
        agent_name: 'SYSTEM',
        read_only: true
      })
    });
  } catch {
    // Best-effort — don't block heartbeat on brain validation failure
  }

  res.status(200).json(updatedLease);
});
