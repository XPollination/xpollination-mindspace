# PDSA: mindspace_transition_task MCP Tool

**Task:** ms-a12-6-mcp-transition
**Status:** Design
**Version:** v0.0.1

## Plan

MCP tool wrapping POST /api/projects/:slug/tasks/:taskId/transition. Respects gates and dependencies. Returns approval info when human gate is hit.

### Dependencies
- ms-a3-2-state-machine (transition engine)

### Investigation

**Existing transition API (`api/routes/task-transitions.ts`):**
- POST with `{ to_status, actor, reason }`
- Validates transition via state machine
- Auto-creates approval_request on approval transition
- Returns `{ transition, role, task, auto_unblocked, approval_request_id }`

**Design decisions:**
1. Follow getTask.ts MCP pattern
2. Input: `project_slug`, `task_id`, `to_status`, `actor`, `reason` (optional)
3. POST to transition endpoint
4. If human gate (approval_request_id returned), surface it clearly
5. Return full transition result

## Do

### File Changes

#### 1. `src/tools/mindspace/transitionTask.ts` (CREATE)
```typescript
export const transitionTaskTool: Tool = {
  name: 'mindspace_transition_task',
  description: 'Transition a task to a new status. Respects state machine rules and gates.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: { type: 'string' },
      task_id: { type: 'string' },
      to_status: { type: 'string', description: 'Target status' },
      actor: { type: 'string', description: 'Actor performing transition (dev, qa, pdsa, liaison)' },
      reason: { type: 'string', description: 'Optional reason for transition' }
    },
    required: ['project_slug', 'task_id', 'to_status']
  }
};

export async function handleTransitionTask(input: any): Promise<any> {
  const url = `${MINDSPACE_API_URL}/api/projects/${input.project_slug}/tasks/${input.task_id}/transition`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': MINDSPACE_API_KEY },
    body: JSON.stringify({ to_status: input.to_status, actor: input.actor, reason: input.reason })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Transition failed: ${response.status}`);
  }
  return response.json();
}
```

#### 2. `src/tools/index.ts` (UPDATE)
Register transitionTask tool.

## Study

### Test Cases (8)
1. Valid transition executes successfully
2. Invalid transition returns error with allowed transitions
3. Actor role computed correctly (review chain)
4. Approval transition returns approval_request_id
5. Auto-unblock info returned on completion
6. Missing to_status → error
7. Task not found → error
8. Reason is optional and recorded when provided

## Act
- 1 new file, 1 update
