import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const approvalRequestsRouter = Router({ mergeParams: true });

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
