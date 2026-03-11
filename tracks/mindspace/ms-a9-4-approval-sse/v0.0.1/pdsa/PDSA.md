# PDSA: Approval Notification via A2A SSE

**Date:** 2026-03-11
**Task:** ms-a9-4-approval-sse
**Capability:** approval-system
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a9-2-approval-granting (approve/reject endpoints), ms-a11-3-sse-infra (SSE manager)

## Plan

### Problem

When a human approves or rejects a task, the requesting agent has no real-time notification. Agents must poll the PM system to discover approval decisions. This adds latency (up to 30s polling interval) and wastes cycles. The SSE infrastructure (sse-manager.ts) already exists — we just need to emit TASK_APPROVED/TASK_REJECTED events when approvals are granted.

### Evidence

1. **REQ-GATE-001, REQ-A2A-001** — "When approval granted: send TASK_APPROVED message to requesting agent via SSE stream."
2. **sse-manager.ts** — `sendToAgent(agentId, event, data)` and `broadcast(event, data)` already available.
3. **approval-requests.ts** — PUT /:approvalId/approve and PUT /:approvalId/reject exist but don't emit SSE events.

### Design

#### REQ-SSE-APPROVAL-001: Emit TASK_APPROVED on Approval

After successful approval in PUT /:approvalId/approve:
1. Look up the task's `claimed_by` user (the requesting agent)
2. Call `sendToAgent(agentId, 'TASK_APPROVED', { task_id, task_slug, approval_id, decided_by })`
3. If no specific agent connected, `broadcast('TASK_APPROVED', ...)` as fallback

#### REQ-SSE-APPROVAL-002: Emit TASK_REJECTED on Rejection

After successful rejection in PUT /:approvalId/reject:
1. Call `sendToAgent(agentId, 'TASK_REJECTED', { task_id, task_slug, approval_id, reason, decided_by })`
2. Broadcast fallback if agent not connected

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/routes/approval-requests.ts` | UPDATE | Import sse-manager, emit events after approve/reject |

### NOT Changed

- SSE infrastructure — unchanged
- Approval request creation — unchanged
- Task transition on approval — already handled

### Risks

1. **Agent not connected** — If agent disconnected, SSE event is lost. Acceptable: agents still poll as backup.
2. **Event ordering** — Approval event may arrive before agent's poll detects the transition. Harmless: agent sees the update faster.

## Do

### File Changes

#### 1. `api/routes/approval-requests.ts` (UPDATE)

Add to approve handler (after successful approval):
```typescript
import { sendToAgent, broadcast } from '../lib/sse-manager.js';

// After setting approved status:
const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(approval.task_id);
const agentId = task?.claimed_by;
const eventData = { task_id: task.id, task_slug: task.slug, approval_id: approvalId, decided_by: user.id };
if (agentId) { sendToAgent(agentId, 'TASK_APPROVED', eventData); }
else { broadcast('TASK_APPROVED', eventData); }

// Similarly for reject handler:
const rejectData = { task_id: task.id, task_slug: task.slug, approval_id: approvalId, reason, decided_by: user.id };
if (agentId) { sendToAgent(agentId, 'TASK_REJECTED', rejectData); }
else { broadcast('TASK_REJECTED', rejectData); }
```

## Study

### Test Cases (5)

1. Approving a task sends TASK_APPROVED SSE event
2. Rejecting a task sends TASK_REJECTED SSE event with reason
3. Event sent to specific agent if connected
4. Event broadcast if agent not connected
5. Event payload includes task_id, task_slug, approval_id, decided_by

## Act

- SSE approval notifications → agents react immediately to decisions
- Reduces polling overhead and decision-to-action latency
- Future: add TASK_REWORK event for rework transitions
