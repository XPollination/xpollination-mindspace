import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const capabilitiesRouter = Router({ mergeParams: true });

const VALID_STATUSES = ['draft', 'active', 'blocked', 'complete', 'cancelled'];

// POST / — create capability (contributor required)
capabilitiesRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { mission_id, title, description, status, dependency_ids, sort_order } = req.body;

  if (!mission_id || !title) {
    res.status(400).json({ error: 'Missing required fields: mission_id, title' });
    return;
  }

  const capStatus = status || 'draft';
  if (!VALID_STATUSES.includes(capStatus)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const db = getDb();

  // Verify mission exists
  const mission = db.prepare('SELECT id FROM missions WHERE id = ?').get(mission_id);
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }

  const id = randomUUID();
  const deps = dependency_ids ? JSON.stringify(dependency_ids) : '[]';
  const order = sort_order ?? 0;

  db.prepare(
    `INSERT INTO capabilities (id, mission_id, title, description, status, dependency_ids, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, mission_id, title, description || null, capStatus, deps, order);

  const capability = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(id);
  res.status(201).json(capability);
});

// GET / — list capabilities (optional filters: status, mission_id)
capabilitiesRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { status, mission_id } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM capabilities WHERE 1=1';
  const params: any[] = [];

  if (mission_id) {
    sql += ' AND mission_id = ?';
    params.push(mission_id);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY sort_order ASC, created_at ASC';
  const capabilities = db.prepare(sql).all(...params);
  res.status(200).json(capabilities);
});

// GET /:capId — get single capability
capabilitiesRouter.get('/:capId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { capId } = req.params;
  const db = getDb();

  const capability = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(capId);
  if (!capability) {
    res.status(404).json({ error: 'Capability not found' });
    return;
  }

  res.status(200).json(capability);
});

// PUT /:capId — update capability (contributor required). No DELETE — use cancelled status
capabilitiesRouter.put('/:capId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { capId } = req.params;
  const { title, description, status, dependency_ids, sort_order, mission_id } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(capId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Capability not found' });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const updatedTitle = title || existing.title;
  const updatedDesc = description !== undefined ? description : existing.description;
  const updatedStatus = status || existing.status;
  const updatedDeps = dependency_ids !== undefined ? JSON.stringify(dependency_ids) : existing.dependency_ids;
  const updatedOrder = sort_order !== undefined ? sort_order : existing.sort_order;
  const updatedMission = mission_id || existing.mission_id;

  db.prepare(
    `UPDATE capabilities SET title = ?, description = ?, status = ?, dependency_ids = ?, sort_order = ?, mission_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(updatedTitle, updatedDesc, updatedStatus, updatedDeps, updatedOrder, updatedMission, capId);

  const capability = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(capId);
  res.status(200).json(capability);
});

// --- Requirement linking ---

// GET /:capId/requirements — list linked requirements
capabilitiesRouter.get('/:capId/requirements', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, capId } = req.params;
  const db = getDb();

  const capability = db.prepare('SELECT id FROM capabilities WHERE id = ?').get(capId);
  if (!capability) {
    res.status(404).json({ error: 'Capability not found' });
    return;
  }

  const links = db.prepare(
    `SELECT cr.requirement_ref, r.id, r.title, r.status, r.priority
     FROM capability_requirements cr
     LEFT JOIN requirements r ON r.req_id_human = cr.requirement_ref AND r.project_slug = ?
     WHERE cr.capability_id = ?
     ORDER BY cr.requirement_ref`
  ).all(slug, capId);

  res.status(200).json(links);
});

// POST /:capId/requirements — link requirement
capabilitiesRouter.post('/:capId/requirements', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { capId } = req.params;
  const { requirement_ref } = req.body;

  if (!requirement_ref) {
    res.status(400).json({ error: 'Missing required field: requirement_ref' });
    return;
  }

  const db = getDb();

  const capability = db.prepare('SELECT id FROM capabilities WHERE id = ?').get(capId);
  if (!capability) {
    res.status(404).json({ error: 'Capability not found' });
    return;
  }

  // Check for duplicate
  const existing = db.prepare(
    'SELECT * FROM capability_requirements WHERE capability_id = ? AND requirement_ref = ?'
  ).get(capId, requirement_ref);
  if (existing) {
    res.status(409).json({ error: 'Requirement already linked to this capability' });
    return;
  }

  db.prepare(
    'INSERT INTO capability_requirements (capability_id, requirement_ref) VALUES (?, ?)'
  ).run(capId, requirement_ref);

  res.status(201).json({ capability_id: capId, requirement_ref });
});

// DELETE /:capId/requirements/:reqRef — unlink requirement
capabilitiesRouter.delete('/:capId/requirements/:reqRef', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { capId, reqRef } = req.params;
  const db = getDb();

  const result = db.prepare(
    'DELETE FROM capability_requirements WHERE capability_id = ? AND requirement_ref = ?'
  ).run(capId, reqRef);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }

  res.status(200).json({ deleted: true });
});

// --- Task linking ---

// GET /:capId/tasks — list linked tasks
capabilitiesRouter.get('/:capId/tasks', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, capId } = req.params;
  const db = getDb();

  const capability = db.prepare('SELECT id FROM capabilities WHERE id = ?').get(capId);
  if (!capability) {
    res.status(404).json({ error: 'Capability not found' });
    return;
  }

  const links = db.prepare(
    `SELECT ct.task_slug, t.id, t.title, t.status, t.current_role
     FROM capability_tasks ct
     LEFT JOIN tasks t ON t.slug = ct.task_slug AND t.project_slug = ?
     WHERE ct.capability_id = ?
     ORDER BY ct.task_slug`
  ).all(slug, capId);

  res.status(200).json(links);
});

// POST /:capId/tasks — link task
capabilitiesRouter.post('/:capId/tasks', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { capId } = req.params;
  const { task_slug } = req.body;

  if (!task_slug) {
    res.status(400).json({ error: 'Missing required field: task_slug' });
    return;
  }

  const db = getDb();

  const capability = db.prepare('SELECT id FROM capabilities WHERE id = ?').get(capId);
  if (!capability) {
    res.status(404).json({ error: 'Capability not found' });
    return;
  }

  const existing = db.prepare(
    'SELECT * FROM capability_tasks WHERE capability_id = ? AND task_slug = ?'
  ).get(capId, task_slug);
  if (existing) {
    res.status(409).json({ error: 'Task already linked to this capability' });
    return;
  }

  db.prepare(
    'INSERT INTO capability_tasks (capability_id, task_slug) VALUES (?, ?)'
  ).run(capId, task_slug);

  res.status(201).json({ capability_id: capId, task_slug });
});

// DELETE /:capId/tasks/:taskSlug — unlink task
capabilitiesRouter.delete('/:capId/tasks/:taskSlug', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { capId, taskSlug } = req.params;
  const db = getDb();

  const result = db.prepare(
    'DELETE FROM capability_tasks WHERE capability_id = ? AND task_slug = ?'
  ).run(capId, taskSlug);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }

  res.status(200).json({ deleted: true });
});
