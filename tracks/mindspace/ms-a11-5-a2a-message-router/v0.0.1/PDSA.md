# PDSA: A2A Message Router

**Task:** ms-a11-5-a2a-message-router
**Status:** Design
**Version:** v0.0.1

## Plan

Design a unified message router for the A2A protocol. After an agent connects via `/a2a/connect` (WELCOME), all subsequent communication flows through `POST /a2a/message`. The router validates the agent, identifies the message type, and dispatches to the appropriate handler.

### Problem

Currently, agents interact with separate REST endpoints for each action (heartbeat, role-switch, status change). The A2A protocol needs a unified message-passing interface where agents send typed messages through a single endpoint, and the server routes them to internal handlers.

### Dependencies

- **ms-a11-4-a2a-connect** (complete): Provides agent registration and session establishment
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**Existing infrastructure:**
- `POST /a2a/connect` — returns WELCOME with agent_id, session_id, endpoints
- `GET /a2a/stream/:agent_id` — SSE for server→agent push messages
- `POST /api/agents/:id/heartbeat` — updates last_seen, reactivates idle
- `PATCH /api/agents/:id/status` — manual status change (disconnect)
- `POST /api/agents/:id/role-switch` — switch agent role
- `sendToAgent()` / `broadcast()` in sse-manager.ts for push notifications
- No task/lease tables yet (ms-a3-x tasks pending)

**Message types from DNA:**
1. **CLAIM_TASK** — agent claims a task (requires task tables, not yet available)
2. **HEARTBEAT** — keep-alive, updates last_seen
3. **TRANSITION** — agent requests task state transition (requires task tables)
4. **RELEASE_TASK** — agent releases a claimed task (requires task tables)
5. **ROLE_SWITCH** — agent switches to different role
6. **DISCONNECT** — graceful disconnect

**Design decision: stub vs defer task-dependent types**
CLAIM_TASK, TRANSITION, and RELEASE_TASK depend on task tables (ms-a3-x group, all pending). The router will register these types but return a clear error indicating the feature is not yet available. This way the router is complete in terms of type handling, and future tasks only need to implement the handler internals.

## Do

### Architecture

```
POST /a2a/message
  ├── Validate agent_id (from body, must exist and be active)
  ├── Parse type field
  └── Dispatch to handler
       ├── HEARTBEAT     → update last_seen, renew bond, return ACK
       ├── ROLE_SWITCH    → validate & switch role, return ACK
       ├── DISCONNECT     → set disconnected, expire bond, return ACK
       ├── CLAIM_TASK     → [stub] return NOT_IMPLEMENTED
       ├── TRANSITION     → [stub] return NOT_IMPLEMENTED
       └── RELEASE_TASK   → [stub] return NOT_IMPLEMENTED
```

### File Changes

#### 1. `api/routes/a2a-message.ts` (NEW)

Single file containing the message router.

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { renewBond, expireBond, getActiveBond } from './agent-bond.js';

export const a2aMessageRouter = Router();

// Message type → handler map
const MESSAGE_HANDLERS: Record<string, (agent: any, payload: any, res: Response) => void> = {
  HEARTBEAT: handleHeartbeat,
  ROLE_SWITCH: handleRoleSwitch,
  DISCONNECT: handleDisconnect,
  CLAIM_TASK: handleNotImplemented,
  TRANSITION: handleNotImplemented,
  RELEASE_TASK: handleNotImplemented,
};

const VALID_TYPES = Object.keys(MESSAGE_HANDLERS);

// POST /a2a/message
a2aMessageRouter.post('/', (req: Request, res: Response) => {
  const { agent_id, type, ...payload } = req.body;

  // 1. Validate required fields
  if (!agent_id) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: agent_id' });
    return;
  }
  if (!type) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: type' });
    return;
  }

  // 2. Validate message type
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({
      type: 'ERROR',
      error: `Unknown message type '${type}'. Valid types: ${VALID_TYPES.join(', ')}`
    });
    return;
  }

  // 3. Validate agent exists and is active
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent_id) as any;

  if (!agent) {
    res.status(404).json({ type: 'ERROR', error: 'Agent not found' });
    return;
  }
  if (agent.status === 'disconnected') {
    res.status(409).json({ type: 'ERROR', error: 'Agent is disconnected. Must re-connect via /a2a/connect' });
    return;
  }

  // 4. Dispatch to handler
  MESSAGE_HANDLERS[type](agent, payload, res);
});
```

**Handler implementations:**

```typescript
// HEARTBEAT — update last_seen, renew bond
function handleHeartbeat(agent: any, _payload: any, res: Response): void {
  const db = getDb();
  const newStatus = agent.status === 'idle' ? 'active' : agent.status;
  db.prepare("UPDATE agents SET last_seen = datetime('now'), status = ? WHERE id = ?")
    .run(newStatus, agent.id);

  renewBond(agent.id);

  res.status(200).json({
    type: 'ACK',
    original_type: 'HEARTBEAT',
    agent_id: agent.id,
    status: newStatus,
    timestamp: new Date().toISOString()
  });
}
```

```typescript
// ROLE_SWITCH — validate and switch role
const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];

function handleRoleSwitch(agent: any, payload: any, res: Response): void {
  const { to_role, from_role, reason } = payload;

  if (!to_role) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: to_role' });
    return;
  }
  if (!VALID_ROLES.includes(to_role)) {
    res.status(400).json({
      type: 'ERROR',
      error: `Invalid to_role '${to_role}'. Must be one of: ${VALID_ROLES.join(', ')}`
    });
    return;
  }

  // Safety check: from_role mismatch
  if (from_role && agent.current_role !== from_role) {
    res.status(409).json({
      type: 'ERROR',
      error: `Role mismatch: agent current_role is '${agent.current_role}', expected '${from_role}'`
    });
    return;
  }

  // Capabilities check
  const capabilities = agent.capabilities ? JSON.parse(agent.capabilities) : [];
  if (capabilities.length > 0 && !capabilities.includes(to_role)) {
    res.status(403).json({
      type: 'ERROR',
      error: `Role '${to_role}' is not in agent capabilities: [${capabilities.join(', ')}]`
    });
    return;
  }

  const previous_role = agent.current_role;
  const db = getDb();
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
```

```typescript
// DISCONNECT — graceful disconnect, expire bond
function handleDisconnect(agent: any, payload: any, res: Response): void {
  const db = getDb();
  db.prepare(
    "UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now'), last_seen = datetime('now') WHERE id = ?"
  ).run(agent.id);

  // Expire active bond
  const bond = getActiveBond(agent.id);
  if (bond) {
    expireBond(bond.id);
  }

  res.status(200).json({
    type: 'ACK',
    original_type: 'DISCONNECT',
    agent_id: agent.id,
    previous_status: agent.status,
    status: 'disconnected',
    reason: payload.reason || null,
    timestamp: new Date().toISOString()
  });
}
```

```typescript
// NOT_IMPLEMENTED — stub for task-dependent message types
function handleNotImplemented(_agent: any, _payload: any, res: Response): void {
  res.status(501).json({
    type: 'ERROR',
    error: 'This message type is not yet implemented. Task management tables are pending (ms-a3-x group).'
  });
}
```

#### 2. `api/server.ts` (UPDATE)

Add the message router mount:

```typescript
// Add import
import { a2aMessageRouter } from './routes/a2a-message.js';

// Add mount (after /a2a/connect)
app.use('/a2a/message', a2aMessageRouter);
```

### Response Format

All responses follow A2A message format:

| Response Type | Meaning |
|--------------|---------|
| `ACK` | Success — includes `original_type` to identify which message was acknowledged |
| `ERROR` | Failure — includes `error` string with details |

### Error Codes

| HTTP | Condition |
|------|-----------|
| 400 | Missing agent_id, type, or invalid type/payload |
| 403 | Role not in capabilities (ROLE_SWITCH) |
| 404 | Agent not found |
| 409 | Agent disconnected, or role mismatch (ROLE_SWITCH) |
| 501 | Message type not yet implemented (CLAIM_TASK, TRANSITION, RELEASE_TASK) |

## Study

### Test Cases (18 total)

**Router validation (5):**
1. Returns ERROR 400 when agent_id missing
2. Returns ERROR 400 when type missing
3. Returns ERROR 400 for unknown message type — includes valid types in error
4. Returns ERROR 404 when agent_id not found
5. Returns ERROR 409 when agent is disconnected

**HEARTBEAT handler (4):**
6. Returns ACK with original_type HEARTBEAT and status
7. Updates last_seen in database
8. Reactivates idle agent to active status
9. Renews active bond on heartbeat

**ROLE_SWITCH handler (5):**
10. Returns ACK with previous_role and current_role
11. Returns ERROR 400 when to_role missing
12. Returns ERROR 400 for invalid to_role
13. Returns ERROR 409 when from_role doesn't match current_role
14. Returns ERROR 403 when to_role not in capabilities

**DISCONNECT handler (2):**
15. Returns ACK with status disconnected
16. Expires active bond on disconnect

**Stub handlers (2):**
17. CLAIM_TASK returns ERROR 501 not implemented
18. TRANSITION returns ERROR 501 not implemented

## Act

### Deployment

- Mount at `/a2a/message` in server.ts
- No new tables required — uses existing agents and agent_bonds tables
- No new dependencies
- Future tasks (ms-a3-x group) will replace stub handlers with real implementations

### Future Evolution

When task tables are created (ms-a3-1-tasks-crud, ms-a3-2-state-machine, ms-a3-3-task-claiming):
1. Replace `handleNotImplemented` for CLAIM_TASK with actual claim logic
2. Replace for TRANSITION with state machine transition
3. Replace for RELEASE_TASK with voluntary release
4. Add RELEASE_TASK to test cases at that time
