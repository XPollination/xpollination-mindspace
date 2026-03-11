# PDSA: mindspace_set_focus MCP Tool

**Task:** ms-a12-7-mcp-set-focus
**Status:** Design
**Version:** v0.0.1

## Plan

MCP tool wrapping PUT /api/projects/:slug/focus. Admin-only. Sets the project focus scope and task_ids.

### Dependencies
- ms-a5-1-focus-crud (focus API)

### Investigation

**Existing focus API (`api/routes/focus.ts`):**
- PUT `/` — sets scope and task_ids (admin)
- GET `/` — reads focus
- DELETE `/` — clears focus

**Design decisions:**
1. Follow getTask.ts MCP pattern
2. Input: `project_slug` (required), `scope` (required), `task_ids` (optional array)
3. PUT to focus endpoint
4. Return updated focus

## Do

### File Changes

#### 1. `src/tools/mindspace/setFocus.ts` (CREATE)
```typescript
export const setFocusTool: Tool = {
  name: 'mindspace_set_focus',
  description: 'Set project focus scope and optionally pin specific tasks. Admin only.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: { type: 'string' },
      scope: { type: 'string', description: 'Focus scope description' },
      task_ids: { type: 'array', items: { type: 'string' }, description: 'Task IDs to focus on' }
    },
    required: ['project_slug', 'scope']
  }
};

export async function handleSetFocus(input: any): Promise<any> {
  const url = `${MINDSPACE_API_URL}/api/projects/${input.project_slug}/focus`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': MINDSPACE_API_KEY },
    body: JSON.stringify({ scope: input.scope, task_ids: input.task_ids })
  });
  if (!response.ok) throw new Error(`Failed to set focus: ${response.status}`);
  return response.json();
}
```

#### 2. `src/tools/index.ts` (UPDATE)

## Study

### Test Cases (6)
1. Set focus with scope → returns updated focus
2. Set focus with scope + task_ids → task_ids stored as JSON
3. Update existing focus → overwrites
4. scope is required → error without it
5. Empty task_ids → null stored
6. Non-admin → 403

## Act
- 1 new file, 1 update
