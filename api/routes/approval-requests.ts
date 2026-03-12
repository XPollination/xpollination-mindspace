import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { checkExpiredApprovals } from '../services/approval-expiry.js';
import { sendToAgent, broadcast } from '../lib/sse-manager.js';

export const approvalRequestsRouter = Router({ mergeParams: true });

// GET /count — pending and total approval counts for viz badge
approvalRequestsRouter.get('/count', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const pending = db.prepare(
    "SELECT COUNT(*) as count FROM approval_requests WHERE project_slug = ? AND status = 'pending'"
  ).get(slug) as { count: number };

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM approval_requests WHERE project_slug = ?'
  ).get(slug) as { count: number };

  res.status(200).json({ pending: pending.count, total: total.count });
});

// POST /check-expiry — trigger expiry check (admin only)
approvalRequestsRouter.post('/check-expiry', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const result = checkExpiredApprovals(db);
  res.status(200).json({ expired_count: result.expired_count, expired_ids: result.expired_ids });
});

// GET / — list approval requests for project
approvalRequestsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM approval_requests WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';
  const requests = db.prepare(sql).all(...params);
  res.status(200).json(requests);
});

// GET /:approvalId — get single approval request
approvalRequestsRouter.get('/:approvalId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, approvalId } = req.params;
  const db = getDb();

  const request = db.prepare('SELECT * FROM approval_requests WHERE id = ? AND project_slug = ?').get(approvalId, slug);
  if (!request) {
    res.status(404).json({ error: 'Approval request not found' });
    return;
  }

  res.status(200).json(request);
});

// PUT /:approvalId/approve — approve a pending request (admin only)
approvalRequestsRouter.put('/:approvalId/approve', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, approvalId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const request = db.prepare('SELECT * FROM approval_requests WHERE id = ? AND project_slug = ?').get(approvalId, slug) as any;
  if (!request) {
    res.status(404).json({ error: 'Approval request not found' });
    return;
  }

  if (request.status !== 'pending') {
    res.status(400).json({ error: `Cannot approve: request is already ${request.status}` });
    return;
  }

  // Set approval status to approved, record approved_by
  const approved_by = user?.id || null;
  db.prepare(
    "UPDATE approval_requests SET status = 'approved', decided_by = ?, decided_at = datetime('now') WHERE id = ?"
  ).run(approved_by, approvalId);

  // Transition the task from approval to approved
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(request.task_id) as any;
  if (task) {
    db.prepare(
      "UPDATE tasks SET status = 'approved', updated_at = datetime('now') WHERE id = ?"
    ).run(request.task_id);
  }

  const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(approvalId);
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(request.task_id);

  // Emit TASK_APPROVED SSE event to requesting agent
  const task_slug = task?.slug || null;
  const approvalEvent = {
    event: 'TASK_APPROVED',
    approval_request_id: approvalId,
    task_slug,
    task_id: request.task_id,
    decision: 'approved',
    actor: approved_by
  };
  // Try sendToAgent for direct delivery, fallback to broadcast
  if (request.requesting_agent) {
    sendToAgent(request.requesting_agent, 'TASK_APPROVED', approvalEvent);
  } else {
    broadcast('TASK_APPROVED', approvalEvent);
  }

  res.status(200).json({ approval, task: updatedTask });
});

// PUT /:approvalId/reject — reject a pending request (admin only)
approvalRequestsRouter.put('/:approvalId/reject', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, approvalId } = req.params;
  const user = (req as any).user;
  const { reason } = req.body;
  const db = getDb();

  if (!reason) {
    res.status(400).json({ error: 'Missing required field: reason' });
    return;
  }

  const request = db.prepare('SELECT * FROM approval_requests WHERE id = ? AND project_slug = ?').get(approvalId, slug) as any;
  if (!request) {
    res.status(404).json({ error: 'Approval request not found' });
    return;
  }

  if (request.status !== 'pending') {
    res.status(400).json({ error: `Cannot reject: request is already ${request.status}` });
    return;
  }

  // Set approval status to rejected with reason
  db.prepare(
    "UPDATE approval_requests SET status = 'rejected', decided_by = ?, decided_at = datetime('now'), reason = ? WHERE id = ?"
  ).run(user?.id || null, reason, approvalId);

  // Transition task to rework
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(request.task_id) as any;
  if (task) {
    db.prepare(
      "UPDATE tasks SET status = 'rework', updated_at = datetime('now') WHERE id = ?"
    ).run(request.task_id);
  }

  const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(approvalId);
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(request.task_id);

  // Emit TASK_REJECTED SSE event to requesting agent
  const reject_task_slug = task?.slug || null;
  const rejectionEvent = {
    event: 'TASK_REJECTED',
    approval_request_id: approvalId,
    task_slug: reject_task_slug,
    task_id: request.task_id,
    decision: 'rejected',
    reason,
    actor: user?.id || null
  };
  // Try sendToAgent for direct delivery, fallback to broadcast
  if (request.requesting_agent) {
    sendToAgent(request.requesting_agent, 'TASK_REJECTED', rejectionEvent);
  } else {
    broadcast('TASK_REJECTED', rejectionEvent);
  }

  res.status(200).json({ approval, task: updatedTask });
});
