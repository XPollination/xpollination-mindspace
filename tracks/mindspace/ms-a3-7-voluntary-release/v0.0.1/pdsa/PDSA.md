# PDSA: Voluntary Release Endpoint

**Date:** 2026-03-11
**Task:** ms-a3-7-voluntary-release
**Capability:** lease-management
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a3-4-lease-creation (leases table + createLease service)

## Plan

### Problem

An agent may decide it cannot complete a task (wrong expertise, blocked by external dependency, context exhaustion). Currently the only way to unclaim is `DELETE /:taskId/claim`, which does not update the lease status or record the reason. Voluntary release provides a clean handoff: the agent explains why it's releasing, the lease is marked `released`, and the task returns to the pool.

### Evidence

1. **REQ-CLAIM-001** — "POST /api/tasks/:id/release with { reason }. Unclaims task. Sets lease status=released. Brain thought auto-contributed. Contributions preserved for tokenomics."
2. **DELETE /:taskId/claim** — unclaims but does NOT update lease status (gap).
3. **Context exhaustion** — agents hit context limits and need to hand off cleanly.

### Design

#### REQ-RELEASE-001: Voluntary Release Endpoint

`POST /api/tasks/:taskId/release`

Request body:
```json
{ "reason": "Context exhaustion — handing off to fresh agent" }
```

Validation:
1. Task exists
2. Task claimed by the requesting user
3. Active lease exists for this task+user
4. `reason` is provided and non-empty

On success:
1. Update lease: `status = 'released'`
2. Unclaim task: `claimed_by = NULL, claimed_at = NULL`
3. Auto-contribute to brain: "TASK RELEASED: {agent} released {slug} — {reason}"
4. Return 200 with release confirmation

On failure:
- 404: Task not found
- 403: Task not claimed by this user
- 400: Missing `reason`
- 409: No active lease

#### REQ-RELEASE-002: Brain Auto-Contribution

On successful release, contribute a thought to brain (best-effort):
- `thought_category: "transition_marker"`
- `topic: task slug`
- Content: "TASK RELEASED: {agent_name} released {slug} — {reason}"

If brain is unavailable, log warning but still complete the release.

#### REQ-RELEASE-003: Contributions Preserved

The release does NOT delete or void any brain contributions made during the lease period. Previous work remains in the knowledge base for the next agent to build upon. This supports tokenomics: work contributed has value even if the agent releases.

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/routes/task-release.ts` | CREATE | POST /:taskId/release endpoint |
| 2 | `api/index.ts` | UPDATE | Register release route |

### NOT Changed

- **Lease creation** — unchanged
- **Lease expiry** — ms-a3-5 handles expired leases separately
- **Heartbeat** — ms-a3-6 resets lease, release terminates it
- **DELETE /:taskId/claim** — kept as-is for backward compat (simpler unclaim without reason)
- **Brain contributions** — previous contributions preserved

### Risks

1. **Double release** — Agent calls release twice. Mitigated: second call gets 409 (no active lease).
2. **Brain unavailability** — Release still succeeds, brain contribution is best-effort.
3. **Tokenomics tracking** — Future: track contributions-per-lease for reward calculation. Out of scope for v0.0.1.

## Do

### File Changes

#### 1. `api/routes/task-release.ts` (CREATE)
```typescript
import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';

export async function taskReleaseRoutes(app: FastifyInstance, db: Database.Database) {
  app.post('/api/tasks/:taskId/release', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { reason } = request.body as { reason?: string };
    const user = (request as any).user;

    if (!reason || reason.trim().length === 0) {
      return reply.status(400).json({ error: 'reason is required' });
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

    // Transaction: release lease + unclaim task
    const releaseTx = db.transaction(() => {
      db.prepare('UPDATE leases SET status = ? WHERE id = ?').run('released', lease.id);
      db.prepare('UPDATE tasks SET claimed_by = NULL, claimed_at = NULL WHERE id = ?').run(taskId);
    });
    releaseTx();

    // Best-effort brain contribution
    try {
      await fetch('http://localhost:3200/api/v1/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `TASK RELEASED: ${user.name || user.id} released ${task.slug || taskId} — ${reason}`,
          agent_id: user.id,
          agent_name: user.name || 'unknown',
          context: `task: ${task.slug || taskId}`,
          thought_category: 'transition_marker',
          topic: task.slug || taskId
        })
      });
    } catch {
      console.warn('Brain contribution failed during task release');
    }

    return reply.status(200).json({
      released: true,
      task_id: taskId,
      lease_id: lease.id,
      reason
    });
  });
}
```

## Study

### Test Cases (7)

1. POST release with valid reason returns 200
2. POST release sets lease status to 'released'
3. POST release unclaims task (claimed_by = NULL)
4. POST release without reason returns 400
5. POST release on task not claimed by user returns 403
6. POST release on task with no active lease returns 409
7. POST release on non-existent task returns 404

### Verification

- Create task + claim + lease, release with reason, verify both lease and task updated
- Verify brain contribution created (if brain available)
- Verify second release call returns 409

## Act

### Outcomes → Next Iteration

- Voluntary release → agents can hand off cleanly when blocked or context-exhausted
- Combined with lease expiry (ms-a3-5) → full lifecycle: create → heartbeat → release/expire
- Brain contribution on release → next agent can read why previous agent stopped
- Future: tokenomics reward based on contributions-during-lease
