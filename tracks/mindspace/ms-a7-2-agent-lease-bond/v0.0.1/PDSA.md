# PDSA: Agent lease bond creation

**Task:** ms-a7-2-agent-lease-bond
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Agents register and heartbeat, but there's no formal "session bond" — a lease that tracks the agent's session lifetime. Without a bond, there's no mechanism to detect expired sessions systematically, and no audit trail of agent sessions. The bond gives agents a renewable lease tied to their registration session, separate from task leases (which track task claims).

## Requirements (AC from task DNA)

1. On registration: create agent bond (session lease)
2. Bond expiry configurable
3. Agent must heartbeat to keep bond alive
4. Bond expires without heartbeat

## Investigation

### Existing agents table

The agents table has `session_id`, `connected_at`, `last_seen`, and `status` fields. The status sweep (ms-a7-3) transitions agents based on `last_seen`. However, there's no explicit lease/bond record — the sweep uses implicit thresholds.

### Bond vs status sweep

The status sweep (ms-a7-3) handles status transitions based on time thresholds. The bond is a complementary concept:
- **Status sweep** = background job that updates status periodically
- **Bond** = explicit lease record with expiry time, renewed on heartbeat

The bond provides: (1) explicit expiry timestamps (not just thresholds), (2) audit trail of renewals, (3) a record that can be queried by other services, (4) clear contract: "this agent is valid until X time."

### Design approach

A new `agent_bonds` table stores one active bond per agent. On registration, a bond is created. On heartbeat, the bond is renewed (expiry extended). On disconnect/expiry, the bond is marked expired. The bond expiry duration is configurable via env.

## Design

### File 1: `api/db/migrations/010-agent-bonds.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS agent_bonds (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  renewed_at TEXT,
  expired_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  renewal_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_bonds_agent ON agent_bonds(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_bonds_status ON agent_bonds(status);
CREATE INDEX IF NOT EXISTS idx_agent_bonds_expires ON agent_bonds(expires_at);
```

### File 2: `api/services/agent-bond.ts` (NEW)

```typescript
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

const BOND_DURATION_MINUTES = parseInt(process.env.AGENT_BOND_DURATION_MINUTES || '60', 10);

export function createBond(agentId: string, sessionId: string): { id: string; expires_at: string } {
  const db = getDb();

  // Expire any existing active bonds for this agent
  db.prepare(
    "UPDATE agent_bonds SET status = 'expired', expired_at = datetime('now') WHERE agent_id = ? AND status = 'active'"
  ).run(agentId);

  const id = randomUUID();
  const expiresAt = db.prepare(
    `SELECT datetime('now', '+${BOND_DURATION_MINUTES} minutes') as t`
  ).get() as any;

  db.prepare(
    'INSERT INTO agent_bonds (id, agent_id, session_id, expires_at) VALUES (?, ?, ?, ?)'
  ).run(id, agentId, sessionId, expiresAt.t);

  return { id, expires_at: expiresAt.t };
}

export function renewBond(agentId: string): { renewed: boolean; expires_at: string | null } {
  const db = getDb();

  const bond = db.prepare(
    "SELECT id FROM agent_bonds WHERE agent_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(agentId) as any;

  if (!bond) {
    return { renewed: false, expires_at: null };
  }

  const expiresAt = db.prepare(
    `SELECT datetime('now', '+${BOND_DURATION_MINUTES} minutes') as t`
  ).get() as any;

  db.prepare(
    "UPDATE agent_bonds SET expires_at = ?, renewed_at = datetime('now'), renewal_count = renewal_count + 1 WHERE id = ?"
  ).run(expiresAt.t, bond.id);

  return { renewed: true, expires_at: expiresAt.t };
}

export function expireBond(agentId: string): { expired: boolean } {
  const db = getDb();

  const result = db.prepare(
    "UPDATE agent_bonds SET status = 'expired', expired_at = datetime('now') WHERE agent_id = ? AND status = 'active'"
  ).run(agentId);

  return { expired: result.changes > 0 };
}

export function getActiveBond(agentId: string): any | null {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM agent_bonds WHERE agent_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(agentId) || null;
}

export function sweepExpiredBonds(): number {
  const db = getDb();
  const result = db.prepare(
    "UPDATE agent_bonds SET status = 'expired', expired_at = datetime('now') WHERE status = 'active' AND expires_at < datetime('now')"
  ).run();
  return result.changes;
}
```

### File 3: `api/routes/agents.ts` (UPDATE)

Integrate bond creation into registration and heartbeat:

**In POST /register handler, after inserting/updating agent:**
```typescript
import { createBond, renewBond } from '../services/agent-bond.js';

// After successful registration (new or re-registration):
const bond = createBond(agentId, agentSessionId);
// Include in response:
res.status(201).json({ agent_id: id, ...agent, bond_id: bond.id, bond_expires_at: bond.expires_at });
```

**In POST /:id/heartbeat handler (from ms-a7-3), after updating last_seen:**
```typescript
// After successful heartbeat:
const bondResult = renewBond(id);
// Include in response:
res.status(200).json({ ok: true, last_seen: new Date().toISOString(), bond_renewed: bondResult.renewed, bond_expires_at: bondResult.expires_at });
```

### File 4: `api/services/agent-status-sweep.ts` (UPDATE)

Add bond sweep call to the existing status sweep (from ms-a7-3):

```typescript
import { sweepExpiredBonds } from './agent-bond.js';

// In runAgentStatusSweep(), after status transitions:
const expiredBonds = sweepExpiredBonds();
return { idled: idled.changes, disconnected: disconnected.changes, expiredBonds };
```

## Files Changed

1. `api/db/migrations/010-agent-bonds.sql` — Bond table schema (NEW)
2. `api/services/agent-bond.ts` — Bond CRUD + sweep functions (NEW)
3. `api/routes/agents.ts` — Integrate bond into registration + heartbeat (UPDATE)
4. `api/services/agent-status-sweep.ts` — Add bond sweep to status sweep (UPDATE)

## Testing

1. `createBond()` creates a bond record with correct agent_id and session_id
2. `createBond()` sets expires_at to now + BOND_DURATION_MINUTES
3. `createBond()` expires any existing active bonds for the agent
4. `renewBond()` extends expires_at by BOND_DURATION_MINUTES from now
5. `renewBond()` increments renewal_count
6. `renewBond()` returns `renewed: false` when no active bond exists
7. `expireBond()` marks active bond as expired with expired_at timestamp
8. `expireBond()` returns `expired: false` when no active bond exists
9. `getActiveBond()` returns active bond for agent
10. `getActiveBond()` returns null when no active bond exists
11. `sweepExpiredBonds()` expires bonds past their expires_at
12. `sweepExpiredBonds()` does not affect non-expired bonds
13. Registration response includes bond_id and bond_expires_at
14. Heartbeat response includes bond_renewed and bond_expires_at
15. Re-registration expires old bond, creates new one
16. Bond duration respects AGENT_BOND_DURATION_MINUTES env var
