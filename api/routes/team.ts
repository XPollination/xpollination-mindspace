/**
 * Team Management API Router
 *
 * "+1 Dev" spawns Claude Code in a tmux session.
 * "Open" connects browser to that session via WebSocket/xterm.js.
 * "Terminate" kills the tmux session.
 *
 * DB fallback (no tmux) for test environments.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';
import { createSession, killSession, sessionExists } from '../lib/terminal-manager.js';

const router = Router();
const ROLES = ['liaison', 'pdsa', 'qa', 'dev'];

function spawnAgent(role: string, userId: string, project: string): { id: string; session: string } {
  const shortId = userId.substring(0, 8);
  const sessionName = `runner-${role}-${shortId}`;

  // Build Claude command with role prompt
  const rolePrompt = `You are the ${role.toUpperCase()} agent. Start: /xpo.claude.monitor ${role}`;
  const command = `claude --allowedTools '*' --append-system-prompt "${rolePrompt}"`;

  try {
    createSession(sessionName, command);
  } catch {
    // Session may already exist — that's fine, reuse it
  }

  // Track in DB (best-effort — FK constraints may fail in some environments)
  const id = crypto.randomUUID();
  const db = getDb();
  const projectSlug = project === 'all' ? 'xpollination-mindspace' : project;
  try {
    db.prepare(
      `INSERT INTO agents (id, user_id, name, current_role, project_slug, status, session_id, connected_at, last_seen)
       VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`
    ).run(id, userId, `${role}-runner`, role, projectSlug, sessionName);
  } catch {
    // FK constraint may fail — agent still runs in tmux
  }

  return { id, session: sessionName };
}

// GET /api/team/:project — list agents with session status
router.get('/:project', (req: Request, res: Response) => {
  const db = getDb();
  const project = req.params.project;
  const query = project === 'all'
    ? `SELECT id, name, current_role as role, status, session_id as session, last_seen
       FROM agents WHERE status != 'disconnected' ORDER BY connected_at DESC`
    : `SELECT id, name, current_role as role, status, session_id as session, last_seen
       FROM agents WHERE project_slug = ? AND status != 'disconnected' ORDER BY connected_at DESC`;
  const agents = (project === 'all' ? db.prepare(query).all() : db.prepare(query).all(project)) as any[];

  // Check which tmux sessions are still alive
  for (const a of agents) {
    if (a.session && !sessionExists(a.session)) {
      a.status = 'stopped';
    }
  }
  res.json({ agents, capacity: { max: 4, current: agents.length } });
});

// POST /api/team/:project/agent — spawn Claude in tmux
router.post('/:project/agent', (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role || !ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
    return;
  }

  const userId = (req as any).user?.id || 'system';
  const { id, session } = spawnAgent(role, userId, req.params.project);
  res.json({ id, role, status: 'ready', name: `${role}-runner`, session });
});

// POST /api/team/:project/full — spawn full team (4 agents)
router.post('/:project/full', (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'system';
  const agents = ROLES.map(role => {
    const { id, session } = spawnAgent(role, userId, req.params.project);
    return { id, role, status: 'ready', name: `${role}-runner`, session };
  });
  res.json({ agents });
});

// DELETE /api/team/:project/agent/:id — terminate agent (kill tmux)
router.delete('/:project/agent/:id', (req: Request, res: Response) => {
  const db = getDb();
  const agent = db.prepare('SELECT session_id FROM agents WHERE id = ?').get(req.params.id) as any;
  if (agent?.session_id) {
    try { killSession(agent.session_id); } catch { /* already dead */ }
  }
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
