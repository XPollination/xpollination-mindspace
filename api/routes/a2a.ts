/**
 * A2A Server Routes — 8 endpoints + SSE
 * REQ-A2A-005: LLM-less agent-to-agent coordination server
 *
 * Endpoints: checkin, claim, submit, review, create, evolve, events (SSE), health
 * Auth: Bearer token (SpiceDB validated)
 * SSE: Server-Sent Events for real-time agent notifications
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Active SSE connections for event broadcasting
const sseClients: Map<string, Response> = new Map();

// Lease tracking: agent_id -> { task_slug, claimed_at, last_heartbeat }
const leases: Map<string, { task_slug: string; claimed_at: Date; last_heartbeat: Date }> = new Map();

// Lease timeout: 30 minutes, heartbeat required every 10 minutes
const LEASE_TIMEOUT_MS = 30 * 60 * 1000;
const HEARTBEAT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * POST /a2a/checkin — Agent announces presence and capabilities
 */
router.post('/checkin', async (req: Request, res: Response) => {
  const { agent_id, agent_name, capabilities } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id required' });

  // Update agent presence, extend lease if active
  const lease = leases.get(agent_id);
  if (lease) {
    lease.last_heartbeat = new Date();
  }

  broadcastEvent('agent_checkin', { agent_id, agent_name, capabilities });
  res.json({ status: 'ok', agent_id, timestamp: new Date().toISOString() });
});

/**
 * POST /a2a/claim — Agent claims a task (creates lease)
 */
router.post('/claim', async (req: Request, res: Response) => {
  const { agent_id, task_slug } = req.body;
  if (!agent_id || !task_slug) return res.status(400).json({ error: 'agent_id and task_slug required' });

  leases.set(agent_id, { task_slug, claimed_at: new Date(), last_heartbeat: new Date() });
  broadcastEvent('task_claimed', { agent_id, task_slug });
  res.json({ status: 'claimed', agent_id, task_slug, lease_expires: new Date(Date.now() + LEASE_TIMEOUT_MS).toISOString() });
});

/**
 * POST /a2a/submit — Agent submits work (twin + diff)
 */
router.post('/submit', async (req: Request, res: Response) => {
  const { agent_id, task_slug, twin, diff } = req.body;
  if (!agent_id || !task_slug) return res.status(400).json({ error: 'agent_id and task_slug required' });

  // Release lease on submission
  leases.delete(agent_id);
  broadcastEvent('task_submitted', { agent_id, task_slug });
  res.json({ status: 'submitted', agent_id, task_slug });
});

/**
 * POST /a2a/review — Agent submits review of another agent's work
 */
router.post('/review', async (req: Request, res: Response) => {
  const { agent_id, task_slug, verdict, comments } = req.body;
  broadcastEvent('task_reviewed', { agent_id, task_slug, verdict });
  res.json({ status: 'reviewed', task_slug, verdict });
});

/**
 * POST /a2a/create — Agent creates a new object via twin protocol
 */
router.post('/create', async (req: Request, res: Response) => {
  const { agent_id, twin } = req.body;
  if (!twin || !twin._type) return res.status(400).json({ error: 'twin with _type required' });

  broadcastEvent('object_created', { agent_id, type: twin._type, id: twin.id || twin.slug });
  res.json({ status: 'created', type: twin._type });
});

/**
 * POST /a2a/evolve — Agent triggers service evolution (EVOLVE event)
 */
router.post('/evolve', async (req: Request, res: Response) => {
  const { agent_id, service_name, new_version } = req.body;
  broadcastEvent('service_evolve', { agent_id, service_name, new_version });
  res.json({ status: 'evolve_initiated', service_name, new_version });
});

/**
 * GET /a2a/events — SSE stream for real-time agent notifications
 * Event types: agent_checkin, task_claimed, task_submitted, task_reviewed, object_created
 */
router.get('/events', (req: Request, res: Response) => {
  const agentId = (req.query.agent_id as string) || 'anonymous';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', agent_id: agentId })}\n\n`);

  sseClients.set(agentId, res);

  // Keepalive: send ping every 30s to prevent connection timeout
  const keepalive = setInterval(() => {
    res.write(`: keepalive ${new Date().toISOString()}\n\n`);
  }, 30 * 1000);

  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.delete(agentId);
  });
});

/**
 * GET /a2a/health — A2A server health check
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    active_connections: sseClients.size,
    active_leases: leases.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Broadcast SSE event to all connected agents
 */
function broadcastEvent(type: string, data: Record<string, unknown>) {
  const event = JSON.stringify({ type, ...data, timestamp: new Date().toISOString() });
  for (const [, client] of sseClients) {
    client.write(`event: ${type}\ndata: ${event}\n\n`);
  }
}

/**
 * Lease cleanup: check for expired leases and heartbeat timeouts
 */
setInterval(() => {
  const now = Date.now();
  for (const [agentId, lease] of leases) {
    const leaseAge = now - lease.claimed_at.getTime();
    const heartbeatAge = now - lease.last_heartbeat.getTime();

    if (leaseAge > LEASE_TIMEOUT_MS || heartbeatAge > HEARTBEAT_TIMEOUT_MS) {
      leases.delete(agentId);
      broadcastEvent('lease_expired', { agent_id: agentId, task_slug: lease.task_slug });
    }
  }
}, 60 * 1000);

export { router as a2aRouter };
