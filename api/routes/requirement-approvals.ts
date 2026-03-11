import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const requirementApprovalsRouter = Router({ mergeParams: true });

// POST /:reqId/approve — request approval (generates token with 1hr TTL)
requirementApprovalsRouter.post('/:reqId/approve', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, reqId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const requirement = db.prepare('SELECT id FROM requirements WHERE id = ? AND project_slug = ?').get(reqId, slug);
  if (!requirement) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  const id = randomUUID();
  const token = randomUUID();
  // 1 hour TTL
  const expires_at = new Date(Date.now() + 3600000).toISOString();

  db.prepare(
    `INSERT INTO requirement_approvals (id, requirement_id, project_slug, token, status, requested_by, expires_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  ).run(id, reqId, slug, token, user?.id || null, expires_at);

  const approval = db.prepare('SELECT * FROM requirement_approvals WHERE id = ?').get(id);
  res.status(201).json(approval);
});

// POST /approve/confirm — confirm with token (checks expiry)
requirementApprovalsRouter.post('/approve/confirm', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { token } = req.body;
  const db = getDb();

  if (!token) {
    res.status(400).json({ error: 'Missing required field: token' });
    return;
  }

  const approval = db.prepare('SELECT * FROM requirement_approvals WHERE token = ?').get(token) as any;
  if (!approval) {
    res.status(404).json({ error: 'Approval not found — invalid token' });
    return;
  }

  // Check if expired
  if (new Date(approval.expires_at) < new Date()) {
    db.prepare("UPDATE requirement_approvals SET status = 'expired' WHERE id = ?").run(approval.id);
    res.status(400).json({ error: 'Token expired' });
    return;
  }

  if (approval.status !== 'pending') {
    res.status(409).json({ error: `Approval already ${approval.status}` });
    return;
  }

  db.prepare(
    `UPDATE requirement_approvals SET status = 'confirmed', confirmed_by = ?, confirmed_at = datetime('now')
     WHERE id = ?`
  ).run(user?.id || null, approval.id);

  const updated = db.prepare('SELECT * FROM requirement_approvals WHERE id = ?').get(approval.id);
  res.status(200).json(updated);
});
