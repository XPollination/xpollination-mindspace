import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const invitesRouter = Router();

invitesRouter.post('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const db = getDb();
  const dbUser = db.prepare('SELECT id, invite_quota FROM users WHERE id = ?').get(user.id) as any;
  if (!dbUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Check quota — count unused invites created by this user
  const usedCount = (db.prepare('SELECT COUNT(*) as count FROM invites WHERE created_by = ?').get(dbUser.id) as any).count;
  if (usedCount >= dbUser.invite_quota) {
    res.status(403).json({ error: 'Invite quota exceeded' });
    return;
  }

  const id = randomUUID();
  const code = randomUUID().replace(/-/g, '').substring(0, 16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO invites (id, code, created_by, expires_at) VALUES (?, ?, ?, ?)').run(id, code, dbUser.id, expiresAt);

  res.status(201).json({ id, code, expires_at: expiresAt });
});

invitesRouter.get('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const db = getDb();
  const invites = db.prepare('SELECT id, code, created_by, used_by, expires_at, created_at, used_at FROM invites WHERE created_by = ?').all(user.id);

  res.json({ invites });
});
