# PDSA: mindspace_list_tasks MCP Tool

**Task:** ms-a12-2-mcp-list-tasks
**Status:** Design
**Version:** v0.0.1

## Plan

MCP tool wrapping GET /api/projects/:slug/tasks with filter support. Agents can list tasks filtered by status, role, available_only, blocked_only.

### Dependencies
- ms-a3-8-task-filters (task list API with filters)

### Investigation

**Existing MCP tool pattern (`src/tools/mindspace/getTask.ts`):**
- Tool definition with `inputSchema`
- Handler function calling REST API via `fetch`
- Uses `MINDSPACE_API_URL` + `MINDSPACE_API_KEY`
- Graceful degradation pattern

**Design decisions:**
1. Follow existing getTask.ts pattern
2. Input: `project_slug` (required), `status`, `current_role`, `available_only`, `blocked_only` (optional)
3. Build query string from filters
4. Return task array with dependency enrichment (from ms-a8-4-dep-filtering)

## Do

### File Changes

#### 1. `src/tools/mindspace/listTasks.ts` (CREATE)
```typescript
export const listTasksTool: Tool = {
  name: 'mindspace_list_tasks',
  description: 'List tasks with optional filters. Use available_only=true to find claimable work.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: { type: 'string', description: 'Project slug' },
      status: { type: 'string', description: 'Filter by status' },
      current_role: { type: 'string', description: 'Filter by role' },
      available_only: { type: 'boolean', description: 'Only unclaimed, unblocked tasks' },
      blocked_only: { type: 'boolean', description: 'Only blocked tasks' }
    },
    required: ['project_slug']
  }
};

export async function handleListTasks(input: any): Promise<any> {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.current_role) params.set('current_role', input.current_role);
  if (input.available_only) params.set('available_only', 'true');
  if (input.blocked_only) params.set('blocked_only', 'true');

  const url = `${MINDSPACE_API_URL}/api/projects/${input.project_slug}/tasks?${params}`;
  const response = await fetch(url, { headers: { 'X-API-Key': MINDSPACE_API_KEY } });
  if (!response.ok) throw new Error(`Failed to list tasks: ${response.status}`);
  return response.json();
}
```

#### 2. `src/tools/index.ts` (UPDATE)
Register listTasks tool in the tool registry.

## Study

### Test Cases (8)
1. List all tasks for project (no filters)
2. Filter by status returns matching tasks
3. Filter by role returns matching tasks
4. available_only=true excludes claimed and blocked
5. blocked_only=true returns only blocked tasks
6. Combined filters work (status + role)
7. Empty result returns empty array
8. Invalid project_slug returns error

## Act
- 1 new file (listTasks.ts), 1 update (index.ts)
