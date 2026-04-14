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
import { createSession, killSession, sessionExists, sendKeys } from '../lib/terminal-manager.js';
import { execFile } from 'node:child_process';
import { broadcast } from '../lib/sse-manager.js';

const router = Router();
const ROLES = ['liaison', 'pdsa', 'qa', 'dev'];

function spawnAgent(role: string, userId: string, project: string): { id: string; session: string } {
  const shortId = userId.substring(0, 8);
  const sessionName = `runner-${role}-${shortId}`;
  const projectSlug = project === 'all' ? 'xpollination-mindspace' : project;

  // Build Claude command with role prompt including A2A identity
  const rolePrompt = `You are the ${role.toUpperCase()} agent in the Mindspace A2A system. A monitor sidecar is listening for events on your behalf. Start: /xpo.claude.monitor ${role}`;
  const command = `claude --allowedTools '*' --append-system-prompt "${rolePrompt}"`;

  try {
    createSession(sessionName, command);
  } catch {
    // Session may already exist — reuse it
  }

  // SSE bridge: connects to A2A SSE stream, delivers events to Claude terminal
  const bridgeSession = `bridge-${sessionName}`;
  const apiKey = process.env.BRAIN_API_KEY || process.env.BRAIN_AGENT_KEY || '';
  const apiPort = process.env.API_PORT || '3101';
  const bridgeCmd = `node /app/src/a2a/sse-bridge.js --role ${role} --session ${sessionName} --api-key ${apiKey} --api-url http://localhost:${apiPort} --project ${projectSlug}`;
  try {
    createSession(bridgeSession, bridgeCmd);
  } catch { /* may exist */ }

  // Start per-agent unblock monitor (auto-confirms permission prompts)
  const unblockSession = `unblock-${sessionName}`;
  try {
    const unblockCmd = `bash -c 'while true; do output=$(tmux capture-pane -t ${sessionName} -p -S -40 2>/dev/null); bottom=$(echo "$output" | tail -12 | tr "\\n" " "); if echo "$bottom" | grep -qE "Esc to cancel|Do you want to allow|Do you want to proceed"; then prompt=$(echo "$output" | tail -40 | tr "\\n" " "); if echo "$prompt" | grep -qiE "don.t ask again"; then opt=$(echo "$prompt" | grep -oiE "[1-9]\\.[^.]{0,80}don.t ask again" | head -1 | grep -oE "^[1-9]"); if [ -n "$opt" ]; then tmux send-keys -t ${sessionName} "$opt"; echo "[$(date +%H:%M:%S)] ${role}: opt $opt (dont ask again)"; sleep 3; continue; fi; fi; if echo "$prompt" | grep -qE "[0-9]+\\. Yes"; then if echo "$prompt" | grep -qE "2\\.[^0-9]*Yes.*don"; then tmux send-keys -t ${sessionName} 2; echo "[$(date +%H:%M:%S)] ${role}: opt 2"; elif echo "$prompt" | grep -qE "1\\. Yes"; then tmux send-keys -t ${sessionName} 1; echo "[$(date +%H:%M:%S)] ${role}: opt 1"; fi; sleep 3; continue; fi; fi; sleep 5; done'`;
    createSession(unblockSession, unblockCmd);
  } catch { /* may exist */ }

  // Track in DB
  const id = crypto.randomUUID();
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO agents (id, user_id, name, current_role, project_slug, status, session_id, connected_at, last_seen)
       VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`
    ).run(id, userId, `${role}-runner`, role, projectSlug, sessionName);
  } catch { /* FK constraint may fail */ }

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
  broadcast('agent_spawned', { id, role, session, timestamp: new Date().toISOString() });
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
  const agent = db.prepare('SELECT session_id, current_role FROM agents WHERE id = ?').get(req.params.id) as any;
  if (agent?.session_id) {
    try { killSession(agent.session_id); } catch { /* already dead */ }
    try { killSession(`bridge-${agent.session_id}`); } catch { /* */ }
    try { killSession(`unblock-${agent.session_id}`); } catch { /* */ }
  }
  db.prepare(`UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now') WHERE id = ?`)
    .run(req.params.id);
  broadcast('agent_terminated', { id: req.params.id, role: agent?.current_role, timestamp: new Date().toISOString() });
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
