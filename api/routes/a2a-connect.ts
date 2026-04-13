import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';
import { createChallenge, getPendingChallenges, removeChallenge, cleanupExpired } from '../lib/challenge-store.js';

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

type AuthResult =
  | { userId: string; method: 'api_key' | 'jwt'; deviceKeyId?: undefined }
  | { userId: string; method: 'device_key'; deviceKeyId: string }
  | { userId: null; method: 'device_key_challenge'; deviceKeyId?: undefined }
  | null;

/**
 * Authenticate via device key, API key, or JWT.
 * Returns userId + method, or a challenge signal for device key flow.
 */
function authenticateIdentity(req: Request, identity: any): AuthResult {
  const db = getDb();

  // Path 1: Ed25519 device key (challenge-response)
  if (identity?.key_id) {
    const keyRow = db.prepare(
      'SELECT id, user_id, public_key_pem, revoked_at FROM device_keys WHERE id = ?'
    ).get(identity.key_id) as any;

    if (!keyRow || keyRow.revoked_at) return null;

    if (!identity.signature) {
      // Step 1: Client requests challenge — return signal (handled in route)
      return { userId: null, method: 'device_key_challenge' };
    }

    // Step 2: Verify Ed25519 signature against ANY pending challenge for this key.
    // Multiple bodies may have outstanding challenges concurrently — try each.
    const pendingNonces = getPendingChallenges(identity.key_id);
    if (pendingNonces.length === 0) return null;

    let matchedNonce: Buffer | null = null;
    try {
      const pubKey = crypto.createPublicKey(keyRow.public_key_pem);
      const sigBuf = Buffer.from(identity.signature, 'base64');
      for (const nonce of pendingNonces) {
        if (crypto.verify(null, nonce, pubKey, sigBuf)) {
          matchedNonce = nonce;
          break;
        }
      }
    } catch {
      return null;
    }
    if (!matchedNonce) return null;
    removeChallenge(identity.key_id, matchedNonce);

    // Update last_active on successful auth
    db.prepare("UPDATE device_keys SET last_active = datetime('now') WHERE id = ?").run(keyRow.id);

    return { userId: keyRow.user_id, method: 'device_key', deviceKeyId: keyRow.id };
  }

  // Path 2: API key in twin identity (agents, CLI)
  if (identity?.api_key) {
    const keyHash = createHash('sha256').update(identity.api_key).digest('hex');
    const keyRow = db.prepare(
      `SELECT ak.id AS key_id, ak.revoked_at, u.id AS user_id
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = ?`
    ).get(keyHash) as any;

    if (!keyRow || keyRow.revoked_at) return null;
    return { userId: keyRow.user_id, method: 'api_key' };
  }

  // Path 3: JWT from Authorization header (browser — viz proxy sets this from ms_session cookie)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.sub) return { userId: decoded.sub, method: 'jwt' };
    } catch { /* invalid JWT */ }
  }

  return null;
}

// Cleanup expired challenges every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);

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

  // 3. Authenticate via device key, API key, or JWT
  const auth = authenticateIdentity(req, twin.identity);
  if (!auth) {
    res.status(401).json({ type: 'ERROR', error: 'Authentication failed: invalid device key, API key, or JWT' });
    return;
  }

  // Device key challenge-response step 1: return nonce
  if (auth.method === 'device_key_challenge') {
    const challenge = createChallenge(twin.identity.key_id);
    res.status(200).json({ type: 'CHALLENGE', challenge, expires_in: 60 });
    return;
  }

  const userId = auth.userId as string;

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

  // Capability assignment — server decides based on auth method, agent cannot self-assign.
  // See api/routes/SECURITY.md for the full model.
  let canStream = 0;
  if (auth.method === 'jwt') {
    // Browser user session — always allowed to stream (UI needs real-time updates)
    canStream = 1;
  } else if (auth.method === 'device_key' && twin.metadata?.client === 'xpo-agent') {
    // Ed25519 device key — persistent auth, always allowed to stream
    canStream = 1;
  } else if (auth.method === 'api_key' && twin.metadata?.client === 'xpo-agent') {
    // Certified A2A body — authenticated + declared itself as body
    canStream = 1;
  }
  // API key without body claim → canStream stays 0 (soul, delivery agent)

  const existing = db.prepare(
    'SELECT id FROM agents WHERE user_id = ? AND name = ? AND (project_slug = ? OR (project_slug IS NULL AND ? IS NULL)) AND status != ?'
  ).get(userId, agent_name, projectSlug, projectSlug, 'disconnected') as any;

  let agentId: string;
  let isReconnect = false;

  const deviceKeyId = auth.method === 'device_key' ? auth.deviceKeyId : null;

  if (existing) {
    // Re-registration: UPDATE existing agent
    agentId = existing.id;
    isReconnect = true;
    db.prepare(
      "UPDATE agents SET session_id = ?, current_role = ?, capabilities = ?, can_stream = ?, device_key_id = ?, connected_at = datetime('now'), last_seen = datetime('now'), status = 'active' WHERE id = ?"
    ).run(agentSessionId, currentRole || null, capabilitiesJson, canStream, deviceKeyId, agentId);
  } else {
    // New registration: INSERT new agent
    agentId = randomUUID();
    db.prepare(
      'INSERT INTO agents (id, user_id, name, current_role, capabilities, project_slug, session_id, status, can_stream, device_key_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(agentId, userId, agent_name, currentRole || null, capabilitiesJson, projectSlug, agentSessionId, 'active', canStream, deviceKeyId);
  }

  // Track agent connection for device key (Connected Devices UI)
  // Dedup on role + session_name (stable identity), not agent_name (has random suffix)
  const sessionName = twin.metadata?.session || null;
  if (deviceKeyId) {
    db.prepare(
      "UPDATE agent_connections SET disconnected_at = datetime('now') WHERE device_key_id = ? AND role = ? AND session_name IS ? AND disconnected_at IS NULL"
    ).run(deviceKeyId, currentRole, sessionName);
    db.prepare(
      'INSERT INTO agent_connections (id, device_key_id, agent_id, agent_name, session_name, role, project_slug) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), deviceKeyId, agentId, agent_name, sessionName, currentRole, projectSlug);
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
    // Service discovery — canonical URLs bodies should use going forward.
    // There is no separate "API" — agents talk to A2A only. The hive URL is
    // the public canonical entry point for A2A. To migrate A2A to a new host:
    // change CANONICAL_HIVE_URL on the new server, restart, point DNS — bodies
    // automatically use the new URL on their next connect.
    //
    // brain: null because bodies never query brain directly — they use A2A
    //        BRAIN_QUERY messages, A2A proxies internally.
    // viz:   for human-facing UI references (not used by bodies).
    services: {
      hive:  process.env.CANONICAL_HIVE_URL || `${req.protocol}://${req.get('host')}`,
      brain: null,
      viz:   process.env.CANONICAL_VIZ_URL || null,
    },
    available_actions: getAvailableActions(currentRole),
    protocol_version: '2.0',
    timestamp: new Date().toISOString()
  });
});
