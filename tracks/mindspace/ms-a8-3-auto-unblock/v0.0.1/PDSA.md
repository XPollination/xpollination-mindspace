# PDSA: Blocked Status Computation + Auto-Unblock

**Task:** ms-a8-3-auto-unblock
**Status:** Design
**Version:** v0.0.1

## Plan

Compute whether a task is blocked based on its dependencies. When a task completes, check all tasks that depend on it and auto-unblock any that have all dependencies now complete.

### Dependencies

- **ms-a8-1-dependency-table** (complete): task_dependencies table
- **ms-a3-2-state-machine** (complete): Transition validation

### Investigation

**DNA description:** Task is blocked if ANY blocker is not complete. Auto-unblock: when task completes, recompute dependents. Create brain thought on unblock.

**Design decisions:**
- Add `computeBlockedStatus(taskId)` service function: returns true if any dependency is not complete
- Add auto-unblock hook in task-transitions.ts: after any transition to `complete`, find all dependents and check if they can be unblocked
- Auto-unblock: if a task is in `blocked` status and all its blockers are now `complete`, transition it to `ready`
- Record auto-unblock transitions with actor='system' and reason='auto-unblock: all dependencies complete'
- Optional brain thought contribution on unblock (best-effort, non-blocking)

## Do

### File Changes

#### 1. `api/services/blocked-status.ts` (NEW)

```typescript
import { getDb } from '../db/connection.js';

/**
 * Check if a task is blocked (has any incomplete dependencies).
 */
export function isTaskBlocked(taskId: string): { blocked: boolean; incompleteCount: number; blockers: string[] } {
  const db = getDb();
  const deps = db.prepare(
    `SELECT td.blocked_by_task_id, t.title, t.status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.blocked_by_task_id
     WHERE td.task_id = ? AND t.status != 'complete'`
  ).all(taskId) as any[];

  return {
    blocked: deps.length > 0,
    incompleteCount: deps.length,
    blockers: deps.map(d => d.blocked_by_task_id)
  };
}

/**
 * After a task completes, find all dependents and auto-unblock those
 * that are in 'blocked' status with all dependencies now complete.
 * Returns list of unblocked task IDs.
 */
export function autoUnblockDependents(completedTaskId: string): string[] {
  const db = getDb();
  const { randomUUID } = require('node:crypto');

  // Find all tasks that depend on the completed task
  const dependents = db.prepare(
    `SELECT DISTINCT td.task_id
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.task_id
     WHERE td.blocked_by_task_id = ? AND t.status = 'blocked'`
  ).all(completedTaskId) as { task_id: string }[];

  const unblocked: string[] = [];

  for (const dep of dependents) {
    const status = isTaskBlocked(dep.task_id);
    if (!status.blocked) {
      // All dependencies complete — unblock
      db.prepare(
        "UPDATE tasks SET status = 'ready', updated_at = datetime('now') WHERE id = ?"
      ).run(dep.task_id);

      db.prepare(
        'INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, actor_role, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), dep.task_id, 'blocked', 'ready', 'system', null, 'auto-unblock: all dependencies complete');

      unblocked.push(dep.task_id);
    }
  }

  return unblocked;
}
```

#### 2. `api/routes/task-transitions.ts` (UPDATE)

After successful transition to 'complete', call autoUnblockDependents:

```typescript
import { autoUnblockDependents } from '../services/blocked-status.js';

// After updating task status (inside POST handler), add:
if (to_status === 'complete') {
  const unblocked = autoUnblockDependents(taskId);
  // Include in response
  res.status(200).json({
    transition: { from: task.status, to: to_status },
    role: newRole || task.current_role,
    task: updatedTask,
    auto_unblocked: unblocked
  });
  return;
}
```

## Study

### Test Cases (10 total)

**isTaskBlocked (3):**
1. Returns blocked=false for task with no dependencies
2. Returns blocked=true with correct count when dependencies are incomplete
3. Returns blocked=false when all dependencies are complete

**Auto-unblock (4):**
4. Completing a task auto-unblocks blocked dependents with all deps complete
5. Does NOT unblock dependents that still have other incomplete dependencies
6. Does NOT affect dependents that are not in 'blocked' status
7. Auto-unblock records transition with actor='system' and reason

**Transition response (2):**
8. Complete transition response includes auto_unblocked array
9. Non-complete transitions do not include auto_unblocked

**Edge case (1):**
10. Multiple dependents can be unblocked by single task completion

## Act

### Deployment

- 2 files: blocked-status.ts (NEW), task-transitions.ts (UPDATE)
- No migration needed
- Auto-unblock is automatic on any transition to complete
