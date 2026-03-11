# PDSA: Lease Expiry Checker (Cron/Interval)

**Date:** 2026-03-11
**Task:** ms-a3-5-lease-expiry
**Capability:** lease-management
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a3-4-lease-creation (leases table + createLease service)

## Plan

### Problem

When an agent claims a task, a lease is created with an `expires_at` timestamp (role-based: PDSA=4h, DEV=6h, QA=3h, LIAISON=2h). If the agent crashes, loses connection, or abandons the task without releasing, the lease expires silently — but nothing acts on that expiry. The task stays claimed indefinitely, blocking the pipeline.

### Evidence

1. **Migration 026-leases.sql** — `expires_at TEXT NOT NULL`, `status TEXT CHECK(status IN ('active','expired','released'))` — schema supports expiry but no checker exists.
2. **DELETE /:taskId/claim** — unclaims task but does NOT update lease status (gap identified in codebase review).
3. **REQ-LEASE-001** — "Interval job (every 60s): query expired active leases. For each: set status=expired, unclaim task, return to pool."

### Design

#### REQ-EXPIRE-001: Lease Expiry Interval Job

A `setInterval` job running every 60 seconds that:

1. Queries all leases where `status = 'active' AND expires_at < datetime('now')`
2. For each expired lease:
   a. Update lease: `status = 'expired'`
   b. Unclaim task: `claimed_by = NULL, claimed_at = NULL`
   c. Log the expiry (console + optional brain contribution)

#### REQ-EXPIRE-002: Startup/Shutdown Lifecycle

- `startLeaseExpiryJob()` — starts the interval, called during server boot
- `stopLeaseExpiryJob()` — clears the interval, called during graceful shutdown
- Idempotent: calling start twice does not create duplicate intervals

#### REQ-EXPIRE-003: Transaction Safety

Each expired lease is processed in a SQLite transaction:
```sql
BEGIN;
UPDATE leases SET status = 'expired' WHERE id = ?;
UPDATE tasks SET claimed_by = NULL, claimed_at = NULL WHERE id = ?;
COMMIT;
```
If any step fails, the transaction rolls back and the lease is retried on the next cycle.

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/services/lease-expiry.ts` | CREATE | `checkExpiredLeases(db)`, `startLeaseExpiryJob(db)`, `stopLeaseExpiryJob()` |
| 2 | `api/index.ts` | UPDATE | Call `startLeaseExpiryJob(db)` after server starts, `stopLeaseExpiryJob()` on shutdown |

### NOT Changed

- **Lease creation** — ms-a3-4-lease-creation already handles this
- **Heartbeat** — ms-a3-6-heartbeat is a separate task (resets `expires_at`)
- **Voluntary release** — ms-a3-7-voluntary-release is a separate task
- **Lease durations** — role-based durations in lease-service.ts unchanged
- **Brain contribution on expiry** — out of scope for v0.0.1, can be added later

### Risks

1. **Race condition** — Two server instances running expiry checks simultaneously could double-process. Mitigated: single-instance deployment, SQLite's write lock provides serialization.
2. **Clock skew** — `datetime('now')` uses server clock. Acceptable for single-instance.
3. **High frequency** — 60s interval with no expired leases is a no-op SELECT. Negligible overhead.

## Do

### File Changes

#### 1. `api/services/lease-expiry.ts` (CREATE)
```typescript
import Database from 'better-sqlite3';

let expiryInterval: ReturnType<typeof setInterval> | null = null;

export function checkExpiredLeases(db: Database.Database): number {
  const expired = db.prepare(`
    SELECT l.id as lease_id, l.task_id
    FROM leases l
    WHERE l.status = 'active' AND l.expires_at < datetime('now')
  `).all() as Array<{ lease_id: string; task_id: string }>;

  const expireLease = db.prepare(`UPDATE leases SET status = 'expired' WHERE id = ?`);
  const unclaimTask = db.prepare(`UPDATE tasks SET claimed_by = NULL, claimed_at = NULL WHERE id = ?`);

  const processOne = db.transaction((leaseId: string, taskId: string) => {
    expireLease.run(leaseId);
    unclaimTask.run(taskId);
  });

  let count = 0;
  for (const { lease_id, task_id } of expired) {
    try {
      processOne(lease_id, task_id);
      count++;
      console.log(`Lease expired: ${lease_id} (task ${task_id})`);
    } catch (err) {
      console.error(`Failed to expire lease ${lease_id}:`, err);
    }
  }
  return count;
}

export function startLeaseExpiryJob(db: Database.Database): void {
  if (expiryInterval) return;
  expiryInterval = setInterval(() => {
    try {
      checkExpiredLeases(db);
    } catch (err) {
      console.error('Lease expiry check failed:', err);
    }
  }, 60_000);
  console.log('Lease expiry job started (interval: 60s)');
}

export function stopLeaseExpiryJob(): void {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
  }
}
```

#### 2. `api/index.ts` (UPDATE)
```typescript
import { startLeaseExpiryJob, stopLeaseExpiryJob } from './services/lease-expiry.js';

// After server starts:
startLeaseExpiryJob(db);

// On shutdown:
process.on('SIGTERM', () => { stopLeaseExpiryJob(); });
process.on('SIGINT', () => { stopLeaseExpiryJob(); });
```

## Study

### Test Cases (6)

1. `checkExpiredLeases` returns 0 when no leases are expired
2. `checkExpiredLeases` expires lease and unclaims task when `expires_at` is past
3. Expired lease has `status = 'expired'` after check
4. Unclaimed task has `claimed_by = NULL` after lease expiry
5. Active leases with future `expires_at` are NOT expired
6. `startLeaseExpiryJob` is idempotent (calling twice creates only one interval)

### Verification

- Create a lease with `expires_at` in the past, run `checkExpiredLeases`, verify task unclaimed
- Verify no side effects on active (non-expired) leases

## Act

### Outcomes → Next Iteration

- Lease expiry working → enables heartbeat (ms-a3-6) to reset expiry
- Task auto-unclaim → pool recovery works, no manual intervention needed
- If 60s interval too aggressive → make configurable (env var)
