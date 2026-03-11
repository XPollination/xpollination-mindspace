import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const marketplaceAnnouncementsRouter = Router();

const VALID_CATEGORIES = ['feature', 'integration', 'service', 'data'];
const VALID_STATUSES = ['active', 'expired', 'withdrawn'];

marketplaceAnnouncementsRouter.use(requireApiKeyOrJwt);

// GET / — list announcements (authenticated, filters: ?status, ?category, ?project_slug)
marketplaceAnnouncementsRouter.get('/', (req: Request, res: Response) => {
  const { status, category, project_slug } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM marketplace_announcements WHERE 1=1';
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
  const announcements = db.prepare(sql).all(...params);
  res.status(200).json(announcements);
});

// GET /:id — get single announcement
marketplaceAnnouncementsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const announcement = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id);
  if (!announcement) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  res.status(200).json(announcement);
});

// POST / — create announcement (admin of project)
marketplaceAnnouncementsRouter.post('/', (req: Request, res: Response) => {
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
    res.status(403).json({ error: 'Only project admin can create announcements' });
    return;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO marketplace_announcements (id, project_slug, title, description, category, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, project_slug, title, description || null, category, user.id);

  const announcement = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id);
  res.status(201).json(announcement);
});

// PUT /:id — update announcement (admin of project)
marketplaceAnnouncementsRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { title, description, category, status } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  // Check user is admin of the project
  const access = db.prepare('SELECT role FROM project_access WHERE project_slug = ? AND user_id = ?').get(existing.project_slug, user.id) as any;
  const userRow = db.prepare('SELECT is_system_admin FROM users WHERE id = ?').get(user.id) as any;
  if (!access || (access.role !== 'admin' && !(userRow?.is_system_admin === 1))) {
    res.status(403).json({ error: 'Only project admin can update announcements' });
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

  // Use withdrawn status instead of DELETE
  const updatedTitle = title || existing.title;
  const updatedDesc = description !== undefined ? description : existing.description;
  const updatedCategory = category || existing.category;
  const updatedStatus = status || existing.status;

  db.prepare(
    `UPDATE marketplace_announcements SET title = ?, description = ?, category = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(updatedTitle, updatedDesc, updatedCategory, updatedStatus, id);

  const announcement = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id);
  res.status(200).json(announcement);
});
