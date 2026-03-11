import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';
import { contributeMarketplaceItem } from '../services/marketplace-brain.js';

export const marketplaceRequestsRouter = Router();

const VALID_CATEGORIES = ['feature', 'integration', 'service', 'data'];
const VALID_STATUSES = ['open', 'matched', 'fulfilled', 'closed'];

marketplaceRequestsRouter.use(requireApiKeyOrJwt);

// GET / — list requests (authenticated, filters: ?status, ?category, ?project_slug)
marketplaceRequestsRouter.get('/', (req: Request, res: Response) => {
  const { status, category, project_slug } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM marketplace_requests WHERE 1=1';
  const params: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (project_slug) {
    sql += ' AND project_slug = ?';
    params.push(project_slug);
  }

  sql += ' ORDER BY created_at DESC';
  const requests = db.prepare(sql).all(...params);
  res.status(200).json(requests);
});

// GET /:id — get single request
marketplaceRequestsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const request = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id);
  if (!request) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  res.status(200).json(request);
});

// POST / — create request (admin of project)
marketplaceRequestsRouter.post('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  const { project_slug, title, description, category } = req.body;

  if (!project_slug || !title || !category) {
    res.status(400).json({ error: 'Missing required fields: project_slug, title, category' });
    return;
  }

  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  const db = getDb();

  // Check project exists and user is admin
  const access = db.prepare('SELECT role FROM project_access WHERE project_slug = ? AND user_id = ?').get(project_slug, user.id) as any;
  const userRow = db.prepare('SELECT is_system_admin FROM users WHERE id = ?').get(user.id) as any;
  if (!access || (access.role !== 'admin' && !(userRow?.is_system_admin === 1))) {
    res.status(403).json({ error: 'Only project admin can create requests' });
    return;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO marketplace_requests (id, project_slug, title, description, category, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, project_slug, title, description || null, category, user.id);

  const request = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id) as any;

  // Auto-contribute to brain (best-effort)
  contributeMarketplaceItem('request', { id, title, description, category }, project_slug).catch(() => {});

  res.status(201).json(request);
});

// PUT /:id — update request (admin of project). Use closed status instead of DELETE
marketplaceRequestsRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { title, description, category, status } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  // Check user is admin of the project
  const access = db.prepare('SELECT role FROM project_access WHERE project_slug = ? AND user_id = ?').get(existing.project_slug, user.id) as any;
  const userRow = db.prepare('SELECT is_system_admin FROM users WHERE id = ?').get(user.id) as any;
  if (!access || (access.role !== 'admin' && !(userRow?.is_system_admin === 1))) {
    res.status(403).json({ error: 'Only project admin can update requests' });
    return;
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const updatedTitle = title || existing.title;
  const updatedDesc = description !== undefined ? description : existing.description;
  const updatedCategory = category || existing.category;
  const updatedStatus = status || existing.status;

  db.prepare(
    `UPDATE marketplace_requests SET title = ?, description = ?, category = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(updatedTitle, updatedDesc, updatedCategory, updatedStatus, id);

  const request = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id);
  res.status(200).json(request);
});
