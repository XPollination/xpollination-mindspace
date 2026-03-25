import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { renewBond, getActiveBond, expireBond } from './agent-bond.js';
import { getAttestation, resolveAttestation } from '../lib/attestation.js';
import { formatMissionTwin, formatCapabilityTwin, formatRequirementTwin, formatTaskTwin } from '../lib/twin-formatter.js';
import { broadcast } from '../lib/sse-manager.js';
import crypto from 'node:crypto';
import { createMission, validateMission, diffMission } from '../../src/twins/mission-twin.js';
import { createCapability, validateCapability, diffCapability } from '../../src/twins/capability-twin.js';
import { createRequirement, validateRequirement, diffRequirement } from '../../src/twins/requirement-twin.js';
import { createTask, validateTask, diffTask } from '../../src/twins/task-twin.js';

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
  OBJECT_CREATE: handleObjectCreate,
  OBJECT_UPDATE: handleObjectUpdate,
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
        // Scope to user's projects (unless querying by specific id/short_id)
        if (!filters?.id && !filters?.short_id && projectSlug) {
          sql += ' AND project_slug = ?'; params.push(projectSlug);
        } else if (!filters?.id && !filters?.short_id && !projectSlug) {
          // __all__ mode: scope to user's accessible projects
          const userId = agent.user_id;
          if (userId) {
            sql += ' AND (project_slug IN (SELECT project_slug FROM project_access WHERE user_id = ?) OR project_slug IS NULL)';
            params.push(userId);
          }
        }
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

  const db = getDb();

  // Check if this is a mission transition (payload.twin_type === 'mission' or ID starts with 'mission-')
  const isMission = payload?.twin_type === 'mission' || task_slug.startsWith('mission-');

  if (isMission) {
    const MISSION_STATUSES = ['draft', 'ready', 'active', 'complete', 'deprecated'];
    if (!MISSION_STATUSES.includes(to_status)) {
      res.status(400).json({ type: 'ERROR', error: `Invalid mission status. Must be one of: ${MISSION_STATUSES.join(', ')}` });
      return;
    }
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(task_slug) as any;
    if (!mission) {
      res.status(404).json({ type: 'ERROR', error: `Mission not found: ${task_slug}` });
      return;
    }
    const previousStatus = mission.status;
    db.prepare("UPDATE missions SET status = ?, updated_at = datetime('now') WHERE id = ?").run(to_status, mission.id);

    broadcast('transition', {
      twin_type: 'mission', task_slug: mission.id, task_id: mission.id,
      from_status: previousStatus, to_status, actor: agent.name || agent.id,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      type: 'ACK', original_type: 'TRANSITION', agent_id: agent.id,
      task_slug: mission.id, from_status: previousStatus, to_status,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Task transition
  const VALID_STATUSES = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
  if (!VALID_STATUSES.includes(to_status)) {
    res.status(400).json({ type: 'ERROR', error: `Invalid to_status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

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

const OBJECT_TYPE_CONFIG: Record<string, { table: string; required: string[]; defaults: Record<string, any> }> = {
  mission: { table: 'missions', required: ['title', 'project_slug'], defaults: { status: 'draft' } },
  capability: { table: 'capabilities', required: ['title', 'mission_id'], defaults: { status: 'draft', sort_order: 0 } },
  requirement: { table: 'requirements', required: ['title', 'project_slug', 'req_id_human'], defaults: { status: 'draft', priority: 'medium' } },
  task: { table: 'tasks', required: ['title', 'project_slug'], defaults: { status: 'pending' } },
};

function handleObjectCreate(agent: any, body: any, res: Response): void {
  const { object_type, payload } = body;

  if (!object_type) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: object_type' });
    return;
  }

  const config = OBJECT_TYPE_CONFIG[object_type];
  if (!config) {
    res.status(400).json({ type: 'ERROR', error: `Unknown object_type: ${object_type}. Must be one of: ${Object.keys(OBJECT_TYPE_CONFIG).join(', ')}` });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: payload' });
    return;
  }

  // Check required fields
  const missing = config.required.filter(f => !payload[f]);
  if (missing.length > 0) {
    res.status(400).json({ type: 'ERROR', error: `Missing required payload fields for ${object_type}: ${missing.join(', ')}` });
    return;
  }

  const id = payload.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const db = getDb();

  try {
    switch (object_type) {
      case 'mission': {
        const slug = payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        db.prepare(
          'INSERT INTO missions (id, title, description, status, slug, project_slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, payload.title, payload.description || null, payload.status || config.defaults.status, slug, payload.project_slug, now, now);

        const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id);
        const twin = formatMissionTwin(row);
        broadcast('object_create', { object_type, twin, actor: agent.name || agent.id, timestamp: now });
        res.status(201).json({ type: 'ACK', original_type: 'OBJECT_CREATE', agent_id: agent.id, object_type, object_id: id, twin, timestamp: now });
        return;
      }

      case 'capability': {
        db.prepare(
          'INSERT INTO capabilities (id, mission_id, title, description, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, payload.mission_id, payload.title, payload.description || null, payload.status || config.defaults.status, payload.sort_order ?? config.defaults.sort_order, now, now);

        const row = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(id);
        const twin = formatCapabilityTwin(row);
        broadcast('object_create', { object_type, twin, actor: agent.name || agent.id, timestamp: now });
        res.status(201).json({ type: 'ACK', original_type: 'OBJECT_CREATE', agent_id: agent.id, object_type, object_id: id, twin, timestamp: now });
        return;
      }

      case 'requirement': {
        db.prepare(
          'INSERT INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, payload.project_slug, payload.req_id_human, payload.title, payload.description || null, payload.status || config.defaults.status, payload.priority || config.defaults.priority, agent.name || agent.id, now, now);

        const row = db.prepare('SELECT * FROM requirements WHERE id = ?').get(id);
        const twin = formatRequirementTwin(row);
        broadcast('object_create', { object_type, twin, actor: agent.name || agent.id, timestamp: now });
        res.status(201).json({ type: 'ACK', original_type: 'OBJECT_CREATE', agent_id: agent.id, object_type, object_id: id, twin, timestamp: now });
        return;
      }

      case 'task': {
        const slug = payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const dna = { title: payload.title, role: payload.current_role || 'liaison', description: payload.description || undefined, ...payload.dna };
        db.prepare(
          'INSERT INTO tasks (id, project_slug, title, description, status, current_role, slug, dna_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, payload.project_slug, payload.title, payload.description || null, payload.status || config.defaults.status, payload.current_role || 'liaison', slug, JSON.stringify(dna), now, now);

        const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        const twin = formatTaskTwin(row);
        broadcast('object_create', { object_type, twin, actor: agent.name || agent.id, timestamp: now });
        res.status(201).json({ type: 'ACK', original_type: 'OBJECT_CREATE', agent_id: agent.id, object_type, object_id: id, twin, timestamp: now });
        return;
      }
    }
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ type: 'ERROR', error: `Duplicate: ${err.message}` });
      return;
    }
    res.status(500).json({ type: 'ERROR', error: `Create failed: ${err.message}` });
  }
}

function handleObjectUpdate(agent: any, body: any, res: Response): void {
  const { object_type, object_id, payload } = body;

  if (!object_type) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: object_type' });
    return;
  }
  if (!object_id) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: object_id' });
    return;
  }
  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: payload' });
    return;
  }

  const config = OBJECT_TYPE_CONFIG[object_type];
  if (!config) {
    res.status(400).json({ type: 'ERROR', error: `Unknown object_type: ${object_type}. Must be one of: ${Object.keys(OBJECT_TYPE_CONFIG).join(', ')}` });
    return;
  }

  const db = getDb();
  const now = new Date().toISOString();

  try {
    switch (object_type) {
      case 'mission': {
        const row = db.prepare('SELECT * FROM missions WHERE id = ? OR slug = ?').get(object_id, object_id) as any;
        if (!row) { res.status(404).json({ type: 'ERROR', error: `Mission not found: ${object_id}` }); return; }
        const originalTwin = createMission({ id: row.id, title: row.title, description: row.description, status: row.status, slug: row.slug, project_slug: row.project_slug, content_md: row.content_md, content_version: row.content_version });
        const mergedTwin = createMission({ ...originalTwin, ...payload, _type: undefined, _schema_version: undefined, _created_at: undefined, _updated_at: undefined });
        const validation = validateMission(mergedTwin);
        if (!validation.valid) { res.status(422).json({ type: 'ERROR', error: `Validation failed: ${validation.errors.join('; ')}` }); return; }
        const diff = diffMission(mergedTwin, originalTwin);
        if (Object.keys(diff).length === 0) { res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, no_change: true, timestamp: now }); return; }
        const updates: string[] = []; const params: any[] = [];
        for (const key of ['title', 'description', 'status', 'slug', 'content_md', 'content_version', 'project_slug']) {
          if (payload[key] !== undefined) { updates.push(`${key} = ?`); params.push(payload[key]); }
        }
        updates.push("updated_at = ?"); params.push(now); params.push(row.id);
        db.prepare(`UPDATE missions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        const updatedRow = db.prepare('SELECT * FROM missions WHERE id = ?').get(row.id);
        const twin = formatMissionTwin(updatedRow);
        broadcast('object_update', { object_type, object_id: row.id, diff, actor: agent.name || agent.id, timestamp: now });
        res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, diff, twin, timestamp: now });
        return;
      }

      case 'capability': {
        const row = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(object_id) as any;
        if (!row) { res.status(404).json({ type: 'ERROR', error: `Capability not found: ${object_id}` }); return; }
        const originalTwin = createCapability({ id: row.id, mission_id: row.mission_id, title: row.title, description: row.description, status: row.status, sort_order: row.sort_order, content_md: row.content_md, content_version: row.content_version });
        const mergedTwin = createCapability({ ...originalTwin, ...payload, _type: undefined, _schema_version: undefined, _created_at: undefined, _updated_at: undefined });
        const validation = validateCapability(mergedTwin);
        if (!validation.valid) { res.status(422).json({ type: 'ERROR', error: `Validation failed: ${validation.errors.join('; ')}` }); return; }
        const diff = diffCapability(mergedTwin, originalTwin);
        if (Object.keys(diff).length === 0) { res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, no_change: true, timestamp: now }); return; }
        const updates: string[] = []; const params: any[] = [];
        for (const key of ['title', 'description', 'status', 'sort_order', 'mission_id', 'content_md', 'content_version']) {
          if (payload[key] !== undefined) { updates.push(`${key} = ?`); params.push(key === 'sort_order' ? Number(payload[key]) : payload[key]); }
        }
        updates.push("updated_at = ?"); params.push(now); params.push(row.id);
        db.prepare(`UPDATE capabilities SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        const updatedRow = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(row.id);
        const twin = formatCapabilityTwin(updatedRow);
        broadcast('object_update', { object_type, object_id: row.id, diff, actor: agent.name || agent.id, timestamp: now });
        res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, diff, twin, timestamp: now });
        return;
      }

      case 'requirement': {
        const row = db.prepare('SELECT * FROM requirements WHERE id = ? OR req_id_human = ?').get(object_id, object_id) as any;
        if (!row) { res.status(404).json({ type: 'ERROR', error: `Requirement not found: ${object_id}` }); return; }
        const originalTwin = createRequirement({ id: row.id, project_slug: row.project_slug, req_id_human: row.req_id_human, title: row.title, description: row.description, status: row.status, priority: row.priority, capability_id: row.capability_id });
        const mergedTwin = createRequirement({ ...originalTwin, ...payload, _type: undefined, _schema_version: undefined, _created_at: undefined, _updated_at: undefined });
        const validation = validateRequirement(mergedTwin);
        if (!validation.valid) { res.status(422).json({ type: 'ERROR', error: `Validation failed: ${validation.errors.join('; ')}` }); return; }
        const diff = diffRequirement(mergedTwin, originalTwin);
        if (Object.keys(diff).length === 0) { res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, no_change: true, timestamp: now }); return; }
        const updates: string[] = []; const params: any[] = [];
        for (const key of ['title', 'description', 'status', 'priority', 'req_id_human', 'capability_id', 'content_md', 'content_version']) {
          if (payload[key] !== undefined) { updates.push(`${key} = ?`); params.push(payload[key]); }
        }
        updates.push("updated_at = ?"); params.push(now); params.push(row.id);
        db.prepare(`UPDATE requirements SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        const updatedRow = db.prepare('SELECT * FROM requirements WHERE id = ?').get(row.id);
        const twin = formatRequirementTwin(updatedRow);
        broadcast('object_update', { object_type, object_id: row.id, diff, actor: agent.name || agent.id, timestamp: now });
        res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, diff, twin, timestamp: now });
        return;
      }

      case 'task': {
        const row = db.prepare('SELECT * FROM tasks WHERE id = ? OR slug = ?').get(object_id, object_id) as any;
        if (!row) { res.status(404).json({ type: 'ERROR', error: `Task not found: ${object_id}` }); return; }
        let existingDna: any = {};
        try { existingDna = JSON.parse(row.dna_json || '{}'); } catch { /* ignore */ }
        const originalTwin = createTask({ slug: row.slug || row.id, status: row.status, dna: { title: row.title || existingDna.title, role: row.current_role || existingDna.role, ...existingDna }, project_slug: row.project_slug });
        // For tasks, payload.dna merges into existing dna
        const mergedDna = payload.dna ? { ...existingDna, ...payload.dna } : existingDna;
        const mergedInput: any = { slug: row.slug || row.id, status: payload.status || row.status, dna: { title: payload.title || row.title || mergedDna.title, role: payload.current_role || row.current_role || mergedDna.role, ...mergedDna }, project_slug: payload.project_slug || row.project_slug };
        const mergedTwin = createTask(mergedInput);
        const validation = validateTask(mergedTwin);
        if (!validation.valid) { res.status(422).json({ type: 'ERROR', error: `Validation failed: ${validation.errors.join('; ')}` }); return; }
        const diff = diffTask(mergedTwin, originalTwin);
        if (Object.keys(diff).length === 0) { res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, no_change: true, timestamp: now }); return; }
        const updates: string[] = []; const params: any[] = [];
        if (payload.title) { updates.push('title = ?'); params.push(payload.title); }
        if (payload.description !== undefined) { updates.push('description = ?'); params.push(payload.description); }
        if (payload.status) { updates.push('status = ?'); params.push(payload.status); }
        if (payload.current_role) { updates.push('current_role = ?'); params.push(payload.current_role); }
        if (payload.dna || payload.title || payload.current_role) {
          updates.push('dna_json = ?'); params.push(JSON.stringify(mergedDna));
        }
        updates.push("updated_at = ?"); params.push(now); params.push(row.id);
        db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        const updatedRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.id);
        const twin = formatTaskTwin(updatedRow);
        broadcast('object_update', { object_type, object_id: row.id, diff, actor: agent.name || agent.id, timestamp: now });
        res.status(200).json({ type: 'ACK', original_type: 'OBJECT_UPDATE', agent_id: agent.id, object_type, object_id: row.id, diff, twin, timestamp: now });
        return;
      }
    }
  } catch (err: any) {
    res.status(500).json({ type: 'ERROR', error: `Update failed: ${err.message}` });
  }
}

function handleStub(_agent: any, body: any, res: Response): void {
  res.status(501).json({
    type: 'ERROR',
    error: `Message type ${body.type} is not yet implemented.`
  });
}
