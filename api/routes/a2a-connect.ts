import { Router, Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const a2aConnectRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];

// POST /a2a/connect — A2A CHECKIN handler
a2aConnectRouter.post('/', (req: Request, res: Response) => {
  const twin = req.body;

  // 1. Validate twin structure (required sections)
  if (!twin?.identity || !twin?.role || !twin?.project || !twin?.state || !twin?.metadata) {
    res.status(400).json({
      type: 'ERROR',
      error: 'Invalid digital twin: missing required sections (identity, role, project, state, metadata)'
    });
    return;
  }

  // 2. Validate identity fields
  const { agent_name, api_key, session_id } = twin.identity;
  if (!agent_name || !api_key) {
    res.status(400).json({
      type: 'ERROR',
      error: 'Invalid identity: agent_name and api_key are required'
    });
    return;
  }

  // 3. Authenticate via API key (SHA-256 hash lookup)
  const keyHash = createHash('sha256').update(api_key).digest('hex');
  const db = getDb();

  const keyRow = db.prepare(
    `SELECT ak.id AS key_id, ak.revoked_at, u.id, u.email, u.name
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = ?`
  ).get(keyHash) as any;

  if (!keyRow) {
    res.status(401).json({ type: 'ERROR', error: 'Invalid API key' });
    return;
  }
  if (keyRow.revoked_at) {
    res.status(401).json({ type: 'ERROR', error: 'API key has been revoked' });
    return;
  }

  const userId = keyRow.id;

  // 4. Validate role
  const currentRole = twin.role?.current;
  if (currentRole && !VALID_ROLES.includes(currentRole)) {
    res.status(400).json({
      type: 'ERROR',
      error: `Invalid role '${currentRole}'. Must be one of: ${VALID_ROLES.join(', ')}`
    });
    return;
  }

  // 5. Check project exists and access
  const projectSlug = twin.project?.slug;
  if (!projectSlug) {
    res.status(400).json({ type: 'ERROR', error: 'project.slug is required' });
    return;
  }

  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(projectSlug);
  if (!project) {
    res.status(404).json({ type: 'ERROR', error: `Project not found: ${projectSlug}` });
    return;
  }

  const access = db.prepare(
    'SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?'
  ).get(userId, projectSlug) as any;

  if (!access) {
    res.status(403).json({ type: 'ERROR', error: 'Access denied: not a member of this project' });
    return;
  }

  // 6. Register agent (INSERT new or UPDATE re-registration)
  const agentSessionId = session_id || randomUUID();
  const capabilities = twin.role?.capabilities;
  const capabilitiesJson = Array.isArray(capabilities) ? JSON.stringify(capabilities) : null;

  const existing = db.prepare(
    'SELECT id FROM agents WHERE user_id = ? AND name = ? AND (project_slug = ? OR (project_slug IS NULL AND ? IS NULL)) AND status != ?'
  ).get(userId, agent_name, projectSlug, projectSlug, 'disconnected') as any;

  let agentId: string;
  let isReconnect = false;

  if (existing) {
    // Re-registration: UPDATE existing agent
    agentId = existing.id;
    isReconnect = true;
    db.prepare(
      "UPDATE agents SET session_id = ?, current_role = ?, capabilities = ?, connected_at = datetime('now'), last_seen = datetime('now'), status = 'active' WHERE id = ?"
    ).run(agentSessionId, currentRole || null, capabilitiesJson, agentId);
  } else {
    // New registration: INSERT new agent
    agentId = randomUUID();
    db.prepare(
      'INSERT INTO agents (id, user_id, name, current_role, capabilities, project_slug, session_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(agentId, userId, agent_name, currentRole || null, capabilitiesJson, projectSlug, agentSessionId, 'active');
  }

  // 7. Return WELCOME message
  res.status(200).json({
    type: 'WELCOME',
    agent_id: agentId,
    session_id: agentSessionId,
    reconnect: isReconnect,
    project: {
      slug: projectSlug,
      access_role: access.role
    },
    endpoints: {
      stream: `/a2a/stream/${agentId}`,
      heartbeat: `/api/agents/${agentId}/heartbeat`,
      disconnect: `/api/agents/${agentId}/status`
    },
    timestamp: new Date().toISOString()
  });
});
