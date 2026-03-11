# PDSA: TASK_AVAILABLE Broadcast on State Change

**Task:** ms-a11-6-task-available
**Status:** Design
**Version:** v0.0.1

## Plan

Broadcast TASK_AVAILABLE SSE events when a task becomes available (enters ready status, gets unclaimed, or unblocked). Connected agents matching the task's role and project receive push notifications.

### Dependencies
- ms-a11-3-sse-infra (SSE infrastructure)
- ms-a3-2-state-machine (transition engine)

### Investigation

**Design decisions:**
1. Hook into task-transitions.ts: after successful transition, check if task is now "available" (status=ready + unclaimed + unblocked)
2. Hook into task-claiming.ts: on unclaim (DELETE), broadcast if task becomes available
3. Hook into blocked-status.ts: after auto-unblock, broadcast for newly unblocked tasks
4. SSE event format: `{ type: 'TASK_AVAILABLE', task_id, project_slug, role, title }`
5. Filter: only send to SSE clients registered for matching project + role
6. New service: `broadcastTaskAvailable(taskId, projectSlug, role)` that interfaces with SSE infra

## Do

### File Changes

#### 1. `api/services/task-broadcast.ts` (CREATE)
```typescript
import { getSSEClients } from './sse-manager.js'; // from ms-a11-3

export function broadcastTaskAvailable(taskId: string, projectSlug: string, role: string, title: string): void {
  const event = JSON.stringify({
    type: 'TASK_AVAILABLE',
    task_id: taskId,
    project_slug: projectSlug,
    role,
    title,
    timestamp: new Date().toISOString()
  });

  const clients = getSSEClients(projectSlug, role);
  for (const client of clients) {
    client.write(`event: task_available\ndata: ${event}\n\n`);
  }
}
```

#### 2. `api/routes/task-transitions.ts` (UPDATE)
After transition to 'ready': call `broadcastTaskAvailable()`

#### 3. `api/routes/task-claiming.ts` (UPDATE)
After unclaim: call `broadcastTaskAvailable()` if task status is ready

#### 4. `api/services/blocked-status.ts` (UPDATE)
After auto-unblock: call `broadcastTaskAvailable()` for each unblocked task

## Study

### Test Cases (8)
1. Transition to ready → TASK_AVAILABLE sent to matching role clients
2. Unclaim task in ready status → TASK_AVAILABLE broadcast
3. Auto-unblock → TASK_AVAILABLE for newly unblocked task
4. Event not sent for non-ready statuses
5. Event only sent to clients matching project + role
6. No error when no clients connected
7. Event payload includes task_id, project_slug, role, title
8. Multiple clients for same role all receive event

## Act
- 1 new service, 3 route updates
- Depends on SSE infrastructure from ms-a11-3
