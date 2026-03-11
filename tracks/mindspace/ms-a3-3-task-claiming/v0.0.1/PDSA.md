# PDSA: Task Claiming Endpoint

**Task:** ms-a3-3-task-claiming
**Status:** Design
**Version:** v0.0.1

## Plan

Add a POST endpoint for agents to claim tasks. Claiming sets `claimed_by` and `claimed_at` on the task. Only unclaimed tasks in `ready` status with a matching role can be claimed.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table with claimed_by, claimed_at columns
- **ms-a3-2-state-machine** (complete): Transition validation + role computation

### Investigation

**Existing schema (012-tasks.sql):**
- `claimed_by TEXT REFERENCES agents(id)` — already exists
- `claimed_at TEXT` — already exists
- `current_role TEXT CHECK(current_role IN ('pdsa', 'dev', 'qa', 'liaison'))` — already exists

**DNA description:** POST /api/tasks/:id/claim. Checks: task unclaimed, role matches requester's declared role, task not blocked. Sets claimed_by, claimed_at. Returns 409 if already claimed.

**Design decisions:**
- Endpoint: POST /api/projects/:slug/tasks/:taskId/claim (project-scoped, consistent with existing routes)
- Validates: task exists, task is in `ready` status, task is unclaimed, requester's declared role matches task's current_role
- Also executes ready→active transition atomically (claiming = starting work)
- Sets claimed_by to the agent ID (from body), claimed_at to now
- Returns 409 if already claimed
- Returns 400 if task is blocked (has incomplete dependencies)
- Returns 400 if role mismatch

## Do

### File Changes

#### 1. `api/routes/task-claiming.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { validateTransition, computeRole } from '../services/task-state-machine.js';
import { randomUUID } from 'node:crypto';

export const taskClaimingRouter = Router({ mergeParams: true });

// POST / — claim a task (contributor)
taskClaimingRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const { agent_id, role } = req.body;
  const db = getDb();

  if (!agent_id || !role) {
    res.status(400).json({ error: 'Missing required fields: agent_id, role' });
    return;
  }

  const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison'];
  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Check task is in ready status
  if (task.status !== 'ready') {
    res.status(400).json({ error: `Task is in '${task.status}' status, must be 'ready' to claim` });
    return;
  }

  // Check task is unclaimed
  if (task.claimed_by) {
    res.status(409).json({ error: 'Task is already claimed', claimed_by: task.claimed_by, claimed_at: task.claimed_at });
    return;
  }

  // Check role matches
  if (task.current_role && task.current_role !== role) {
    res.status(400).json({ error: `Role mismatch: task requires '${task.current_role}', you declared '${role}'` });
    return;
  }

  // Check not blocked (has incomplete dependencies)
  const incompleteDeps = db.prepare(
    `SELECT COUNT(*) as count FROM task_dependencies td
     JOIN tasks t ON t.id = td.blocked_by_task_id
     WHERE td.task_id = ? AND t.status != 'complete'`
  ).get(taskId) as any;

  if (incompleteDeps.count > 0) {
    res.status(400).json({ error: `Task is blocked by ${incompleteDeps.count} incomplete dependency(ies)` });
    return;
  }

  // Verify agent exists
  const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent_id);
  if (!agent) {
    res.status(400).json({ error: 'Agent not found' });
    return;
  }

  // Validate transition ready→active
  const validation = validateTransition('ready', 'active');
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  // Atomically: set claimed_by/claimed_at + transition to active
  const newRole = computeRole('ready', 'active', role);
  db.prepare(
    `UPDATE tasks SET claimed_by = ?, claimed_at = datetime('now'), status = 'active',
     current_role = COALESCE(?, current_role), updated_at = datetime('now')
     WHERE id = ?`
  ).run(agent_id, newRole, taskId);

  // Record transition
  db.prepare(
    'INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, actor_role, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), taskId, 'ready', 'active', agent_id, role, 'Task claimed');

  const claimed = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json(claimed);
});

// DELETE / — release claim (contributor)
taskClaimingRouter.delete('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (!task.claimed_by) {
    res.status(400).json({ error: 'Task is not claimed' });
    return;
  }

  // Only allow release if task is active (claimed but work can be abandoned)
  if (task.status !== 'active') {
    res.status(400).json({ error: `Cannot release claim: task is in '${task.status}' status` });
    return;
  }

  // Release: clear claimed_by/claimed_at, transition back to ready
  db.prepare(
    `UPDATE tasks SET claimed_by = NULL, claimed_at = NULL, status = 'ready', updated_at = datetime('now')
     WHERE id = ?`
  ).run(taskId);

  db.prepare(
    'INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, actor_role, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), taskId, 'active', 'ready', task.claimed_by, task.current_role, 'Claim released');

  const released = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json(released);
});
```

#### 2. `api/routes/tasks.ts` (UPDATE)

```typescript
import { taskClaimingRouter } from './task-claiming.js';
tasksRouter.use('/:taskId/claim', taskClaimingRouter);
```

## Study

### Test Cases (12 total)

**Claim task (6):**
1. Claim unclaimed ready task with matching role → 200, sets claimed_by/claimed_at, status=active
2. Returns 409 when task already claimed
3. Returns 400 when task not in ready status
4. Returns 400 when role doesn't match task's current_role
5. Returns 400 when task has incomplete dependencies (blocked)
6. Returns 400 when agent_id doesn't exist

**Release claim (3):**
7. Release claimed active task → 200, clears claimed_by/claimed_at, status=ready
8. Returns 400 when task is not claimed
9. Returns 400 when task not in active status

**Transition history (2):**
10. Claim records ready→active transition with agent_id and role
11. Release records active→ready transition

**Validation (1):**
12. Returns 400 for missing agent_id or role fields

## Act

### Deployment

- 2 files: task-claiming.ts (NEW), tasks.ts (UPDATE — add import + use)
- No migration needed — claimed_by and claimed_at already exist in tasks table
- Endpoint: POST /api/projects/:slug/tasks/:taskId/claim (claim)
- Endpoint: DELETE /api/projects/:slug/tasks/:taskId/claim (release)
- Atomic claim+transition ensures consistency
