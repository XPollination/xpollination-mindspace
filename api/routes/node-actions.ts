/**
 * Node Actions — confirm and rework endpoints for viz kanban
 *
 * These were previously handled by direct SQLite in viz/server.js.
 * Now they go through the API, reading from the tasks table (not mindspace_nodes).
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const nodeActionsRouter = Router();

nodeActionsRouter.use(requireApiKeyOrJwt);

// PUT /api/node/:slug/confirm — set human_confirmed in DNA
nodeActionsRouter.put('/:slug/confirm', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE slug = ? OR id = ?').get(slug, slug) as any;
  if (!task) {
    res.status(404).json({ error: `Task not found: ${slug}` });
    return;
  }

  let dna: any = {};
  try { dna = JSON.parse(task.dna_json || '{}'); } catch { /* ignore */ }
  dna.human_confirmed = true;
  dna.human_confirmed_via = 'viz';

  db.prepare("UPDATE tasks SET dna_json = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(dna), task.id);

  res.status(200).json({
    success: true,
    slug: task.slug || task.id,
    status: task.status,
    human_confirmed: true,
    human_confirmed_via: 'viz',
  });
});

// PUT /api/node/:slug/rework — set rework_reason in DNA
nodeActionsRouter.put('/:slug/rework', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { rework_reason, reason } = req.body;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE slug = ? OR id = ?').get(slug, slug) as any;
  if (!task) {
    res.status(404).json({ error: `Task not found: ${slug}` });
    return;
  }

  let dna: any = {};
  try { dna = JSON.parse(task.dna_json || '{}'); } catch { /* ignore */ }
  dna.rework_reason = rework_reason || reason || 'No reason provided';
  dna.human_confirmed = false;

  db.prepare("UPDATE tasks SET dna_json = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(dna), task.id);

  res.status(200).json({
    success: true,
    slug: task.slug || task.id,
    status: task.status,
    rework_reason: dna.rework_reason,
  });
});
