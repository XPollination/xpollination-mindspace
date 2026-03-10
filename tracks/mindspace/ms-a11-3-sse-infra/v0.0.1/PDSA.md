# PDSA: SSE stream infrastructure

**Task:** ms-a11-3-sse-infra
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10
**Requirement:** REQ-A2A-001

## Problem

The A2A protocol needs server-to-agent push notifications. Agents open an SSE (Server-Sent Events) connection and receive messages like TASK_AVAILABLE, LEASE_WARNING, APPROVAL notifications. This task builds the SSE plumbing — the transport layer that other tasks (A11.4–A11.7) will use to send specific message types.

### Acceptance Criteria (from DNA)

1. SSE stream opens at `/a2a/stream/:agent_id`
2. Receives messages pushed by server
3. Connection cleanup on disconnect
4. Heartbeat ping every 30s

## Design

### Change A: SSE connection manager — `api/lib/sse-manager.ts`

```typescript
import { Response } from 'express';

interface SseConnection {
  res: Response;
  agentId: string;
  connectedAt: Date;
  heartbeatInterval: NodeJS.Timeout;
}

// Active connections indexed by agent_id
const connections = new Map<string, SseConnection>();

/**
 * Register an SSE connection for an agent.
 * Replaces any existing connection for the same agent_id (only one stream per agent).
 */
export function addConnection(agentId: string, res: Response): void {
  // Close existing connection if any (agent reconnected)
  removeConnection(agentId);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // nginx: disable buffering
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
```

**Design decisions:**
- **One connection per agent** — if an agent reconnects, the old connection is replaced. This prevents connection leaks from agents that crash without closing cleanly.
- **SSE comment heartbeat** — `: heartbeat` is an SSE comment (starts with `:`). Clients ignore it, but it keeps the TCP connection alive through proxies/load balancers.
- **`X-Accel-Buffering: no`** — tells nginx to disable response buffering for this connection (aligns with ms-a0-3-nginx-proxy's `proxy_buffering off`).
- **`sendToAgent` returns boolean** — callers can check if delivery succeeded. Failed sends auto-cleanup the dead connection.
- **`broadcast` helper** — for TASK_AVAILABLE notifications that go to all agents of a role (A11.6 will filter by role, but the broadcast primitive is here).
- **No auth in this layer** — auth is handled by the A2A connect endpoint (A11.4). The SSE manager only manages connections.

### Change B: SSE stream route — `api/routes/a2a-stream.ts`

```typescript
import { Router } from 'express';
import { addConnection, removeConnection } from '../lib/sse-manager.js';

const a2aStreamRouter = Router();

// SSE stream endpoint — agents connect here to receive push messages
a2aStreamRouter.get('/:agent_id', (req, res) => {
  const { agent_id } = req.params;

  // Register SSE connection
  addConnection(agent_id, res);

  // Clean up on client disconnect
  req.on('close', () => {
    removeConnection(agent_id);
  });

  // Prevent Express from closing the response
  req.on('error', () => {
    removeConnection(agent_id);
  });
});

export { a2aStreamRouter };
```

### Change C: Wire into server — `api/server.ts`

```typescript
import { a2aStreamRouter } from './routes/a2a-stream.js';

// A2A SSE stream (before error handlers, no auth for now — A11.4 adds auth)
app.use('/a2a/stream', a2aStreamRouter);
```

### Change D: Connection status in health check

Update `api/routes/health.ts` to include SSE connection count:

```typescript
import { getConnectionCount } from '../lib/sse-manager.js';

// In health handler:
res.json({
  // ... existing fields ...
  sse_connections: getConnectionCount()
});
```

### Files Changed

1. `api/lib/sse-manager.ts` — **new** — connection manager with addConnection, removeConnection, sendToAgent, broadcast
2. `api/routes/a2a-stream.ts` — **new** — SSE endpoint at `/a2a/stream/:agent_id`
3. `api/server.ts` — **modified** — register a2aStreamRouter
4. `api/routes/health.ts` — **modified** — add SSE connection count

### Testing

1. `GET /a2a/stream/test-agent` returns 200 with `Content-Type: text/event-stream`
2. Connection receives `event: connected` immediately on open
3. Connection receives `: heartbeat` comment every 30s
4. `sendToAgent('test-agent', 'task_available', {id: '123'})` delivers message to connected client
5. Client disconnect triggers cleanup (connection removed from manager)
6. Reconnecting agent replaces previous connection (no duplicate connections)
7. `broadcast('ping', {})` sends to all connected agents
8. `getConnectedAgents()` returns array of connected agent IDs
9. `/health` response includes `sse_connections` count
10. Dead connections (write fails) are auto-cleaned
11. `sendToAgent` returns `false` for disconnected agents
12. SSE message format: `event: <type>\ndata: <json>\n\n`
