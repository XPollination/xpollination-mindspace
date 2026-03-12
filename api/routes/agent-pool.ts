import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { buildWelcomeContext } from '../services/welcome-context.js';

export const agentPoolRouter = Router({ mergeParams: true });

// GET /api/projects/:slug/agents — aggregated agent pool for viz
agentPoolRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const include_disconnected = req.query.include_disconnected === 'true';
  const db = getDb();

  // Check project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Get agents for this project
  let agentsSql = 'SELECT id, name, current_role, status, session_id, connected_at, last_seen FROM agents WHERE project_slug = ?';
  if (!include_disconnected) {
    agentsSql += " AND status != 'disconnected'";
  }
  agentsSql += ' ORDER BY last_seen DESC';

  const agents = db.prepare(agentsSql).all(slug) as any[];

  // Aggregate by_role
  const by_role: Record<string, number> = {};
  for (const agent of agents) {
    const role = agent.current_role || 'unassigned';
    by_role[role] = (by_role[role] || 0) + 1;
  }

  // Aggregate by_status
  const by_status: Record<string, number> = {};
  for (const agent of agents) {
    by_status[agent.status] = (by_status[agent.status] || 0) + 1;
  }

  res.status(200).json({
    project_slug: slug,
    total: agents.length,
    by_role,
    by_status,
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      current_role: a.current_role,
      status: a.status,
      current_task: null, // Placeholder — no task/lease tables yet
      connected_at: a.connected_at,
      last_seen: a.last_seen
    }))
  });
});

// --- A2A Protocol Lifecycle Endpoints ---

// POST /connect — establish agent session, return WELCOME
agentPoolRouter.post('/connect', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { agent_id, role } = req.body;
  const db = getDb();

  if (!agent_id) {
    res.status(400).json({ error: 'Missing required field: agent_id' });
    return;
  }

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent_id) as any;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const sessionId = randomUUID();
  db.prepare(
    "UPDATE agents SET session_id = ?, project_slug = ?, current_role = COALESCE(?, current_role), status = 'active', connected_at = datetime('now'), last_seen = datetime('now') WHERE id = ?"
  ).run(sessionId, slug, role || null, agent_id);

  const context = buildWelcomeContext(slug, role);

  res.status(200).json({
    session_id: sessionId,
    type: 'WELCOME',
    agent_id,
    project_slug: slug,
    context
  });
});

// POST /claim-task — claim a ready task for the agent
agentPoolRouter.post('/claim-task', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { agent_id, task_id } = req.body;
  const db = getDb();

  if (!agent_id || !task_id) {
    res.status(400).json({ error: 'Missing required fields: agent_id, task_id' });
    return;
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(task_id, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (task.status !== 'ready') {
    res.status(409).json({ error: `Task is not claimable (status: ${task.status})` });
    return;
  }

  db.prepare(
    "UPDATE tasks SET status = 'active', claimed_by = ?, claimed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(agent_id, task_id);

  res.status(200).json({
    task_id,
    status: 'active',
    claimed_by: agent_id
  });
});

// POST /heartbeat — renew agent session
agentPoolRouter.post('/heartbeat', (req: Request, res: Response) => {
  const { agent_id } = req.body;
  const db = getDb();

  if (!agent_id) {
    res.status(400).json({ error: 'Missing required field: agent_id' });
    return;
  }

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent_id) as any;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  db.prepare("UPDATE agents SET last_seen = datetime('now') WHERE id = ?").run(agent_id);

  res.status(200).json({ acknowledged: true, agent_id });
});

// POST /transition — submit a task state transition
agentPoolRouter.post('/transition', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { agent_id, task_id, new_status } = req.body;
  const db = getDb();

  if (!agent_id || !task_id || !new_status) {
    res.status(400).json({ error: 'Missing required fields: agent_id, task_id, new_status' });
    return;
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(task_id, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const previousStatus = task.status;
  db.prepare(
    "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(new_status, task_id);

  res.status(200).json({
    transition: `${previousStatus}->${new_status}`,
    task_id,
    agent_id
  });
});

// POST /disconnect — clean up agent session
agentPoolRouter.post('/disconnect', (req: Request, res: Response) => {
  const { agent_id } = req.body;
  const db = getDb();

  if (!agent_id) {
    res.status(400).json({ error: 'Missing required field: agent_id' });
    return;
  }

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent_id) as any;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  db.prepare(
    "UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now'), last_seen = datetime('now') WHERE id = ?"
  ).run(agent_id);

  res.status(200).json({ agent_id, status: 'disconnected' });
});
