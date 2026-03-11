# PDSA: Heartbeat Endpoint (Brain Thought Validation)

**Date:** 2026-03-11
**Task:** ms-a3-6-heartbeat
**Capability:** lease-management
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a3-4-lease-creation (leases table + createLease service)

## Plan

### Problem

Leases have a fixed expiry (role-based: 2-6 hours). Long-running tasks exceed their lease duration legitimately — an agent actively working should not lose its claim. The heartbeat endpoint allows agents to prove they are still alive by submitting a brain thought ID, which resets the lease expiry.

### Evidence

1. **REQ-HEARTBEAT-001** — "POST /api/tasks/:id/heartbeat with { brain_thought_id }. Validates: task claimed by this user, lease active, thought exists in brain. Resets lease expiry."
2. **Leases table** — `last_heartbeat TEXT DEFAULT datetime('now')` column exists but is never updated after creation.
3. **Lease expiry checker (ms-a3-5)** — will expire leases based on `expires_at`. Without heartbeat, long tasks get expired incorrectly.

### Design

#### REQ-HB-001: Heartbeat Endpoint

`POST /api/tasks/:taskId/heartbeat`

Request body:
```json
{ "brain_thought_id": "uuid-of-recent-brain-contribution" }
```

Validation:
1. Task exists and is claimed by the requesting user
2. Active lease exists for this task+user
3. `brain_thought_id` is provided and non-empty (format validation only — brain verification is optional for v0.0.1)

On success:
1. Update lease: `last_heartbeat = datetime('now')`, `expires_at = datetime('now', '+N hours')` (using role-based duration from lease-service)
2. Return 200 with updated lease

On failure:
- 404: Task not found
- 403: Task not claimed by this user
- 400: Missing `brain_thought_id`
- 409: No active lease for this task

#### REQ-HB-002: Brain Thought Validation (Best-Effort)

If brain API is available (`http://localhost:3200`), validate that the `brain_thought_id` exists via GET request. If brain is unavailable or returns 404, log a warning but still accept the heartbeat. Brain validation is best-effort — not a hard gate.

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/routes/task-heartbeat.ts` | CREATE | POST /:taskId/heartbeat endpoint |
| 2 | `api/services/lease-service.ts` | UPDATE | Add `renewLease(db, leaseId, role)` function |
| 3 | `api/index.ts` | UPDATE | Register heartbeat route |

### NOT Changed

- **Lease creation** — unchanged
- **Lease expiry checker** — unchanged (ms-a3-5), heartbeat just resets the clock
- **Task claiming/unclaiming** — unchanged
- **Brain API** — no changes to brain, only reads from it

### Risks

1. **Heartbeat spam** — Agent could heartbeat every second. Acceptable: each heartbeat is a single UPDATE, negligible overhead.
2. **Brain unavailability** — If brain is down, heartbeat still works (best-effort validation). Documented in response.
3. **Role duration mismatch** — If role changes between claim and heartbeat, lease gets new role's duration. Acceptable: lease duration follows current role.

## Do

### File Changes

#### 1. `api/routes/task-heartbeat.ts` (CREATE)
```typescript
import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { renewLease } from '../services/lease-service.js';

export async function taskHeartbeatRoutes(app: FastifyInstance, db: Database.Database) {
  app.post('/api/tasks/:taskId/heartbeat', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { brain_thought_id } = request.body as { brain_thought_id?: string };
    const user = (request as any).user;

    if (!brain_thought_id) {
      return reply.status(400).json({ error: 'brain_thought_id is required' });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return reply.status(404).json({ error: 'Task not found' });
    if (task.claimed_by !== user.id) {
      return reply.status(403).json({ error: 'Task not claimed by you' });
    }

    const lease = db.prepare(
      'SELECT * FROM leases WHERE task_id = ? AND user_id = ? AND status = ?'
    ).get(taskId, user.id, 'active');
    if (!lease) {
      return reply.status(409).json({ error: 'No active lease for this task' });
    }

    // Best-effort brain validation
    let brainValid = null;
    try {
      const resp = await fetch(`http://localhost:3200/api/v1/thoughts/${brain_thought_id}`);
      brainValid = resp.ok;
    } catch {
      brainValid = null; // Brain unavailable
    }

    const updated = renewLease(db, lease.id, task.current_role || 'dev');
    return reply.status(200).json({
      lease: updated,
      brain_thought_valid: brainValid
    });
  });
}
```

#### 2. `api/services/lease-service.ts` (UPDATE)
Add `renewLease` function:
```typescript
export function renewLease(db: Database.Database, leaseId: string, role: string): any {
  const duration = ROLE_DURATIONS[role] || ROLE_DURATIONS.default;
  return db.prepare(`
    UPDATE leases
    SET last_heartbeat = datetime('now'),
        expires_at = datetime('now', '+${duration} hours')
    WHERE id = ? AND status = 'active'
    RETURNING *
  `).get(leaseId);
}
```

## Study

### Test Cases (8)

1. POST heartbeat with valid brain_thought_id returns 200
2. POST heartbeat updates `last_heartbeat` timestamp
3. POST heartbeat extends `expires_at` by role duration
4. POST heartbeat without brain_thought_id returns 400
5. POST heartbeat on task not claimed by user returns 403
6. POST heartbeat on task with no active lease returns 409
7. POST heartbeat on non-existent task returns 404
8. POST heartbeat works when brain API is unavailable (best-effort)

### Verification

- Create task + claim + lease, heartbeat, verify `expires_at` extended
- Verify lease stays active after heartbeat even if original `expires_at` was past

## Act

### Outcomes → Next Iteration

- Heartbeat working → agents can maintain long-running tasks
- Combined with lease expiry (ms-a3-5) → only truly abandoned tasks get reclaimed
- Brain thought validation → future: require thought content relevance check
