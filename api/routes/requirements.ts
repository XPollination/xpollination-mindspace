import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const requirementsRouter = Router({ mergeParams: true });

const VALID_STATUSES = ['draft', 'active', 'deprecated'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// POST / — create requirement (requires contributor role)
requirementsRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { req_id_human, title, description, status, priority, current_version } = req.body;

  if (!req_id_human || !title) {
    res.status(400).json({ error: 'Missing required fields: req_id_human, title' });
    return;
  }

  const reqStatus = status || 'draft';
  if (!VALID_STATUSES.includes(reqStatus)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const reqPriority = priority || 'medium';
  if (!VALID_PRIORITIES.includes(reqPriority)) {
    res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    return;
  }

  const db = getDb();

  // Check for duplicate req_id_human within project
  const existing = db.prepare(
    'SELECT id FROM requirements WHERE project_slug = ? AND req_id_human = ?'
  ).get(slug, req_id_human);
  if (existing) {
    res.status(409).json({ error: `Requirement with req_id_human '${req_id_human}' already exists in this project` });
    return;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO requirements (id, project_slug, req_id_human, title, description, status, priority, current_version, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, slug, req_id_human, title, description || null, reqStatus, reqPriority, current_version || null, user.id);

  const requirement = db.prepare('SELECT * FROM requirements WHERE id = ?').get(id);
  res.status(201).json(requirement);
});

// GET / — list requirements (optional filters: status, priority)
requirementsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, priority } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM requirements WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (priority) {
    sql += ' AND priority = ?';
    params.push(priority);
  }

  sql += ' ORDER BY created_at DESC';
  const requirements = db.prepare(sql).all(...params);
  res.status(200).json(requirements);
});

// GET /:reqId — get requirement by UUID or req_id_human (dual lookup)
requirementsRouter.get('/:reqId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, reqId } = req.params;
  const db = getDb();

  // Try UUID first, then req_id_human
  let requirement = db.prepare(
    'SELECT * FROM requirements WHERE id = ? AND project_slug = ?'
  ).get(reqId, slug);

  if (!requirement) {
    requirement = db.prepare(
      'SELECT * FROM requirements WHERE req_id_human = ? AND project_slug = ?'
    ).get(reqId, slug);
  }

  if (!requirement) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  res.status(200).json(requirement);
});

// PUT /:reqId — update requirement (requires contributor role)
// No DELETE — use status='deprecated' for traceability
requirementsRouter.put('/:reqId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, reqId } = req.params;
  const { title, description, status, priority, current_version, req_id_human } = req.body;
  const db = getDb();

  // Dual lookup
  let existing = db.prepare(
    'SELECT * FROM requirements WHERE id = ? AND project_slug = ?'
  ).get(reqId, slug) as any;

  if (!existing) {
    existing = db.prepare(
      'SELECT * FROM requirements WHERE req_id_human = ? AND project_slug = ?'
    ).get(reqId, slug) as any;
  }

  if (!existing) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    return;
  }

  // Check for duplicate req_id_human if changing it
  if (req_id_human && req_id_human !== existing.req_id_human) {
    const duplicate = db.prepare(
      'SELECT id FROM requirements WHERE project_slug = ? AND req_id_human = ? AND id != ?'
    ).get(slug, req_id_human, existing.id);
    if (duplicate) {
      res.status(409).json({ error: `Requirement with req_id_human '${req_id_human}' already exists in this project` });
      return;
    }
  }

  const updatedTitle = title || existing.title;
  const updatedDescription = description !== undefined ? description : existing.description;
  const updatedStatus = status || existing.status;
  const updatedPriority = priority || existing.priority;
  const updatedVersion = current_version !== undefined ? current_version : existing.current_version;
  const updatedReqId = req_id_human || existing.req_id_human;

  db.prepare(
    `UPDATE requirements SET title = ?, description = ?, status = ?, priority = ?, current_version = ?, req_id_human = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(updatedTitle, updatedDescription, updatedStatus, updatedPriority, updatedVersion, updatedReqId, existing.id);

  const requirement = db.prepare('SELECT * FROM requirements WHERE id = ?').get(existing.id);
  res.status(200).json(requirement);
});
