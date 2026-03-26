import { Response } from 'express';

interface SseConnection {
  res: Response;
  agentId: string;
  role: string | null;
  projectSlug: string | null;
  connectedAt: Date;
  heartbeatInterval: NodeJS.Timeout;
}

// Active connections indexed by agent_id
const connections = new Map<string, SseConnection>();

/**
 * Register an SSE connection for an agent.
 * Replaces any existing connection for the same agent_id (only one stream per agent).
 */
export function addConnection(agentId: string, res: Response, role?: string, projectSlug?: string): void {
  // Close existing connection if any (agent reconnected)
  removeConnection(agentId);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ agent_id: agentId, timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat every 30s (SSE comment to keep connection alive)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    } catch {
      removeConnection(agentId);
    }
  }, 30_000);

  connections.set(agentId, {
    res,
    agentId,
    role: role || null,
    projectSlug: projectSlug || null,
    connectedAt: new Date(),
    heartbeatInterval
  });
}

/**
 * Remove and clean up an SSE connection.
 */
export function removeConnection(agentId: string): void {
  const conn = connections.get(agentId);
  if (conn) {
    clearInterval(conn.heartbeatInterval);
    try { conn.res.end(); } catch { /* already closed */ }
    connections.delete(agentId);
  }
}

/**
 * Send a message to a specific agent via SSE.
 * Returns true if the agent is connected and message was sent.
 */
export function sendToAgent(agentId: string, event: string, data: unknown): boolean {
  const conn = connections.get(agentId);
  if (!conn) return false;

  try {
    conn.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    removeConnection(agentId);
    return false;
  }
}

/**
 * Broadcast a message to all connected agents.
 * Returns number of agents that received the message.
 */
export function broadcast(event: string, data: unknown): number {
  let sent = 0;
  for (const [agentId] of connections) {
    if (sendToAgent(agentId, event, data)) sent++;
  }
  return sent;
}

/**
 * Send a message to all connected agents with a specific role (and optionally project).
 * Returns number of agents that received the message.
 */
export function sendToRole(role: string, event: string, data: unknown, projectSlug?: string): number {
  let sent = 0;
  for (const [agentId, conn] of connections) {
    if (conn.role === role) {
      if (projectSlug && conn.projectSlug && conn.projectSlug !== projectSlug) continue;
      if (sendToAgent(agentId, event, data)) sent++;
    }
  }
  return sent;
}

/**
 * Get list of currently connected agent IDs.
 */
export function getConnectedAgents(): string[] {
  return Array.from(connections.keys());
}

/**
 * Get connection count.
 */
export function getConnectionCount(): number {
  return connections.size;
}
