/**
 * Team Management API Router
 *
 * When MindspaceNode is running: addRunner() starts a real runner process.
 * When MindspaceNode is not running: falls back to DB record (for tests).
 *
 * Routes:
 *   GET    /api/team/:project           — list agents/runners
 *   POST   /api/team/:project/agent     — add single runner by role
 *   POST   /api/team/:project/full      — add full team (4 roles)
 *   DELETE /api/team/:project/agent/:id — terminate runner
 *   PUT    /api/team/:project/agent/:id/role — switch role
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';
import { getNode } from '../services/mindspace-node-service.js';

const router = Router();
const ROLES = ['liaison', 'pdsa', 'qa', 'dev'];

// DB fallback for when MindspaceNode is not running (tests, DISABLE_NODE=1)
function dbAddAgent(req: Request, res: Response, role: string): void {
  const db = getDb();
  const id = crypto.randomUUID();
  const userId = (req as any).user?.id || 'system';
  db.prepare(
    `INSERT INTO agents (id, user_id, name, current_role, project_slug, status, connected_at, last_seen)
     VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
  ).run(id, userId, `${role}-runner`, role, req.params.project);
  res.json({ id, role, status: 'ready', name: `${role}-runner` });
}

// GET /api/team/:project — list runners (real or DB)
router.get('/:project', (req: Request, res: Response) => {
  const node = getNode();
  if (node) {
    const runners = node.getRunners();
    res.json({ agents: runners, capacity: { max: 4, current: runners.length } });
    return;
  }
  // DB fallback
  const db = getDb();
  const agents = db.prepare(
    `SELECT id, name, current_role as role, status, last_seen, session_id
     FROM agents WHERE project_slug = ? AND status != 'disconnected'
     ORDER BY connected_at DESC`
  ).all(req.params.project);
  res.json({ agents, capacity: { max: 4, current: agents.length } });
});

// POST /api/team/:project/agent — add single runner
router.post('/:project/agent', async (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role || !ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
    return;
  }

  const node = getNode();
  if (node) {
    try {
      const runner = await node.addRunner({ role });
      res.json({ id: runner.getId(), role, status: 'ready', name: `${role}-runner`, node_id: 'local' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to start runner' });
    }
    return;
  }

  // DB fallback
  dbAddAgent(req, res, role);
});

// POST /api/team/:project/full — add full team
router.post('/:project/full', async (req: Request, res: Response) => {
  const node = getNode();
  if (node) {
    try {
      const agents = [];
      for (const role of ROLES) {
        const runner = await node.addRunner({ role });
        agents.push({ id: runner.getId(), role, status: 'ready', name: `${role}-runner` });
      }
      res.json({ agents });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to start team' });
    }
    return;
  }

  // DB fallback
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

// DELETE /api/team/:project/agent/:id — terminate runner
router.delete('/:project/agent/:id', async (req: Request, res: Response) => {
  const node = getNode();
  if (node) {
    try {
      await node.terminateRunner(req.params.id);
      res.json({ id: req.params.id, status: 'stopped' });
    } catch {
      // Runner not in MindspaceNode — try DB
      const db = getDb();
      db.prepare(`UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now') WHERE id = ?`)
        .run(req.params.id);
      res.json({ id: req.params.id, status: 'stopped' });
    }
    return;
  }
  const db = getDb();
  db.prepare(`UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now') WHERE id = ?`)
    .run(req.params.id);
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
