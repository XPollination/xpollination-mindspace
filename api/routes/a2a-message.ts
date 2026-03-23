import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { renewBond, getActiveBond, expireBond } from './agent-bond.js';
import { getAttestation, resolveAttestation } from '../lib/attestation.js';
import { formatMissionTwin, formatCapabilityTwin, formatRequirementTwin, formatTaskTwin } from '../lib/twin-formatter.js';
import { broadcast } from '../lib/sse-manager.js';

export const a2aMessageRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];

type MessageHandler = (agent: any, body: any, res: Response) => void;

const MESSAGE_HANDLERS: Record<string, MessageHandler> = {
  HEARTBEAT: handleHeartbeat,
  ROLE_SWITCH: handleRoleSwitch,
  DISCONNECT: handleDisconnect,
  CLAIM_TASK: handleStub,
  TRANSITION: handleTransition,
  RELEASE_TASK: handleStub,
  ATTESTATION_SUBMITTED: handleAttestationSubmitted,
  OBJECT_QUERY: handleObjectQuery,
  OBJECT_CREATE: handleStub,
  OBJECT_UPDATE: handleStub,
};

// POST / — unified A2A message endpoint
a2aMessageRouter.post('/', (req: Request, res: Response) => {
  const { agent_id, type } = req.body;

  if (!agent_id) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: agent_id' });
    return;
  }

  if (!type) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: type' });
    return;
  }

  const handler = MESSAGE_HANDLERS[type];
  if (!handler) {
    res.status(400).json({ type: 'ERROR', error: `Unknown message type: ${type}. Must be one of: ${Object.keys(MESSAGE_HANDLERS).join(', ')}` });
    return;
  }

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent_id) as any;

  if (!agent) {
    res.status(404).json({ type: 'ERROR', error: 'Agent not found' });
    return;
  }

  if (agent.status === 'disconnected') {
    res.status(409).json({ type: 'ERROR', error: 'Disconnected agents must re-register via /a2a/connect' });
    return;
  }

  handler(agent, req.body, res);
});

function handleHeartbeat(agent: any, _body: any, res: Response): void {
  const db = getDb();

  // Reactivate idle agents on heartbeat
  const newStatus = agent.status === 'idle' ? 'active' : agent.status;
  db.prepare("UPDATE agents SET last_seen = datetime('now'), status = ? WHERE id = ?")
    .run(newStatus, agent.id);

  // Renew active bond
  renewBond(agent.id);

  res.status(200).json({
    type: 'ACK',
    original_type: 'HEARTBEAT',
    agent_id: agent.id,
    status: newStatus,
    last_seen: new Date().toISOString(),
    timestamp: new Date().toISOString()
  });
}

function handleRoleSwitch(agent: any, body: any, res: Response): void {
  const { to_role, from_role, reason } = body;

  if (!to_role) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: to_role' });
    return;
  }

  if (!VALID_ROLES.includes(to_role)) {
    res.status(400).json({ type: 'ERROR', error: `Invalid to_role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  // Safety check: if from_role provided, verify it matches current_role
  if (from_role && agent.current_role !== from_role) {
    res.status(409).json({ type: 'ERROR', error: `Role mismatch: agent current_role is '${agent.current_role}', expected '${from_role}'` });
    return;
  }

  // Validate to_role against agent capabilities
  const capabilities = agent.capabilities ? JSON.parse(agent.capabilities) : [];
  if (capabilities.length > 0 && !capabilities.includes(to_role)) {
    res.status(403).json({ type: 'ERROR', error: `Role '${to_role}' is not in agent capabilities: [${capabilities.join(', ')}]` });
    return;
  }

  const db = getDb();
  const previous_role = agent.current_role;
  db.prepare("UPDATE agents SET current_role = ?, last_seen = datetime('now') WHERE id = ?")
    .run(to_role, agent.id);

  res.status(200).json({
    type: 'ACK',
    original_type: 'ROLE_SWITCH',
    agent_id: agent.id,
    previous_role,
    current_role: to_role,
    reason: reason || null,
    timestamp: new Date().toISOString()
  });
}

function handleDisconnect(agent: any, _body: any, res: Response): void {
  const db = getDb();
  db.prepare("UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now'), last_seen = datetime('now') WHERE id = ?")
    .run(agent.id);

  // Expire active bond
  const bond = getActiveBond(agent.id);
  if (bond) {
    expireBond(bond.id);
  }

  res.status(200).json({
    type: 'ACK',
    original_type: 'DISCONNECT',
    agent_id: agent.id,
    status: 'disconnected',
    timestamp: new Date().toISOString()
  });
}

function handleAttestationSubmitted(agent: any, body: any, res: Response): void {
  const { attestation_id, submitted_checks } = body;

  if (!attestation_id) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: attestation_id' });
    return;
  }

  if (!submitted_checks) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: submitted_checks' });
    return;
  }

  const attestation = getAttestation(attestation_id);
  if (!attestation) {
    res.status(404).json({ type: 'ERROR', error: 'Attestation not found' });
    return;
  }

  // Check attestation belongs to the requesting agent
  if (attestation.agent_id !== agent.id) {
    res.status(403).json({ type: 'ERROR', error: 'Attestation does not belong to this agent' });
    return;
  }

  // Check attestation is still pending
  if (attestation.status !== 'pending') {
    res.status(409).json({ type: 'ERROR', error: `Attestation is not pending (current status: ${attestation.status})` });
    return;
  }

  const resolved = resolveAttestation({
    attestation_id,
    status: 'submitted',
    submitted_checks
  });

  res.status(200).json({
    type: 'ACK',
    original_type: 'ATTESTATION_SUBMITTED',
    agent_id: agent.id,
    attestation_id,
    attestation: resolved,
    timestamp: new Date().toISOString()
  });
}

function handleObjectQuery(agent: any, body: any, res: Response): void {
  const { object_type, filters } = body;

  if (!object_type) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: object_type' });
    return;
  }

  const db = getDb();
  // __all__ = query across all projects (kanban "All Projects" mode)
  const rawSlug = filters?.project_slug || agent.project_slug;
  const projectSlug = rawSlug === '__all__' ? null : rawSlug;

  try {
    let objects: any[] = [];

    switch (object_type) {
      case 'mission': {
        let sql = 'SELECT * FROM missions WHERE 1=1';
        const params: any[] = [];
        if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
        if (filters?.id) { sql += ' AND id = ?'; params.push(filters.id); }
        if (filters?.short_id) { sql += ' AND short_id = ?'; params.push(filters.short_id); }
        sql += ' ORDER BY CASE WHEN status=\'active\' THEN 0 ELSE 1 END, created_at ASC';
        const rows = db.prepare(sql).all(...params);

        objects = rows.map((row: any) => {
          const twin = formatMissionTwin(row);
          // Nest capabilities if requested
          if (filters?.include_capabilities) {
            const caps = db.prepare(
              'SELECT * FROM capabilities WHERE mission_id = ? ORDER BY sort_order ASC, created_at ASC'
            ).all(row.id);
            (twin as any).capabilities = caps.map((c: any) => formatCapabilityTwin(c));
          }
          return twin;
        });
        break;
      }

      case 'capability': {
        let sql = 'SELECT * FROM capabilities WHERE 1=1';
        const params: any[] = [];
        if (filters?.mission_id) { sql += ' AND mission_id = ?'; params.push(filters.mission_id); }
        if (filters?.id) { sql += ' AND id = ?'; params.push(filters.id); }
        if (filters?.short_id) { sql += ' AND short_id = ?'; params.push(filters.short_id); }
        if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
        sql += ' ORDER BY sort_order ASC, created_at ASC';
        const rows = db.prepare(sql).all(...params);

        objects = rows.map((row: any) => {
          const twin = formatCapabilityTwin(row);
          if (filters?.include_requirements) {
            const reqs = db.prepare(
              'SELECT * FROM requirements WHERE capability_id = ? ORDER BY req_id_human ASC'
            ).all(row.id);
            (twin as any).requirements = reqs.map((r: any) => formatRequirementTwin(r));
          }
          if (filters?.include_tasks) {
            const tasks = db.prepare(
              `SELECT t.* FROM capability_tasks ct
               JOIN tasks t ON t.slug = ct.task_slug OR t.id = ct.task_slug
               WHERE ct.capability_id = ?`
            ).all(row.id);
            (twin as any).tasks = tasks.map((t: any) => formatTaskTwin(t));
          }
          return twin;
        });
        break;
      }

      case 'requirement': {
        let sql = 'SELECT * FROM requirements WHERE 1=1';
        const params: any[] = [];
        if (filters?.capability_id) { sql += ' AND capability_id = ?'; params.push(filters.capability_id); }
        if (filters?.id) { sql += ' AND id = ?'; params.push(filters.id); }
        if (filters?.short_id) { sql += ' AND short_id = ?'; params.push(filters.short_id); }
        if (projectSlug) { sql += ' AND project_slug = ?'; params.push(projectSlug); }
        sql += ' ORDER BY req_id_human ASC';
        objects = db.prepare(sql).all(...params).map((r: any) => formatRequirementTwin(r));
        break;
      }

      case 'task': {
        let sql = 'SELECT * FROM tasks WHERE 1=1';
        const params: any[] = [];
        if (projectSlug) { sql += ' AND project_slug = ?'; params.push(projectSlug); }
        if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
        if (filters?.current_role) { sql += ' AND current_role = ?'; params.push(filters.current_role); }
        if (filters?.slug) { sql += ' AND slug = ?'; params.push(filters.slug); }
        if (filters?.id) { sql += ' AND id = ?'; params.push(filters.id); }
        sql += ' ORDER BY updated_at DESC';
        if (filters?.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }
        objects = db.prepare(sql).all(...params).map((t: any) => formatTaskTwin(t));
        break;
      }

      default:
        res.status(400).json({ type: 'ERROR', error: `Unknown object_type: ${object_type}. Must be one of: mission, capability, requirement, task` });
        return;
    }

    res.status(200).json({
      type: 'OBJECT_DATA',
      original_type: 'OBJECT_QUERY',
      agent_id: agent.id,
      object_type,
      count: objects.length,
      objects,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ type: 'ERROR', error: `Query failed: ${err.message}` });
  }
}

function handleTransition(agent: any, body: any, res: Response): void {
  const { task_slug, to_status, payload } = body;

  if (!task_slug) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: task_slug' });
    return;
  }
  if (!to_status) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: to_status' });
    return;
  }

  const VALID_STATUSES = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
  if (!VALID_STATUSES.includes(to_status)) {
    res.status(400).json({ type: 'ERROR', error: `Invalid to_status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE slug = ? OR id = ?').get(task_slug, task_slug) as any;

  if (!task) {
    res.status(404).json({ type: 'ERROR', error: `Task not found: ${task_slug}` });
    return;
  }

  const previousStatus = task.status;

  // Apply DNA updates from payload
  if (payload && typeof payload === 'object') {
    let dna: any = {};
    try { dna = JSON.parse(task.dna_json || '{}'); } catch { /* ignore */ }
    Object.assign(dna, payload);
    db.prepare("UPDATE tasks SET dna_json = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(dna), task.id);
  }

  // Execute transition
  db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(to_status, task.id);

  // Record in task_transitions
  try {
    db.prepare(
      'INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, project_slug) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      require('node:crypto').randomUUID(),
      task.id,
      previousStatus,
      to_status,
      agent.name || agent.id,
      task.project_slug
    );
  } catch { /* task_transitions table may not have all columns */ }

  // Broadcast transition via SSE to all connected clients
  broadcast('transition', {
    task_slug: task.slug || task.id,
    task_id: task.id,
    from_status: previousStatus,
    to_status,
    actor: agent.name || agent.id,
    timestamp: new Date().toISOString()
  });

  res.status(200).json({
    type: 'ACK',
    original_type: 'TRANSITION',
    agent_id: agent.id,
    task_slug: task.slug || task.id,
    from_status: previousStatus,
    to_status,
    timestamp: new Date().toISOString()
  });
}

function handleStub(_agent: any, body: any, res: Response): void {
  res.status(501).json({
    type: 'ERROR',
    error: `Message type ${body.type} is not yet implemented.`
  });
}
