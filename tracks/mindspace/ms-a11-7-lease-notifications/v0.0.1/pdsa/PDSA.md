# PDSA: LEASE_WARNING + LEASE_EXPIRED Notifications

**Task:** ms-a11-7-lease-notifications
**Version:** v0.0.1
**Status:** Design
**Depends on:** ms-a11-3-sse-infra (complete), ms-a3-5-lease-expiry (complete)

## Plan

Enhance the lease expiry checker to send SSE notifications before and on lease expiry. Agents receive a warning 30 minutes before their lease expires, giving them time to heartbeat/renew. On actual expiry, they receive a notification that the task was released.

### Current State

- `lease-expiry.ts` runs `checkExpiredLeases()` every 60s
- On expiry: sets lease `status='expired'`, unclaims task
- No notification to the agent — they discover task was released on next API call
- `sse-manager.ts` provides `sendToAgent(agentId, eventType, data)` for SSE delivery

### Design (1 file change)

#### Enhanced lease-expiry.ts

**1. LEASE_WARNING (30 min before expiry)**

Add a new check in the 60s interval loop:

```ts
// Find active leases expiring within 30 minutes (but not yet expired)
const warningLeases = db.prepare(
  "SELECT l.*, t.claimed_by FROM leases l JOIN tasks t ON l.task_id = t.id WHERE l.status = 'active' AND l.expires_at BETWEEN datetime('now') AND datetime('now', '+30 minutes') AND l.warning_sent = 0"
).all();
```

For each warning lease:
- Send SSE: `sendToAgent(claimed_by, 'lease', { type: 'LEASE_WARNING', lease_id, task_id, expires_at, minutes_remaining })`
- Set `warning_sent = 1` to avoid duplicate warnings

**2. LEASE_EXPIRED (on actual expiry)**

Enhance existing expiry logic to also send SSE before unclaiming:

```ts
// Before unclaiming, capture claimed_by for notification
const task = db.prepare('SELECT claimed_by FROM tasks WHERE id = ?').get(lease.task_id);
// ... existing unclaim logic ...
sendToAgent(task.claimed_by, 'lease', { type: 'LEASE_EXPIRED', lease_id, task_id });
```

### Migration

```sql
ALTER TABLE leases ADD COLUMN warning_sent INTEGER NOT NULL DEFAULT 0;
```

Prevents duplicate LEASE_WARNING sends. Reset to 0 on lease renewal (heartbeat).

### Files to Create/Change

1. `api/services/lease-expiry.ts` — UPDATE: add warning check + SSE sends
2. `api/services/lease-service.ts` — UPDATE: reset `warning_sent=0` on `renewLease()`
3. `api/db/migrations/031-lease-warning-sent.sql` — CREATE: add warning_sent column

### SSE Event Payloads

**LEASE_WARNING:**
```json
{
  "type": "LEASE_WARNING",
  "lease_id": "...",
  "task_id": "...",
  "expires_at": "2026-03-11T18:00:00Z",
  "minutes_remaining": 28
}
```

**LEASE_EXPIRED:**
```json
{
  "type": "LEASE_EXPIRED",
  "lease_id": "...",
  "task_id": "...",
  "expired_at": "2026-03-11T18:00:00Z"
}
```

### Tests (QA writes)

- LEASE_WARNING sent when lease expires within 30 min
- LEASE_WARNING not sent twice (warning_sent flag)
- LEASE_WARNING warning_sent reset on heartbeat/renewal
- LEASE_EXPIRED sent on actual expiry
- LEASE_EXPIRED sent before task unclaim (agent still has claimed_by)

## Do

Implementation by DEV agent.

## Study

- Verify warning sent exactly once per lease period
- Verify renewal resets warning flag
- Verify expired notification reaches correct agent

## Act

Integrate with agent monitoring — agents can auto-heartbeat on warning.
