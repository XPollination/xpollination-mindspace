import { Router, Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';

export const a2aConnectRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// A2A Protocol v2: agents discover capabilities at runtime from WELCOME
const ROLE_ACTIONS: Record<string, string[]> = {
  liaison: ['TRANSITION', 'DECISION_RESPONSE', 'HUMAN_INPUT', 'OBJECT_QUERY', 'OBJECT_CREATE', 'OBJECT_UPDATE', 'BRAIN_QUERY', 'BRAIN_CONTRIBUTE', 'WORKSPACE_DOCK', 'WORKSPACE_UNDOCK'],
  pdsa: ['TRANSITION', 'DECISION_REQUEST', 'OBJECT_QUERY', 'OBJECT_CREATE', 'OBJECT_UPDATE', 'BRAIN_QUERY', 'BRAIN_CONTRIBUTE', 'WORKSPACE_DOCK'],
  dev: ['TRANSITION', 'OBJECT_QUERY', 'OBJECT_UPDATE', 'BRAIN_QUERY', 'BRAIN_CONTRIBUTE', 'WORKSPACE_DOCK'],
  qa: ['TRANSITION', 'OBJECT_QUERY', 'OBJECT_UPDATE', 'BRAIN_QUERY', 'BRAIN_CONTRIBUTE'],
  orchestrator: ['TRANSITION', 'DECISION_REQUEST', 'OBJECT_QUERY', 'OBJECT_CREATE', 'OBJECT_UPDATE', 'BRAIN_QUERY', 'BRAIN_CONTRIBUTE', 'WORKSPACE_DOCK', 'WORKSPACE_UNDOCK'],
};

function getAvailableActions(role: string | null): string[] {
  return ROLE_ACTIONS[role || 'dev'] || ROLE_ACTIONS.dev;
}

/**
 * Authenticate via API key (SHA-256 hash lookup) or JWT.
 * Returns userId or null.
 */
function authenticateIdentity(req: Request, apiKey?: string): string | null {
  const db = getDb();

  // Path 1: API key in twin identity (agents, CLI)
  if (apiKey) {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyRow = db.prepare(
      `SELECT ak.id AS key_id, ak.revoked_at, u.id AS user_id
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = ?`
    ).get(keyHash) as any;

    if (!keyRow || keyRow.revoked_at) return null;
    return keyRow.user_id;
  }

  // Path 2: JWT from Authorization header (browser — viz proxy sets this from ms_session cookie)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.sub) return decoded.sub;
    } catch { /* invalid JWT */ }
  }

  return null;
}

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

  // 2. Validate identity fields — agent_name required, api_key optional (JWT fallback)
  const { agent_name, api_key, session_id } = twin.identity;
  if (!agent_name) {
    res.status(400).json({
      type: 'ERROR',
      error: 'Invalid identity: agent_name is required'
    });
    return;
  }

  // 3. Authenticate via API key or JWT
  const userId = authenticateIdentity(req, api_key);
  if (!userId) {
    res.status(401).json({ type: 'ERROR', error: 'Authentication failed: invalid API key or JWT' });
    return;
  }

  const db = getDb();

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

  // 7. Generate session token (JWT) for brain API auth
  const SESSION_TTL = parseInt(process.env.SESSION_TOKEN_TTL || '86400', 10); // default 24h
  const sessionToken = jwt.sign(
    { sub: userId, agent_id: agentId, project_slug: projectSlug, role: currentRole },
    JWT_SECRET,
    { expiresIn: SESSION_TTL }
  );
  const tokenExpiresAt = new Date(Date.now() + SESSION_TTL * 1000).toISOString();

  // 8. Return WELCOME message with session token and agent identity
  res.status(200).json({
    type: 'WELCOME',
    agent_id: agentId,
    session_id: agentSessionId,
    session_token: sessionToken,
    token_expires_at: tokenExpiresAt,
    agent_identity: {
      agent_id: agentId,
      agent_name: agent_name,
      role: currentRole || null,
      user_id: userId,
      project_slug: projectSlug,
      permissions: ['read', 'write', 'transition'],
    },
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
    available_actions: getAvailableActions(currentRole),
    protocol_version: '2.0',
    timestamp: new Date().toISOString()
  });
});
