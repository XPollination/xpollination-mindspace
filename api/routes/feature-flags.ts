import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const featureFlagsRouter = Router({ mergeParams: true });

const VALID_STATES = ['off', 'on'];

// POST / — create flag (contributor)
featureFlagsRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { flag_name, task_id, state, expires_at } = req.body;

  if (!flag_name) {
    res.status(400).json({ error: 'Missing required field: flag_name' });
    return;
  }

  const db = getDb();

  // Check for duplicate
  const existing = db.prepare('SELECT id FROM feature_flags WHERE project_slug = ? AND flag_name = ?').get(slug, flag_name);
  if (existing) {
    res.status(409).json({ error: `Flag '${flag_name}' already exists in project ${slug}` });
    return;
  }

  const id = randomUUID();
  const flagState = state || 'off';

  if (!VALID_STATES.includes(flagState)) {
    res.status(400).json({ error: `Invalid state. Must be one of: ${VALID_STATES.join(', ')}` });
    return;
  }

  db.prepare(
    `INSERT INTO feature_flags (id, project_slug, task_id, flag_name, state, toggled_by, toggled_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
  ).run(id, slug, task_id || null, flag_name, flagState, user.id, expires_at || null);

  const flag = db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(id);
  res.status(201).json(flag);
});

// GET / — list flags (viewer), optional ?state query filter
featureFlagsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { state } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM feature_flags WHERE project_slug = ?';
  const params: any[] = [slug];

  if (state) {
    sql += ' AND state = ?';
    params.push(state);
  }

  sql += ' ORDER BY created_at DESC';
  const flags = db.prepare(sql).all(...params);
  res.status(200).json(flags);
});

// GET /export — export all flags for project (YAML or JSON)
featureFlagsRouter.get('/export', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { format } = req.query;
  const db = getDb();

  const flags = db.prepare('SELECT * FROM feature_flags WHERE project_slug = ? ORDER BY flag_name').all(slug) as any[];

  if (format === 'json') {
    res.status(200).json(flags);
    return;
  }

  // Default: YAML output
  let yaml = `# Feature flags for project: ${slug}\nflags:\n`;
  for (const flag of flags) {
    yaml += `  - flag_name: ${flag.flag_name}\n`;
    yaml += `    state: ${flag.state}\n`;
    yaml += `    task_id: ${flag.task_id || 'null'}\n`;
    if (flag.expires_at) yaml += `    expires_at: ${flag.expires_at}\n`;
  }

  res.setHeader('Content-Type', 'text/yaml');
  res.status(200).send(yaml);
});

// GET /:flagId — get single flag (viewer)
featureFlagsRouter.get('/:flagId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, flagId } = req.params;
  const db = getDb();

  const flag = db.prepare('SELECT * FROM feature_flags WHERE id = ? AND project_slug = ?').get(flagId, slug);
  if (!flag) {
    res.status(404).json({ error: 'Flag not found' });
    return;
  }

  res.status(200).json(flag);
});

// PUT /:flagId — toggle flag (contributor for OFF, admin for ON — human gate)
featureFlagsRouter.put('/:flagId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, flagId } = req.params;
  const user = (req as any).user;
  const projectAccess = (req as any).projectAccess;
  const { state, expires_at } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM feature_flags WHERE id = ? AND project_slug = ?').get(flagId, slug) as any;
  if (!existing) {
    res.status(404).json({ error: 'Flag not found' });
    return;
  }

  if (state && !VALID_STATES.includes(state)) {
    res.status(400).json({ error: `Invalid state. Must be one of: ${VALID_STATES.join(', ')}` });
    return;
  }

  // Admin-only human gate for toggling ON
  if (state === 'on' && projectAccess.level < 3) {
    res.status(403).json({ error: 'Only admin can toggle flags ON (human gate)' });
    return;
  }

  const updatedState = state || existing.state;
  const updatedExpires = expires_at !== undefined ? expires_at : existing.expires_at;

  db.prepare(
    `UPDATE feature_flags SET state = ?, toggled_by = ?, toggled_at = datetime('now'), expires_at = ?
     WHERE id = ? AND project_slug = ?`
  ).run(updatedState, user.id, updatedExpires, flagId, slug);

  const flag = db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(flagId);
  res.status(200).json(flag);
});

// DELETE /:flagId — remove flag (admin only)
featureFlagsRouter.delete('/:flagId', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, flagId } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM feature_flags WHERE id = ? AND project_slug = ?').get(flagId, slug);
  if (!existing) {
    res.status(404).json({ error: 'Flag not found' });
    return;
  }

  db.prepare('DELETE FROM feature_flags WHERE id = ? AND project_slug = ?').run(flagId, slug);
  res.status(204).send();
});
