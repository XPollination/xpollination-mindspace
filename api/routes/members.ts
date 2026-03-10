import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const membersRouter = Router({ mergeParams: true });

membersRouter.use(requireApiKeyOrJwt);

// POST / — add member to project
membersRouter.post('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { user_id, role } = req.body;
  const granter = (req as any).user;

  if (!user_id) {
    res.status(400).json({ error: 'Missing required field: user_id' });
    return;
  }

  const memberRole = role || 'viewer';
  if (!['admin', 'contributor', 'viewer'].includes(memberRole)) {
    res.status(400).json({ error: 'Invalid role. Must be admin, contributor, or viewer' });
    return;
  }

  const db = getDb();

  // Check project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Check user exists
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Check for duplicate membership
  const existing = db.prepare('SELECT id FROM project_access WHERE user_id = ? AND project_slug = ?').get(user_id, slug);
  if (existing) {
    res.status(409).json({ error: 'User is already a member of this project' });
    return;
  }

  const id = randomUUID();
  db.prepare('INSERT INTO project_access (id, user_id, project_slug, role, granted_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, user_id, slug, memberRole, granter.id);

  const member = db.prepare('SELECT * FROM project_access WHERE id = ?').get(id);
  res.status(201).json(member);
});

// GET / — list members with user info (JOIN users)
membersRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  // Check project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const members = db.prepare(`
    SELECT pa.id, pa.user_id, pa.project_slug, pa.role, pa.granted_at, pa.granted_by,
           u.email, u.name
    FROM project_access pa
    JOIN users u ON pa.user_id = u.id
    WHERE pa.project_slug = ?
    ORDER BY pa.granted_at ASC
  `).all(slug);

  res.status(200).json(members);
});

// DELETE /:userId — remove member from project
membersRouter.delete('/:userId', (req: Request, res: Response) => {
  const { slug, userId } = req.params;
  const db = getDb();

  const result = db.prepare('DELETE FROM project_access WHERE user_id = ? AND project_slug = ?').run(userId, slug);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Membership not found' });
    return;
  }

  res.status(200).json({ removed: true, user_id: userId, project_slug: slug });
});
