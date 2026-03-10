# PDSA: ATTESTATION_REQUIRED Message Type in A2A Protocol

**Task:** t2-1-attestation-message
**Status:** Design
**Version:** v0.0.1

## Plan

Add ATTESTATION_REQUIRED and ATTESTATION_SUBMITTED message types to the A2A protocol. When an agent requests a gated transition, the server responds with ATTESTATION_REQUIRED (via SSE push) specifying what checks the agent must attest to. The agent submits attestation via ATTESTATION_SUBMITTED through the message router.

### Dependencies

- **ms-a11-5-a2a-message-router** (complete): A2A message router with type-based dispatch
- **t1-3-repos-bootstrap** (complete)

### Investigation

**Current state:**
- A2A message router at `api/routes/a2a-message.ts` has MESSAGE_HANDLERS map with HEARTBEAT, ROLE_SWITCH, DISCONNECT (implemented) and CLAIM_TASK, TRANSITION, RELEASE_TASK (stub 501)
- SSE manager at `api/lib/sse-manager.ts` has `sendToAgent(agentId, event, data)` for push messages
- No attestation table or logic exists yet

**Design decisions:**
- ATTESTATION_REQUIRED is a **server-to-agent push** via SSE (not a message handler — it's sent by the server when a transition triggers it)
- ATTESTATION_SUBMITTED is an **agent-to-server message** via the message router (new handler in MESSAGE_HANDLERS)
- Attestations are stored in a new `attestations` table for audit trail
- Each attestation references a task_id and transition (from_status → to_status)
- `rules_version` tracks which attestation rules were applied
- `required_checks` is a JSON array of check names the agent must complete
- `submitted_checks` is a JSON array of check results the agent submits
- Attestation states: `pending` (REQUIRED sent), `submitted` (agent responded), `accepted`, `rejected`

## Do

### File Changes

#### 1. `api/db/migrations/017-attestations.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS attestations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  required_checks TEXT NOT NULL,
  submitted_checks TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'submitted', 'accepted', 'rejected')),
  rejection_reason TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attestations_task ON attestations(task_id);
CREATE INDEX idx_attestations_agent ON attestations(agent_id);
CREATE INDEX idx_attestations_status ON attestations(status);
```

`required_checks` and `submitted_checks` are JSON arrays stored as TEXT.

#### 2. `api/routes/a2a-message.ts` (UPDATE)

Add ATTESTATION_SUBMITTED handler to MESSAGE_HANDLERS map:

```typescript
import { randomUUID } from 'node:crypto';

// Add to MESSAGE_HANDLERS map:
const MESSAGE_HANDLERS: Record<string, MessageHandler> = {
  HEARTBEAT: handleHeartbeat,
  ROLE_SWITCH: handleRoleSwitch,
  DISCONNECT: handleDisconnect,
  CLAIM_TASK: handleStub,
  TRANSITION: handleStub,
  RELEASE_TASK: handleStub,
  ATTESTATION_SUBMITTED: handleAttestationSubmitted,
};

// New handler function:
function handleAttestationSubmitted(agent: any, body: any, res: Response): void {
  const { attestation_id, submitted_checks } = body;

  if (!attestation_id) {
    res.status(400).json({ type: 'ERROR', error: 'Missing required field: attestation_id' });
    return;
  }

  if (!submitted_checks || !Array.isArray(submitted_checks)) {
    res.status(400).json({ type: 'ERROR', error: 'Missing or invalid submitted_checks (must be array)' });
    return;
  }

  const db = getDb();
  const attestation = db.prepare('SELECT * FROM attestations WHERE id = ?').get(attestation_id) as any;

  if (!attestation) {
    res.status(404).json({ type: 'ERROR', error: 'Attestation not found' });
    return;
  }

  if (attestation.agent_id !== agent.id) {
    res.status(403).json({ type: 'ERROR', error: 'Attestation belongs to a different agent' });
    return;
  }

  if (attestation.status !== 'pending') {
    res.status(409).json({ type: 'ERROR', error: `Attestation is already ${attestation.status}` });
    return;
  }

  // Validate all required checks are covered
  const requiredChecks = JSON.parse(attestation.required_checks) as string[];
  const submittedCheckNames = submitted_checks.map((c: any) => c.check_name);
  const missing = requiredChecks.filter(r => !submittedCheckNames.includes(r));

  if (missing.length > 0) {
    res.status(400).json({ type: 'ERROR', error: `Missing required checks: ${missing.join(', ')}` });
    return;
  }

  // Store submitted checks and update status
  db.prepare(
    "UPDATE attestations SET submitted_checks = ?, status = 'submitted', submitted_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(submitted_checks), attestation_id);

  res.status(200).json({
    type: 'ACK',
    original_type: 'ATTESTATION_SUBMITTED',
    attestation_id,
    agent_id: agent.id,
    status: 'submitted',
    timestamp: new Date().toISOString()
  });
}
```

#### 3. `api/lib/attestation.ts` (NEW)

Helper to create attestation and push ATTESTATION_REQUIRED via SSE:

```typescript
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { sendToAgent } from './sse-manager.js';

export interface AttestationRequest {
  taskId: string;
  projectSlug: string;
  agentId: string;
  fromStatus: string;
  toStatus: string;
  rulesVersion: string;
  requiredChecks: string[];
}

/**
 * Create a pending attestation record and push ATTESTATION_REQUIRED to agent via SSE.
 * Returns the attestation ID, or null if agent is not connected.
 */
export function requestAttestation(req: AttestationRequest): { id: string; pushed: boolean } {
  const db = getDb();
  const id = randomUUID();

  db.prepare(
    'INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, rules_version, required_checks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.taskId, req.projectSlug, req.agentId, req.fromStatus, req.toStatus, req.rulesVersion, JSON.stringify(req.requiredChecks));

  const pushed = sendToAgent(req.agentId, 'attestation_required', {
    type: 'ATTESTATION_REQUIRED',
    attestation_id: id,
    task_id: req.taskId,
    project_slug: req.projectSlug,
    from_status: req.fromStatus,
    to_status: req.toStatus,
    rules_version: req.rulesVersion,
    required_checks: req.requiredChecks,
    timestamp: new Date().toISOString()
  });

  return { id, pushed };
}

/**
 * Get attestation by ID.
 */
export function getAttestation(id: string): any {
  const db = getDb();
  return db.prepare('SELECT * FROM attestations WHERE id = ?').get(id);
}

/**
 * Resolve attestation (accept or reject).
 */
export function resolveAttestation(id: string, accepted: boolean, rejectionReason?: string): void {
  const db = getDb();
  const status = accepted ? 'accepted' : 'rejected';
  db.prepare(
    "UPDATE attestations SET status = ?, rejection_reason = ?, resolved_at = datetime('now') WHERE id = ?"
  ).run(status, rejectionReason || null, id);
}

/**
 * Get pending attestations for a task.
 */
export function getPendingAttestations(taskId: string): any[] {
  const db = getDb();
  return db.prepare("SELECT * FROM attestations WHERE task_id = ? AND status = 'pending'").all(taskId) as any[];
}
```

## Study

### Test Cases (16 total)

**ATTESTATION_SUBMITTED handler (7):**
1. Returns ACK with status:submitted for valid submission
2. Returns 400 when attestation_id missing
3. Returns 400 when submitted_checks missing or not array
4. Returns 404 for non-existent attestation_id
5. Returns 403 when agent_id doesn't match attestation owner
6. Returns 409 when attestation is not pending (already submitted/accepted/rejected)
7. Returns 400 when submitted_checks doesn't cover all required_checks

**requestAttestation helper (4):**
8. Creates attestation record in DB with status:pending
9. Pushes ATTESTATION_REQUIRED via SSE to connected agent
10. Returns pushed:false when agent not connected (record still created)
11. ATTESTATION_REQUIRED payload includes all required fields

**resolveAttestation helper (3):**
12. Sets status to accepted when accepted=true
13. Sets status to rejected with rejection_reason when accepted=false
14. Sets resolved_at timestamp

**Migration (2):**
15. attestations table created with correct schema
16. Indexes exist on task_id, agent_id, status

## Act

### Deployment

- Migration 017 creates attestations table
- 3 files: 017-attestations.sql (NEW), attestation.ts (NEW), a2a-message.ts (UPDATE)
- ATTESTATION_REQUIRED is SSE push (server→agent), ATTESTATION_SUBMITTED is HTTP message (agent→server)
- Future task t2-2-rules-engine will validate submitted checks; this task only stores them
