import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const focusRouter = Router({ mergeParams: true });

// GET / — get current project focus (viewer+)
focusRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const focus = db.prepare('SELECT * FROM project_focus WHERE project_slug = ?').get(slug);
  res.status(200).json(focus || null);
});

// PUT / — set/update project focus (admin only)
focusRouter.put('/', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { scope, task_ids } = req.body;
  const user = (req as any).user;
  const db = getDb();

  if (!scope) {
    res.status(400).json({ error: 'Missing required field: scope' });
    return;
  }

  const taskIdsJson = task_ids ? JSON.stringify(task_ids) : null;
  const existing = db.prepare('SELECT id FROM project_focus WHERE project_slug = ?').get(slug) as any;

  if (existing) {
    db.prepare(
      "UPDATE project_focus SET scope = ?, task_ids = ?, set_by = ?, updated_at = datetime('now') WHERE project_slug = ?"
    ).run(scope, taskIdsJson, user.id, slug);
  } else {
    db.prepare(
      'INSERT INTO project_focus (id, project_slug, scope, task_ids, set_by) VALUES (?, ?, ?, ?, ?)'
    ).run(randomUUID(), slug, scope, taskIdsJson, user.id);
  }

  const focus = db.prepare('SELECT * FROM project_focus WHERE project_slug = ?').get(slug);
  res.status(200).json(focus);
});

// DELETE / — clear project focus (admin only)
focusRouter.delete('/', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  db.prepare('DELETE FROM project_focus WHERE project_slug = ?').run(slug);
  res.status(204).send();
});
