import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { renewBond, getActiveBond, expireBond } from './agent-bond.js';
import { getAttestation, resolveAttestation } from '../lib/attestation.js';
import { formatMissionTwin, formatCapabilityTwin, formatRequirementTwin, formatTaskTwin } from '../lib/twin-formatter.js';
import { broadcast, sendToRole } from '../lib/sse-manager.js';
import crypto from 'node:crypto';
import { createMission, validateMission, diffMission } from '../../src/twins/mission-twin.js';
import { createCapability, validateCapability, diffCapability } from '../../src/twins/capability-twin.js';
import { createRequirement, validateRequirement, diffRequirement } from '../../src/twins/requirement-twin.js';
import { createTask, validateTask, diffTask, workflowContext } from '../../src/twins/task-twin.js';
import { createDecision, validateDecision } from '../../src/twins/decision-twin.js';
import { cascadeForward } from '../lib/cascade-engine.js';
import { grantLease, releaseLease, extendLease } from '../lib/lease-manager.js';
import { EVENT_TYPES, buildTaskAssigned, buildApprovalNeeded, buildReviewNeeded, buildReworkNeeded, buildTaskBlocked, buildDecisionNeeded, buildDecisionResolved, buildBrainGate } from '../lib/event-types.js';
import { createTwinFromTask } from '../lib/task-bridge.js';

export const a2aMessageRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];

type MessageHandler = (agent: any, body: any, res: Response) => void | Promise<void>;

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
  BRAIN_QUERY: handleBrainQuery,
  BRAIN_CONTRIBUTE: handleBrainContribute,
  CAPABILITY_ACTIVATE: handleCapabilityActivate,
  CAPABILITY_DEACTIVATE: handleCapabilityDeactivate,
  CAPABILITY_UPGRADE: handleCapabilityUpgrade,
  DECISION_REQUEST: handleDecisionRequest,
  DECISION_RESPONSE: handleDecisionResponse,
  WORKSPACE_DOCK: handleWorkspaceDock,
  WORKSPACE_UNDOCK: handleWorkspaceUndock,
  HUMAN_INPUT: handleHumanInput,
  VERSION_TRANSITION: handleVersionTransition,
};

const JWT_SECRET_MSG = process.env.JWT_SECRET || 'changeme';

// Resolve agent from session token (Authorization header) or body agent_id
function resolveAgent(req: Request, db: any): { agent: any; error?: string; status?: number } {
  const { agent_id } = req.body;

  // Try session token first (Authorization: Bearer <jwt>)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET_MSG) as any;
      if (decoded.agent_id) {
        const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(decoded.agent_id) as any;
        if (agent) return { agent };
      }
    } catch { /* invalid JWT, fall through to agent_id */ }
  }

  // Fallback: agent_id in body
  if (!agent_id) return { agent: null, error: 'Missing required field: agent_id', status: 400 };
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent_id) as any;
  if (!agent) return { agent: null, error: 'Agent not found', status: 404 };
  return { agent };
}

// POST / — unified A2A message endpoint
a2aMessageRouter.post('/', (req: Request, res: Response) => {
  const { type } = req.body;

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
  const { agent, error, status } = resolveAgent(req, db);

  if (!agent) {
    res.status(status || 404).json({ type: 'ERROR', error: error || 'Agent not found' });
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

  // Extend lease for any active task
  try {
    const activeTasks = db.prepare("SELECT id FROM tasks WHERE claimed_by = ? AND status = 'active'").all(agent.id) as any[];
    for (const t of activeTasks) {
      extendLease(db, t.id, agent.user_id || agent.id);
    }
  } catch { /* lease table may not exist in all envs */ }

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
        objects = db.prepare(sql).all(...params).map((t: any) => {
          const twin = formatTaskTwin(t);
          (twin as any)._workflow_context = workflowContext(twin);
          return twin;
        });
        break;
      }

      case 'decision': {
        let sql = 'SELECT * FROM decisions WHERE 1=1';
        const params: any[] = [];
        if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
        if (filters?.task_ref) { sql += ' AND task_ref = ?'; params.push(filters.task_ref); }
        if (filters?.id) { sql += ' AND id = ?'; params.push(filters.id); }
        if (projectSlug) { sql += ' AND project_slug = ?'; params.push(projectSlug); }
        sql += ' ORDER BY created_at DESC LIMIT 50';
        try { objects = db.prepare(sql).all(...params); } catch { objects = []; }
        break;
      }

      case 'version': {
        let sql = 'SELECT * FROM version_twins WHERE 1=1';
        const params: any[] = [];
        if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
        if (filters?.version) { sql += ' AND version = ?'; params.push(filters.version); }
        sql += ' ORDER BY created_at DESC LIMIT 20';
        try { objects = db.prepare(sql).all(...params); } catch { objects = []; }
        break;
      }

      default:
        res.status(400).json({ type: 'ERROR', error: `Unknown object_type: ${object_type}. Must be one of: mission, capability, requirement, task, decision, version` });
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

// Role consistency enforcement (v17) — fixed-role states
const EXPECTED_ROLES_BY_STATE: Record<string, string> = {
  complete: 'liaison', approval: 'liaison', approved: 'qa', testing: 'qa', cancelled: 'liaison',
};

// Quality gates: transition → required DNA fields
const QUALITY_GATES: Record<string, { required: string[]; githubUrl?: string[] }> = {
  'active->approval': { required: ['pdsa_ref', 'memory_contribution_id'], githubUrl: ['pdsa_ref'] },
  'approval->complete': { required: ['abstract_ref'], githubUrl: ['abstract_ref'] },
  'review->complete': { required: ['abstract_ref'], githubUrl: ['abstract_ref'] },
  'any->blocked': { required: ['blocked_reason'] },
  'ready->active': { required: ['memory_query_session'] },
};

// Human answer audit trail gate (v19) — required on requiresHumanConfirm transitions
const HUMAN_CONFIRM_TRANSITIONS = new Set([
  'approval->approved', 'approval->complete', 'approval->rework',
  'review->complete', 'review->rework',
]);
const VALID_APPROVAL_MODES = ['manual', 'semi', 'auto-approval', 'autonomous'];

function isGitHubUrl(s: string): boolean { return /^https:\/\/github\.com\//.test(s); }

function handleTransition(agent: any, body: any, res: Response): void {
  const { task_slug, to_status, payload } = body;

  if (!task_slug) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: task_slug' }); return; }
  if (!to_status) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: to_status' }); return; }

  const db = getDb();

  // --- Mission transitions (separate path, simpler rules) ---
  const isMission = payload?.twin_type === 'mission' || task_slug.startsWith('mission-');
  if (isMission) {
    const MISSION_STATUSES = ['draft', 'ready', 'active', 'complete', 'deprecated'];
    if (!MISSION_STATUSES.includes(to_status)) {
      res.status(400).json({ type: 'ERROR', error: `Invalid mission status. Must be one of: ${MISSION_STATUSES.join(', ')}` });
      return;
    }
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(task_slug) as any;
    if (!mission) { res.status(404).json({ type: 'ERROR', error: `Mission not found: ${task_slug}` }); return; }
    const previousStatus = mission.status;
    db.prepare("UPDATE missions SET status = ?, updated_at = datetime('now') WHERE id = ?").run(to_status, mission.id);
    broadcast('transition', { twin_type: 'mission', task_slug: mission.id, task_id: mission.id, from_status: previousStatus, to_status, actor: agent.name || agent.id, timestamp: new Date().toISOString() });
    res.status(200).json({ type: 'ACK', original_type: 'TRANSITION', agent_id: agent.id, task_slug: mission.id, from_status: previousStatus, to_status, timestamp: new Date().toISOString() });
    return;
  }

  // --- Task transitions with full validation ---
  const VALID_STATUSES = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
  if (!VALID_STATUSES.includes(to_status)) {
    res.status(400).json({ type: 'ERROR', error: `Invalid to_status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const task = db.prepare('SELECT * FROM tasks WHERE slug = ? OR id = ?').get(task_slug, task_slug) as any;
  if (!task) { res.status(404).json({ type: 'ERROR', error: `Task not found: ${task_slug}` }); return; }

  const fromStatus = task.status;
  const actor = agent.name || agent.id;
  let dna: any = {};
  try { dna = JSON.parse(task.dna_json || '{}'); } catch { /* ignore */ }

  // Merge payload into DNA before validation
  if (payload && typeof payload === 'object') {
    Object.assign(dna, payload);
  }

  // --- Blocked state: save from_state/from_role ---
  if (to_status === 'blocked') {
    if (!dna.blocked_reason) {
      res.status(422).json({ type: 'ERROR', error: 'Quality gate: blocked_reason required in DNA to transition to blocked' });
      return;
    }
    dna.blocked_from_state = fromStatus;
    dna.blocked_from_role = task.current_role;
    dna.blocked_at = new Date().toISOString();
  }

  // --- Blocked restore: read saved state+role ---
  let restoreRole: string | null = null;
  let restoreStatus: string | null = null;
  if (fromStatus === 'blocked' && to_status !== 'cancelled') {
    restoreStatus = dna.blocked_from_state;
    restoreRole = dna.blocked_from_role;
    if (!restoreStatus || !restoreRole) {
      res.status(422).json({ type: 'ERROR', error: 'Cannot restore from blocked: missing blocked_from_state or blocked_from_role in DNA' });
      return;
    }
    // Clear blocked fields
    delete dna.blocked_from_state;
    delete dna.blocked_from_role;
    delete dna.blocked_reason;
    delete dna.blocked_at;
  }

  const effectiveToStatus = restoreStatus || to_status;
  const transitionKey = `${fromStatus}->${effectiveToStatus}`;

  // --- Quality gates ---
  const gate = QUALITY_GATES[transitionKey] || QUALITY_GATES[`any->${effectiveToStatus}`];
  if (gate) {
    const missingFields = gate.required.filter(f => !dna[f]);
    if (missingFields.length > 0) {
      res.status(422).json({ type: 'ERROR', error: `Quality gate: missing required DNA fields for ${transitionKey}: ${missingFields.join(', ')}` });
      return;
    }
    if (gate.githubUrl) {
      for (const field of gate.githubUrl) {
        if (dna[field] && !isGitHubUrl(dna[field])) {
          res.status(422).json({ type: 'ERROR', error: `Quality gate: ${field} must be a GitHub URL` });
          return;
        }
      }
    }
  }

  // --- Cancelled gate: liaison requires abstract_ref (system exempt) ---
  if (effectiveToStatus === 'cancelled' && actor !== 'system') {
    if (!dna.abstract_ref || !isGitHubUrl(dna.abstract_ref)) {
      res.status(422).json({ type: 'ERROR', error: 'Quality gate: abstract_ref (GitHub URL) required to cancel (system exempt)' });
      return;
    }
  }

  // --- Human answer audit trail gate (v19) ---
  const isLiaison = (agent.current_role === 'liaison' || actor.toLowerCase().includes('liaison'));
  if (isLiaison && HUMAN_CONFIRM_TRANSITIONS.has(transitionKey)) {
    const missingAudit = ['human_answer', 'human_answer_at', 'approval_mode'].filter(f => !dna[f]);
    if (missingAudit.length > 0) {
      res.status(422).json({ type: 'ERROR', error: `Human answer audit gate (v19): missing ${missingAudit.join(', ')}` });
      return;
    }
    if (!VALID_APPROVAL_MODES.includes(dna.approval_mode)) {
      res.status(422).json({ type: 'ERROR', error: `Human answer audit gate: approval_mode must be one of: ${VALID_APPROVAL_MODES.join(', ')}` });
      return;
    }
  }

  // --- Brain contribution gate (Agent Experience) ---
  // Every transition from active work requires a brain contribution.
  // Agents must send BRAIN_CONTRIBUTE first, get thought_id, then include brain_contribution_id in payload.
  const BRAIN_GATE_TRANSITIONS = new Set(['active->approval', 'active->review', 'active->testing']);
  if (BRAIN_GATE_TRANSITIONS.has(transitionKey) && !dna.brain_contribution_id && !(payload?.brain_contribution_id)) {
    const gateEvent = buildBrainGate(task_slug, { task_slug, to_status, payload });
    res.status(422).json({
      type: 'BRAIN_GATE',
      error: 'Brain contribution required before completing active work',
      pending_transition: { task_slug, to_status, payload },
      instruction: 'Send BRAIN_CONTRIBUTE with your findings, receive thought_id, then retry TRANSITION with brain_contribution_id in payload',
    });
    return;
  }

  // --- Rework routing: require rework_target_role for specific transitions ---
  let newRole = task.current_role;
  if (effectiveToStatus === 'rework') {
    if (['review', 'complete', 'approval'].includes(fromStatus)) {
      if (!dna.rework_target_role) {
        res.status(422).json({ type: 'ERROR', error: 'Rework routing: dna.rework_target_role required (dev/pdsa/qa/liaison)' });
        return;
      }
      newRole = dna.rework_target_role;
    }
  }

  // --- Review chain: same-state role change ---
  if (fromStatus === 'review' && effectiveToStatus === 'review') {
    // review+qa → review+pdsa (actor: qa)
    if (task.current_role === 'qa') { newRole = 'pdsa'; }
    // review+pdsa → review+liaison (actor: pdsa)
    else if (task.current_role === 'pdsa') { newRole = 'liaison'; }
    else {
      res.status(400).json({ type: 'ERROR', error: `Invalid review chain: cannot transition review+${task.current_role} → review` });
      return;
    }
  }

  // --- Role consistency enforcement (v17) ---
  if (restoreRole) {
    newRole = restoreRole;
  } else if (EXPECTED_ROLES_BY_STATE[effectiveToStatus]) {
    newRole = EXPECTED_ROLES_BY_STATE[effectiveToStatus];
  }

  // --- Execute ---
  const now = new Date().toISOString();
  db.prepare("UPDATE tasks SET dna_json = ?, status = ?, current_role = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(dna), effectiveToStatus, newRole, now, task.id);

  // Record transition
  try {
    db.prepare('INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, project_slug) VALUES (?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), task.id, fromStatus, effectiveToStatus, actor, task.project_slug);
  } catch { /* table may not have all columns */ }

  // Lease management: grant on claim, release on exit from active
  try {
    if (fromStatus === 'ready' && effectiveToStatus === 'active') {
      grantLease(db, task.id, agent.user_id || agent.id);
    } else if (fromStatus === 'active' && ['review', 'complete', 'rework', 'blocked', 'cancelled'].includes(effectiveToStatus)) {
      releaseLease(db, task.id, agent.user_id || agent.id);
    }
  } catch { /* lease table may not exist in all envs */ }

  broadcast('transition', { task_slug: task.slug || task.id, task_id: task.id, from_status: fromStatus, to_status: effectiveToStatus, new_role: newRole, actor, timestamp: now });

  // Role-based event routing — send targeted events to the relevant role
  try {
    const wfTransitions = workflowContext(createTask({ slug: task.slug, status: effectiveToStatus, dna: { ...dna, role: newRole } })).available_transitions;
    if (effectiveToStatus === 'ready') {
      sendToRole(newRole, EVENT_TYPES.TASK_ASSIGNED, buildTaskAssigned(task, dna, wfTransitions), task.project_slug);
      // Bridge: create twin in MindspaceNode so runners can claim it
      createTwinFromTask(db, { ...task, current_role: newRole, dna_json: JSON.stringify(dna) }).catch(() => {});
    } else if (effectiveToStatus === 'approval') {
      sendToRole('liaison', EVENT_TYPES.APPROVAL_NEEDED, buildApprovalNeeded(task, dna), task.project_slug);
    } else if (effectiveToStatus === 'review') {
      sendToRole(newRole, EVENT_TYPES.REVIEW_NEEDED, buildReviewNeeded(task, dna, actor), task.project_slug);
    } else if (effectiveToStatus === 'rework') {
      sendToRole(newRole, EVENT_TYPES.REWORK_NEEDED, buildReworkNeeded(task, dna), task.project_slug);
    } else if (effectiveToStatus === 'blocked') {
      sendToRole('liaison', EVENT_TYPES.TASK_BLOCKED, buildTaskBlocked(task, dna), task.project_slug);
    }
  } catch { /* event routing is best-effort */ }

  // Forward cascade: if task completed, unblock dependents
  let cascadeResult = null;
  if (effectiveToStatus === 'complete') {
    cascadeResult = cascadeForward(task.id, db);
  }

  // Compute workflow context for the new state
  const postTwin = createTask({ slug: task.slug || task.id, status: effectiveToStatus, dna: { ...dna, role: newRole }, project_slug: task.project_slug });
  const wfContext = workflowContext(postTwin);

  res.status(200).json({
    type: 'ACK', original_type: 'TRANSITION', agent_id: agent.id,
    task_slug: task.slug || task.id, from_status: fromStatus, to_status: effectiveToStatus,
    new_role: newRole, workflow_context: wfContext, cascade: cascadeResult, timestamp: now
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
          'INSERT INTO capabilities (id, mission_id, title, description, status, sort_order, config, feature_gate, activation, rollback_plan, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, payload.mission_id, payload.title, payload.description || null, payload.status || config.defaults.status, payload.sort_order ?? config.defaults.sort_order, payload.config ? JSON.stringify(payload.config) : null, payload.feature_gate ? JSON.stringify(payload.feature_gate) : null, payload.activation ? JSON.stringify(payload.activation) : null, payload.rollback_plan ? JSON.stringify(payload.rollback_plan) : null, payload.version || '1.0.0', now, now);

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
        for (const key of ['title', 'description', 'status', 'sort_order', 'mission_id', 'content_md', 'content_version', 'config', 'feature_gate', 'activation', 'rollback_plan', 'version']) {
          if (payload[key] !== undefined) {
            const isJson = ['config', 'feature_gate', 'activation', 'rollback_plan'].includes(key);
            updates.push(`${key} = ?`);
            params.push(key === 'sort_order' ? Number(payload[key]) : isJson && typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : payload[key]);
          }
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

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';
const BRAIN_SERVICE_KEY = process.env.BRAIN_SERVICE_KEY || process.env.BRAIN_API_KEY || '';

async function handleBrainQuery(agent: any, body: any, res: Response): Promise<void> {
  const { prompt, read_only, session_id: clientSessionId } = body;
  if (!prompt) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: prompt' }); return; }

  try {
    const brainRes = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BRAIN_SERVICE_KEY}` },
      body: JSON.stringify({
        prompt,
        agent_id: agent.id,
        agent_name: agent.name || agent.id,
        session_id: clientSessionId || agent.session_id,
        read_only: read_only !== false,
      }),
    });
    const data = await brainRes.json();
    res.status(200).json({ type: 'BRAIN_RESULT', original_type: 'BRAIN_QUERY', agent_id: agent.id, result: data.result || data, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(502).json({ type: 'ERROR', error: `Brain proxy failed: ${err.message}` });
  }
}

async function handleBrainContribute(agent: any, body: any, res: Response): Promise<void> {
  const { prompt, context, thought_category, topic } = body;
  if (!prompt) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: prompt' }); return; }
  if (prompt.length < 50) { res.status(400).json({ type: 'ERROR', error: 'Contribution must be at least 50 characters' }); return; }

  try {
    const brainRes = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BRAIN_SERVICE_KEY}` },
      body: JSON.stringify({
        prompt,
        agent_id: agent.id,
        agent_name: agent.name || agent.id,
        session_id: body.session_id || agent.session_id,
        context: context || undefined,
        thought_category: thought_category || undefined,
        topic: topic || undefined,
      }),
    });
    const data = await brainRes.json();
    // Extract thought_id for brain gate — agents use this in brain_contribution_id
    const thoughtId = data.result?.sources?.[0]?.thought_id || data.result?.thought_id || data.result?.id || null;
    res.status(200).json({ type: 'BRAIN_RESULT', original_type: 'BRAIN_CONTRIBUTE', agent_id: agent.id, thought_id: thoughtId, result: data.result || data, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(502).json({ type: 'ERROR', error: `Brain proxy failed: ${err.message}` });
  }
}

function handleCapabilityActivate(agent: any, body: any, res: Response): void {
  const { capability_id, config_overrides } = body;
  if (!capability_id) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: capability_id' }); return; }

  const db = getDb();
  const cap = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(capability_id) as any;
  if (!cap) { res.status(404).json({ type: 'ERROR', error: `Capability not found: ${capability_id}` }); return; }

  if (cap.status === 'active') { res.status(409).json({ type: 'ERROR', error: 'Capability is already active' }); return; }

  // Check dependencies are all active
  let depIds: string[] = [];
  try { depIds = JSON.parse(cap.dependency_ids || '[]'); } catch { /* ignore */ }
  const inactiveDeps: string[] = [];
  for (const depId of depIds) {
    const dep = db.prepare('SELECT status FROM capabilities WHERE id = ?').get(depId) as any;
    if (!dep || dep.status !== 'active') inactiveDeps.push(depId);
  }
  if (inactiveDeps.length > 0) {
    res.status(409).json({ type: 'ERROR', error: `Dependencies not active: ${inactiveDeps.join(', ')}` });
    return;
  }

  // Merge config overrides
  let config: any = {};
  try { config = JSON.parse(cap.config || '{}'); } catch { /* ignore */ }
  if (config_overrides && typeof config_overrides === 'object') Object.assign(config, config_overrides);

  const now = new Date().toISOString();
  db.prepare("UPDATE capabilities SET status = 'active', config = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(config), now, cap.id);

  // Create/update feature flag
  try {
    const flagName = `cap-${cap.id}`;
    const existing = db.prepare('SELECT name FROM feature_flags WHERE name = ?').get(flagName);
    if (existing) {
      db.prepare("UPDATE feature_flags SET enabled = 1, updated_at = ? WHERE name = ?").run(now, flagName);
    } else {
      db.prepare("INSERT INTO feature_flags (name, enabled, created_at, updated_at) VALUES (?, 1, ?, ?)").run(flagName, now, now);
    }
  } catch { /* feature_flags table may differ */ }

  broadcast('capability_activated', { capability_id: cap.id, title: cap.title, actor: agent.name || agent.id, timestamp: now });
  res.status(200).json({ type: 'ACK', original_type: 'CAPABILITY_ACTIVATE', agent_id: agent.id, capability_id: cap.id, status: 'active', timestamp: now });
}

function handleCapabilityDeactivate(agent: any, body: any, res: Response): void {
  const { capability_id } = body;
  if (!capability_id) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: capability_id' }); return; }

  const db = getDb();
  const cap = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(capability_id) as any;
  if (!cap) { res.status(404).json({ type: 'ERROR', error: `Capability not found: ${capability_id}` }); return; }

  if (cap.status !== 'active') { res.status(409).json({ type: 'ERROR', error: 'Capability is not active' }); return; }

  // Check no other active caps depend on this one
  const dependents = db.prepare("SELECT id, title FROM capabilities WHERE status = 'active' AND dependency_ids LIKE ?").all(`%${cap.id}%`) as any[];
  if (dependents.length > 0) {
    res.status(409).json({ type: 'ERROR', error: `Cannot deactivate: active capabilities depend on this: ${dependents.map((d: any) => d.title).join(', ')}` });
    return;
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE capabilities SET status = 'draft', updated_at = ? WHERE id = ?").run(now, cap.id);

  // Disable feature flag
  try {
    db.prepare("UPDATE feature_flags SET enabled = 0, updated_at = ? WHERE name = ?").run(now, `cap-${cap.id}`);
  } catch { /* ignore */ }

  broadcast('capability_deactivated', { capability_id: cap.id, title: cap.title, actor: agent.name || agent.id, timestamp: now });
  res.status(200).json({ type: 'ACK', original_type: 'CAPABILITY_DEACTIVATE', agent_id: agent.id, capability_id: cap.id, status: 'draft', timestamp: now });
}

function handleCapabilityUpgrade(agent: any, body: any, res: Response): void {
  const { capability_id, to_version, migration_ref } = body;
  if (!capability_id) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: capability_id' }); return; }
  if (!to_version) { res.status(400).json({ type: 'ERROR', error: 'Missing required field: to_version' }); return; }

  const db = getDb();
  const cap = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(capability_id) as any;
  if (!cap) { res.status(404).json({ type: 'ERROR', error: `Capability not found: ${capability_id}` }); return; }

  const fromVersion = cap.version || '1.0.0';
  if (fromVersion === to_version) { res.status(200).json({ type: 'ACK', original_type: 'CAPABILITY_UPGRADE', agent_id: agent.id, capability_id: cap.id, no_change: true, version: fromVersion, timestamp: new Date().toISOString() }); return; }

  const now = new Date().toISOString();
  db.prepare("UPDATE capabilities SET version = ?, updated_at = ? WHERE id = ?").run(to_version, now, cap.id);

  // Record version history
  try {
    db.prepare("INSERT INTO capability_version_history (id, capability_id, from_version, to_version, migration_ref, upgraded_at, upgraded_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(crypto.randomUUID(), cap.id, fromVersion, to_version, migration_ref || null, now, agent.name || agent.id);
  } catch { /* table may not exist */ }

  broadcast('capability_upgraded', { capability_id: cap.id, from_version: fromVersion, to_version, actor: agent.name || agent.id, timestamp: now });
  res.status(200).json({ type: 'ACK', original_type: 'CAPABILITY_UPGRADE', agent_id: agent.id, capability_id: cap.id, from_version: fromVersion, to_version, timestamp: now });
}

function handleStub(_agent: any, body: any, res: Response): void {
  res.status(501).json({
    type: 'ERROR',
    error: `Message type ${body.type} is not yet implemented.`
  });
}

// === DECISION INTERFACE (Agent Experience) ===

async function handleDecisionRequest(agent: any, body: any, res: Response): Promise<void> {
  const { frame, options, task_ref, mission_ref, chain_parent_cid, human_prompt } = body;
  if (!frame || !Array.isArray(options) || options.length === 0) {
    res.status(400).json({ type: 'ERROR', error: 'frame and options[] are required' });
    return;
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const twin = createDecision({ id, frame, options, task_ref, mission_ref, chain_parent_cid, human_prompt, requesting_agent: agent.name || agent.id, project_slug: agent.project_slug, status: 'pending' });
  const validation = validateDecision(twin);
  if (!validation.valid) {
    res.status(400).json({ type: 'ERROR', error: validation.errors.join(', ') });
    return;
  }

  // Store pending transition if this was triggered by a gated TRANSITION
  const pending_transition = body.pending_transition ? JSON.stringify(body.pending_transition) : null;

  db.prepare(
    'INSERT INTO decisions (id, task_ref, mission_ref, frame, options, human_prompt, requesting_agent, chain_parent_cid, project_slug, status, pending_transition, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, task_ref || null, mission_ref || null, frame, JSON.stringify(options), human_prompt || null, agent.name || agent.id, chain_parent_cid || null, agent.project_slug || null, 'pending', pending_transition, now);

  const event = buildDecisionNeeded({ ...twin, id });
  sendToRole('liaison', EVENT_TYPES.DECISION_NEEDED, event, agent.project_slug);
  broadcast(EVENT_TYPES.DECISION_NEEDED, event);

  res.status(201).json({ type: 'ACK', original_type: 'DECISION_REQUEST', decision_id: id, timestamp: now });
}

async function handleDecisionResponse(agent: any, body: any, res: Response): Promise<void> {
  const { decision_id, choice, reasoning, human_prompt } = body;
  if (!decision_id || !choice) {
    res.status(400).json({ type: 'ERROR', error: 'decision_id and choice are required' });
    return;
  }

  const db = getDb();
  const decision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decision_id) as any;
  if (!decision) {
    res.status(404).json({ type: 'ERROR', error: 'Decision not found' });
    return;
  }
  if (decision.status !== 'pending') {
    res.status(409).json({ type: 'ERROR', error: `Decision already ${decision.status}` });
    return;
  }

  const now = new Date().toISOString();
  const resolved_by = agent.user_id || agent.name || agent.id;
  db.prepare(
    'UPDATE decisions SET choice = ?, reasoning = ?, human_prompt = ?, resolved_by = ?, resolved_at = ?, status = ? WHERE id = ?'
  ).run(choice, reasoning || null, human_prompt || null, resolved_by, now, 'resolved', decision_id);

  const event = buildDecisionResolved({ ...decision, choice, reasoning, resolved_by });
  broadcast(EVENT_TYPES.DECISION_RESOLVED, event);

  // If there's a pending transition, execute it now
  if (decision.pending_transition) {
    try {
      const pt = JSON.parse(decision.pending_transition);
      // Re-invoke transition handler with the original params + brain_contribution_id bypass
      // This is handled by the caller who receives the ACK and retries
    } catch { /* ignore parse errors */ }
  }

  res.status(200).json({ type: 'ACK', original_type: 'DECISION_RESPONSE', decision_id, choice, resolved_by, timestamp: now });
}

async function handleHumanInput(agent: any, body: any, res: Response): Promise<void> {
  const { text, target_agent_id } = body;
  if (!text) {
    res.status(400).json({ type: 'ERROR', error: 'text is required' });
    return;
  }

  // Broadcast human input — with user_id enforcement for targeted messages
  const event = { text, from: agent.name || agent.id, from_user_id: agent.user_id, timestamp: new Date().toISOString() };
  if (target_agent_id) {
    // Security: verify target agent belongs to same user
    const db = getDb();
    const target = db.prepare('SELECT user_id FROM agents WHERE id = ?').get(target_agent_id) as any;
    if (target && target.user_id && agent.user_id && target.user_id !== agent.user_id) {
      res.status(403).json({ type: 'ERROR', error: 'Cannot send to another user\'s agent' });
      return;
    }
    const { sendToAgent } = await import('../lib/sse-manager.js');
    sendToAgent(target_agent_id, EVENT_TYPES.HUMAN_INPUT, event);
  } else {
    broadcast(EVENT_TYPES.HUMAN_INPUT, event);
  }

  res.status(200).json({ type: 'ACK', original_type: 'HUMAN_INPUT', timestamp: new Date().toISOString() });
}

async function handleWorkspaceDock(_agent: any, body: any, res: Response): Promise<void> {
  // Stub — Phase 4 implementation
  const { git_urls, branch_state } = body;
  if (!git_urls || !Array.isArray(git_urls)) {
    res.status(400).json({ type: 'ERROR', error: 'git_urls[] is required' });
    return;
  }
  res.status(200).json({ type: 'ACK', original_type: 'WORKSPACE_DOCK', status: 'stub', message: 'Workspace dock handler — Phase 4 implementation pending', timestamp: new Date().toISOString() });
}

async function handleWorkspaceUndock(_agent: any, body: any, res: Response): Promise<void> {
  // Stub — Phase 4 implementation
  res.status(200).json({ type: 'ACK', original_type: 'WORKSPACE_UNDOCK', status: 'stub', message: 'Workspace undock handler — Phase 4 implementation pending', timestamp: new Date().toISOString() });
}

// === VERSION MANAGEMENT VIA TWINS ===

async function handleVersionTransition(agent: any, body: any, res: Response): Promise<void> {
  const { version, station } = body;
  if (!version) {
    res.status(400).json({ type: 'ERROR', error: 'version is required' });
    return;
  }

  const db = getDb();

  // Check if version twin exists
  const versionTwin = db.prepare('SELECT * FROM version_twins WHERE version = ?').get(version) as any;
  if (!versionTwin) {
    res.status(404).json({ type: 'ERROR', error: `Version twin not found: ${version}` });
    return;
  }

  if (versionTwin.requires_rebuild) {
    res.status(422).json({ type: 'ERROR', error: `Version ${version} requires Docker rebuild (requires_rebuild=true). Use deploy.js CLI instead.` });
    return;
  }

  // Update status
  const now = new Date().toISOString();
  db.prepare('UPDATE version_twins SET status = ?, applied_at = ?, applied_by = ? WHERE version = ?')
    .run('applied', now, agent.name || agent.id, version);

  // Broadcast version_upgraded event
  const { buildVersionUpgraded } = await import('../lib/event-types.js');
  const event = buildVersionUpgraded(version, station || 'unknown', versionTwin.parent_version);
  broadcast(EVENT_TYPES.VERSION_UPGRADED, event);

  res.status(200).json({
    type: 'ACK',
    original_type: 'VERSION_TRANSITION',
    version,
    station: station || 'unknown',
    applied_at: now,
    note: 'Version twin status updated. Use deploy.js CLI for actual symlink swap + restart.',
    timestamp: now,
  });
}
