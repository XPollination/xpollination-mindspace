# PDSA: Task State Machine (Workflow Transitions)

**Task:** ms-a3-2-state-machine
**Status:** Design
**Version:** v0.0.1

## Plan

Implement a task state machine that validates and executes workflow transitions. Only valid transitions succeed; invalid ones return 400. The state machine encodes the PDSA design path, review chain, rework flows, and blocked state.

### Problem

The tasks table (ms-a3-1) stores status but has no transition validation. Any status can be set to any other via PUT. A state machine endpoint is needed to enforce valid transitions, update the task's current_role, and record transition history.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table with status and current_role columns
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**Source of truth:** `tracks/process/context/WORKFLOW.md` (v17)

**Valid transitions (from workflow):**

PDSA Design Path:
- `pending → ready` (actor: liaison/system)
- `ready → active` (actor: matching role claims)
- `active → approval` (actor: pdsa submits design)
- `approval → approved` (actor: liaison approves)
- `approval → rework` (actor: liaison rejects)
- `approved → active` (actor: qa claims for testing — note: qa enters active+qa)
- `active → testing` (actor: qa runs tests)
- `testing → ready` (actor: qa prepares for dev — note: sets role to dev)
- `ready → active` (actor: dev claims)
- `active → review` (actor: dev submits for review)

Review chain (same-state transitions with role change):
- `review → review` (actor: qa, role changes qa→pdsa)
- `review → review` (actor: pdsa, role changes pdsa→liaison)
- `review → complete` (actor: liaison, final approval)

Rework:
- `review → rework` (actor: qa/pdsa/liaison, requires rework_target_role)
- `approval → rework` (actor: liaison, target = pdsa)
- `complete → rework` (actor: liaison/human, requires rework_target_role)
- `rework → active` (actor: assigned role reclaims)

Blocked:
- `any → blocked` (any agent, requires blocked_reason)
- `blocked → restore` (liaison/system, restores previous state+role)

**Design decision: transition endpoint vs service function**
Both. A reusable `validateTransition()` function in a service module, and a `POST /api/projects/:slug/tasks/:taskId/transition` endpoint that calls it.

## Do

### Architecture

```
POST /api/projects/:slug/tasks/:taskId/transition
  body: { to_status, actor, rework_target_role?, blocked_reason? }
  ├── Validate task exists in project
  ├── validateTransition(from_status, to_status, actor)
  ├── Compute new role (from transition rules)
  ├── Handle special cases (blocked store/restore, rework routing)
  ├── UPDATE tasks SET status, current_role, updated_at
  ├── INSERT into task_transitions (history)
  └── Return updated task + transition details
```

### File Changes

#### 1. `api/db/migrations/013-task-transitions.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS task_transitions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_role TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transitions_task ON task_transitions(task_id);
CREATE INDEX IF NOT EXISTS idx_transitions_created ON task_transitions(created_at);
```

#### 2. `api/services/task-state-machine.ts` (NEW)

Core state machine logic, separated from HTTP layer.

```typescript
// Transition map: from_status → [valid to_statuses]
const TRANSITIONS: Record<string, string[]> = {
  pending:  ['ready', 'blocked'],
  ready:    ['active', 'blocked'],
  active:   ['review', 'approval', 'testing', 'blocked'],
  approval: ['approved', 'rework', 'blocked'],
  approved: ['active', 'blocked'],
  testing:  ['ready', 'blocked'],
  review:   ['review', 'complete', 'rework', 'blocked'],
  rework:   ['active', 'blocked'],
  blocked:  [], // Special: uses blocked_from_state
  complete: ['rework'],
};

export function validateTransition(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === 'blocked' && toStatus === 'restore') return true;
  const valid = TRANSITIONS[fromStatus];
  if (!valid) return false;
  return valid.includes(toStatus);
}
```

**Role computation rules:**

```typescript
// Determine new role after transition
export function computeNewRole(
  fromStatus: string,
  toStatus: string,
  actor: string,
  currentRole: string | null,
  reworkTargetRole?: string
): string | null {
  // Review chain: same-state transitions change role
  if (fromStatus === 'review' && toStatus === 'review') {
    const REVIEW_CHAIN: Record<string, string> = {
      qa: 'pdsa',
      pdsa: 'liaison',
    };
    return REVIEW_CHAIN[actor] || currentRole;
  }

  // Rework: route to target role
  if (toStatus === 'rework') {
    return reworkTargetRole || null; // Engine requires rework_target_role
  }

  // Rework exit: keep current role (reclaim)
  if (fromStatus === 'rework' && toStatus === 'active') {
    return currentRole;
  }

  // approval → approved: qa gets it
  if (fromStatus === 'approval' && toStatus === 'approved') {
    return 'qa';
  }

  // approved → active: qa claims
  if (fromStatus === 'approved' && toStatus === 'active') {
    return 'qa';
  }

  // testing → ready: dev gets it
  if (fromStatus === 'testing' && toStatus === 'ready') {
    return 'dev';
  }

  // active → approval: pdsa submits, liaison monitors
  if (toStatus === 'approval') {
    return 'liaison';
  }

  // active → review: dev submits, qa reviews
  if (fromStatus === 'active' && toStatus === 'review') {
    return 'qa';
  }

  // review → complete: liaison completes
  if (toStatus === 'complete') {
    return 'liaison';
  }

  // Default: actor becomes role
  if (toStatus === 'active') {
    return actor;
  }

  return currentRole;
}
```

#### 3. `api/routes/task-transitions.ts` (NEW)

HTTP endpoint for transitions.

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { validateTransition, computeNewRole } from '../services/task-state-machine.js';

export const taskTransitionsRouter = Router({ mergeParams: true });

// POST /:taskId/transition — execute a state transition
taskTransitionsRouter.post(
  '/:taskId/transition',
  requireProjectAccess('contributor'),
  (req: Request, res: Response) => {
    const { slug, taskId } = req.params;
    const { to_status, actor, rework_target_role, blocked_reason } = req.body;

    if (!to_status || !actor) {
      res.status(400).json({ error: 'Missing required fields: to_status, actor' });
      return;
    }

    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const fromStatus = task.status;
    const effectiveToStatus = to_status === 'restore' ? 'restore' : to_status;

    // Validate transition
    if (!validateTransition(fromStatus, effectiveToStatus)) {
      res.status(400).json({
        error: `Invalid transition: ${fromStatus} → ${to_status}`,
        current_status: fromStatus,
        valid_transitions: TRANSITIONS[fromStatus] || []
      });
      return;
    }

    // Rework requires rework_target_role
    if (to_status === 'rework' && !rework_target_role) {
      res.status(400).json({ error: 'rework_target_role is required for rework transitions' });
      return;
    }

    // Blocked requires blocked_reason
    if (to_status === 'blocked' && !blocked_reason) {
      res.status(400).json({ error: 'blocked_reason is required for blocked transitions' });
      return;
    }

    let newStatus = to_status;
    let newRole: string | null;

    // Handle blocked state
    if (to_status === 'blocked') {
      // Store previous state in DNA-style columns or task fields
      db.prepare(
        "UPDATE tasks SET status = 'blocked', updated_at = datetime('now') WHERE id = ?"
      ).run(taskId);
      // Store blocked metadata (blocked_from_state, blocked_from_role, blocked_reason)
      // Using a simple approach: store in task description or separate columns
      // For now, caller must store in DNA via update-dna
      newRole = task.current_role;
    } else if (to_status === 'restore' && fromStatus === 'blocked') {
      // Restore requires blocked_from_state in DNA (caller provides or reads from DNA)
      // The actual restore state would come from DNA fields
      res.status(400).json({ error: 'Restore must provide blocked_from_state and blocked_from_role' });
      return;
    } else {
      newRole = computeNewRole(fromStatus, to_status, actor, task.current_role, rework_target_role);
    }

    // Execute transition
    db.prepare(
      'UPDATE tasks SET status = ?, current_role = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(newStatus, newRole, taskId);

    // Record transition history
    const transitionId = randomUUID();
    db.prepare(
      'INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, actor_role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(transitionId, taskId, fromStatus, newStatus, actor, newRole);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(200).json({
      task: updatedTask,
      transition: {
        id: transitionId,
        from_status: fromStatus,
        to_status: newStatus,
        actor,
        new_role: newRole
      }
    });
  }
);
```

#### 4. `api/routes/tasks.ts` (UPDATE)

Mount the transitions endpoint:

```typescript
// Add import
import { taskTransitionsRouter } from './task-transitions.js';

// Mount after task routes (inside tasksRouter)
tasksRouter.use(taskTransitionsRouter);
```

### Transition Map Summary

| From | To | Actor | New Role |
|------|-----|-------|----------|
| pending | ready | liaison/system | preserved |
| ready | active | matching role | actor |
| active | approval | pdsa | liaison |
| active | testing | qa | qa |
| active | review | dev | qa |
| approval | approved | liaison | qa |
| approval | rework | liaison | pdsa (always) |
| approved | active | qa | qa |
| testing | ready | qa | dev |
| review | review | qa | pdsa |
| review | review | pdsa | liaison |
| review | complete | liaison | liaison |
| review | rework | any | rework_target_role |
| rework | active | assigned role | preserved |
| complete | rework | liaison/human | rework_target_role |
| any | blocked | any | preserved |

## Study

### Test Cases (20 total)

**Transition validation (6):**
1. Valid transition pending→ready succeeds
2. Invalid transition pending→complete returns 400
3. Review→review (same-state) is valid
4. Complete→rework is valid
5. Returns valid_transitions in error response
6. Missing to_status or actor returns 400

**Role computation (6):**
7. Review chain: qa actor changes role to pdsa
8. Review chain: pdsa actor changes role to liaison
9. Rework sets role to rework_target_role
10. Testing→ready sets role to dev
11. Approval→approved sets role to qa
12. Active→review sets role to qa

**Rework flow (3):**
13. Rework requires rework_target_role (400 without it)
14. Rework→active preserves current role
15. Complete→rework requires rework_target_role

**Blocked flow (2):**
16. Blocked requires blocked_reason (400 without it)
17. Any state can transition to blocked

**Transition history (2):**
18. Transition creates history record in task_transitions
19. History records from_status, to_status, actor, actor_role

**Task update (1):**
20. Task status and current_role are updated after transition

## Act

### Deployment

- Migration 013 creates task_transitions history table
- Service module is reusable (can be imported by A2A message handler when TRANSITION is implemented)
- Endpoint mounts under existing tasks router at `/:taskId/transition`
- 4 files: migration (NEW), task-state-machine.ts (NEW), task-transitions.ts (NEW), tasks.ts (UPDATE)
