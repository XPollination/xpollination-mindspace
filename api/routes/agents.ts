import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';
import { createBond } from './agent-bond.js';

export const agentsRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];
const VALID_STATUSES = ['active', 'idle', 'disconnected'];

agentsRouter.use(requireApiKeyOrJwt);

// POST /api/agents/register — register agent
agentsRouter.post('/register', (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, current_role, capabilities, project_slug, session_id } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Missing required field: name' });
    return;
  }

  if (current_role && !VALID_ROLES.includes(current_role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  if (capabilities !== undefined) {
    if (!Array.isArray(capabilities)) {
      res.status(400).json({ error: 'capabilities must be an array' });
      return;
    }
  }

  const db = getDb();

  if (project_slug) {
    const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(project_slug);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
  }

  // Check for existing active/idle agent with same user_id + name + project_slug
  const existing = db.prepare(
    'SELECT id FROM agents WHERE user_id = ? AND name = ? AND (project_slug = ? OR (project_slug IS NULL AND ? IS NULL)) AND status != ?'
  ).get(user.id, name, project_slug || null, project_slug || null, 'disconnected') as any;

  const agentSessionId = session_id || randomUUID();
  const capabilitiesJson = capabilities ? JSON.stringify(capabilities) : null;

  if (existing) {
    // Re-registration: update existing agent
    db.prepare(
      "UPDATE agents SET session_id = ?, current_role = ?, capabilities = ?, connected_at = datetime('now'), last_seen = datetime('now'), status = ? WHERE id = ?"
    ).run(agentSessionId, current_role || null, capabilitiesJson, 'active', existing.id);

    createBond(existing.id, agentSessionId);
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(existing.id);
    res.status(200).json({ agent_id: (agent as any).id, ...(agent as any) });
    return;
  }

  // New registration
  const id = randomUUID();
  db.prepare(
    'INSERT INTO agents (id, user_id, name, current_role, capabilities, project_slug, session_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, user.id, name, current_role || null, capabilitiesJson, project_slug || null, agentSessionId, 'active');

  createBond(id, agentSessionId);
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(201).json({ agent_id: id, ...(agent as any) });
});

// POST /api/agents/:id/heartbeat — update last_seen, reactivate idle agents
agentsRouter.post('/:id/heartbeat', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.status === 'disconnected') {
    res.status(409).json({ error: 'Disconnected agents must re-register' });
    return;
  }

  // Reactivate idle agents on heartbeat
  const newStatus = agent.status === 'idle' ? 'active' : agent.status;
  db.prepare("UPDATE agents SET last_seen = datetime('now'), status = ? WHERE id = ?")
    .run(newStatus, id);

  res.status(200).json({ agent_id: id, status: newStatus, last_seen: new Date().toISOString() });
});

// PATCH /api/agents/:id/status — manual status change (graceful disconnect)
agentsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (status === 'disconnected') {
    db.prepare("UPDATE agents SET status = ?, disconnected_at = datetime('now'), last_seen = datetime('now') WHERE id = ?")
      .run(status, id);
  } else {
    db.prepare("UPDATE agents SET status = ?, last_seen = datetime('now') WHERE id = ?")
      .run(status, id);
  }

  res.status(200).json({ agent_id: id, previous_status: agent.status, status });
});

// GET /api/agents — list agents (optional filters: project_slug, status)
agentsRouter.get('/', (req: Request, res: Response) => {
  const { project_slug, status } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM agents WHERE 1=1';
  const params: any[] = [];

  if (project_slug) {
    sql += ' AND project_slug = ?';
    params.push(project_slug);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY connected_at DESC';
  const agents = db.prepare(sql).all(...params);
  res.status(200).json(agents);
});

// POST /api/agents/:id/role-switch — switch agent role
agentsRouter.post('/:id/role-switch', (req: Request, res: Response) => {
  const { id } = req.params;
  const { to_role, from_role, reason } = req.body;

  if (!to_role) {
    res.status(400).json({ error: 'Missing required field: to_role' });
    return;
  }

  if (!VALID_ROLES.includes(to_role)) {
    res.status(400).json({ error: `Invalid to_role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.status === 'disconnected') {
    res.status(409).json({ error: 'Cannot switch role of disconnected agent' });
    return;
  }

  // Safety check: if from_role provided, verify it matches current_role
  if (from_role && agent.current_role !== from_role) {
    res.status(409).json({ error: `Role mismatch: agent current_role is '${agent.current_role}', expected '${from_role}'` });
    return;
  }

  // Validate to_role against agent capabilities
  const capabilities = agent.capabilities ? JSON.parse(agent.capabilities) : [];
  if (capabilities.length > 0 && !capabilities.includes(to_role)) {
    res.status(403).json({ error: `Role '${to_role}' is not in agent capabilities: [${capabilities.join(', ')}]` });
    return;
  }

  const previous_role = agent.current_role;
  db.prepare("UPDATE agents SET current_role = ?, last_seen = datetime('now') WHERE id = ?")
    .run(to_role, id);

  res.status(200).json({
    switched: true,
    previous_role,
    current_role: to_role,
    reason: reason || null,
    agent_id: id
  });
});

// GET /api/agents/:id — get agent by id
agentsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.status(200).json(agent);
});
