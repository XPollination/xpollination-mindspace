/**
 * Team Management API Router
 * Provides team-level agent management scoped to projects.
 * Uses the existing `agents` table — no new migrations needed.
 *
 * Routes:
 *   GET    /api/team/:project         — list agents for project
 *   POST   /api/team/:project/agent   — add single agent by role
 *   POST   /api/team/:project/full    — add full team (4 roles)
 *   DELETE /api/team/:project/agent/:id — terminate agent
 *   PUT    /api/team/:project/agent/:id/role — switch role
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

const router = Router();
const ROLES = ['liaison', 'pdsa', 'qa', 'dev'];

// GET /api/team/:project — list agents for project
router.get('/:project', (req: Request, res: Response) => {
  const db = getDb();
  const agents = db.prepare(
    `SELECT id, name, current_role as role, status, last_seen, session_id
     FROM agents WHERE project_slug = ? AND status != 'disconnected'
     ORDER BY connected_at DESC`
  ).all(req.params.project);
  res.json({ agents, capacity: { max: 4, current: agents.length } });
});

// POST /api/team/:project/agent — add single agent
router.post('/:project/agent', (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role || !ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
    return;
  }
  const db = getDb();
  const id = crypto.randomUUID();
  const userId = (req as any).user?.id || 'system';
  db.prepare(
    `INSERT INTO agents (id, user_id, name, current_role, project_slug, status, connected_at, last_seen)
     VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
  ).run(id, userId, `${role}-runner`, role, req.params.project);
  res.json({ id, role, status: 'ready', name: `${role}-runner` });
});

// POST /api/team/:project/full — add full team (4 agents)
router.post('/:project/full', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).user?.id || 'system';
  const agents = ROLES.map(role => {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO agents (id, user_id, name, current_role, project_slug, status, connected_at, last_seen)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
    ).run(id, userId, `${role}-runner`, role, req.params.project);
    return { id, role, status: 'ready', name: `${role}-runner` };
  });
  res.json({ agents });
});

// DELETE /api/team/:project/agent/:id — terminate agent
router.delete('/:project/agent/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare(
    `UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now') WHERE id = ?`
  ).run(req.params.id);
  res.json({ id: req.params.id, status: 'stopped' });
});

// PUT /api/team/:project/agent/:id/role — switch role
router.put('/:project/agent/:id/role', (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role || !ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
    return;
  }
  const db = getDb();
  db.prepare(`UPDATE agents SET current_role = ? WHERE id = ?`).run(role, req.params.id);
  res.json({ id: req.params.id, role, status: 'active' });
});

export { router as teamRouter };
