# PDSA: Lease Table + Lease Creation on Claim

**Task:** ms-a3-4-lease-creation
**Status:** Design
**Version:** v0.0.1

## Plan

Add leases table and create lease automatically when a task is claimed. Leases have configurable duration per role to prevent tasks from being held indefinitely.

### Dependencies
- ms-a3-3-task-claiming (claim endpoint exists)
- t1-3-repos-bootstrap (base API)

### Investigation

**Current claiming (`api/routes/task-claiming.ts`):**
- POST `/:taskId/claim` sets `claimed_by` and `claimed_at`
- No lease tracking, no expiry

**Design decisions:**
1. New migration: `leases` table with `id, task_id, user_id, started_at, expires_at, last_heartbeat, status` (active/expired/released)
2. Default durations: PDSA=4h, DEV=6h, QA=3h, LIAISON=2h
3. On claim: create lease row with `expires_at = now + duration` based on task's `current_role`
4. Lease service: `createLease(db, taskId, userId, role)` returns lease

## Do

### File Changes

#### 1. `api/db/migrations/024-leases.sql` (CREATE)
```sql
CREATE TABLE IF NOT EXISTS leases (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_heartbeat TEXT DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','released')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leases_task ON leases(task_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
```

#### 2. `api/services/lease-service.ts` (CREATE)
```typescript
const LEASE_DURATIONS: Record<string, number> = {
  pdsa: 4 * 60, dev: 6 * 60, qa: 3 * 60, liaison: 2 * 60 // minutes
};

export function createLease(db: any, taskId: string, userId: string, role: string): any {
  const durationMinutes = LEASE_DURATIONS[role] || 4 * 60;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO leases (id, task_id, user_id, expires_at)
     VALUES (?, ?, ?, datetime('now', '+${durationMinutes} minutes'))`
  ).run(id, taskId, userId);
  return db.prepare('SELECT * FROM leases WHERE id = ?').get(id);
}
```

#### 3. `api/routes/task-claiming.ts` (UPDATE)
Add lease creation after claim:
```typescript
import { createLease } from '../services/lease-service.js';
// After claim UPDATE:
const lease = createLease(db, taskId, user.id, task.current_role || 'dev');
res.status(200).json({ ...updated, lease });
```

## Study

### Test Cases (8)
1. Claim creates lease with correct `expires_at` for PDSA role (4h)
2. Claim creates lease with correct `expires_at` for DEV role (6h)
3. Claim creates lease with correct `expires_at` for QA role (3h)
4. Claim creates lease with correct `expires_at` for LIAISON role (2h)
5. Lease `status` defaults to 'active'
6. Lease `last_heartbeat` set to creation time
7. Unknown role defaults to 4h
8. Unclaim (DELETE) sets lease status to 'released'

## Act

### Deployment
- 1 migration (024-leases.sql), 1 new service (lease-service.ts), 1 update (task-claiming.ts)
- No breaking changes
