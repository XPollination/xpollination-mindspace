import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const suspectLinksRouter = Router({ mergeParams: true });

const VALID_SOURCE_TYPES = ['requirement', 'code', 'test', 'decision'];
const VALID_TARGET_TYPES = ['requirement', 'code', 'test', 'decision'];
const VALID_STATUSES = ['suspect', 'cleared', 'accepted_risk'];

// GET / — list suspect links with optional filters (status, source_type)
suspectLinksRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, source_type } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM suspect_links WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (source_type) {
    sql += ' AND source_type = ?';
    params.push(source_type);
  }

  sql += ' ORDER BY created_at DESC';
  const links = db.prepare(sql).all(...params);
  res.status(200).json(links);
});

// GET /stats — counts by status
suspectLinksRouter.get('/stats', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const rows = db.prepare(
    'SELECT status, COUNT(*) as count FROM suspect_links WHERE project_slug = ? GROUP BY status'
  ).all(slug) as any[];

  const stats: Record<string, number> = {};
  for (const row of rows) {
    stats[row.status] = row.count;
  }

  res.status(200).json(stats);
});

// POST / — create a suspect link
suspectLinksRouter.post('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { source_type, source_ref, target_type, target_ref, reason } = req.body;

  if (!source_type || !source_ref || !target_type || !target_ref) {
    res.status(400).json({ error: 'Missing required fields: source_type, source_ref, target_type, target_ref' });
    return;
  }

  if (!VALID_SOURCE_TYPES.includes(source_type)) {
    res.status(400).json({ error: `Invalid source_type. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}` });
    return;
  }

  if (!VALID_TARGET_TYPES.includes(target_type)) {
    res.status(400).json({ error: `Invalid target_type. Must be one of: ${VALID_TARGET_TYPES.join(', ')}` });
    return;
  }

  const db = getDb();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO suspect_links (id, source_type, source_ref, target_type, target_ref, reason, status, project_slug)
     VALUES (?, ?, ?, ?, ?, ?, 'suspect', ?)`
  ).run(id, source_type, source_ref, target_type, target_ref, reason || null, slug);

  const link = db.prepare('SELECT * FROM suspect_links WHERE id = ?').get(id);
  res.status(201).json(link);
});

// PUT /:id — update suspect link status (clear or accept risk)
suspectLinksRouter.put('/:id', (req: Request, res: Response) => {
  const { slug, id } = req.params;
  const { status, cleared_by } = req.body;
  const db = getDb();

  const existing = db.prepare(
    'SELECT * FROM suspect_links WHERE id = ? AND project_slug = ?'
  ).get(id, slug);

  if (!existing) {
    res.status(404).json({ error: 'Suspect link not found' });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const newStatus = status || (existing as any).status;
  const now = new Date().toISOString();

  if (newStatus === 'cleared' || newStatus === 'accepted_risk') {
    db.prepare(
      `UPDATE suspect_links SET status = ?, cleared_by = ?, cleared_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(newStatus, cleared_by || null, now, now, id);
  } else {
    db.prepare(
      `UPDATE suspect_links SET status = ?, updated_at = ? WHERE id = ?`
    ).run(newStatus, now, id);
  }

  const link = db.prepare('SELECT * FROM suspect_links WHERE id = ?').get(id);
  res.status(200).json(link);
});
