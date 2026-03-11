import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { checkExpiredApprovals } from '../services/approval-expiry.js';

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
