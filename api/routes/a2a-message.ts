import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { renewBond, getActiveBond, expireBond } from './agent-bond.js';

export const a2aMessageRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];

type MessageHandler = (agent: any, body: any, res: Response) => void;

const MESSAGE_HANDLERS: Record<string, MessageHandler> = {
  HEARTBEAT: handleHeartbeat,
  ROLE_SWITCH: handleRoleSwitch,
  DISCONNECT: handleDisconnect,
  CLAIM_TASK: handleStub,
  TRANSITION: handleStub,
  RELEASE_TASK: handleStub,
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

function handleStub(_agent: any, body: any, res: Response): void {
  res.status(501).json({
    type: 'ERROR',
    error: `Message type ${body.type} is not yet implemented. Pending task tables.`
  });
}
