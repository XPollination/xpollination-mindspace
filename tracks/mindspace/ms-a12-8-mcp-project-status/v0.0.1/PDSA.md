# PDSA: mindspace_get_project_status MCP tool

**Task:** ms-a12-8-mcp-project-status
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Claude agents need a quick project overview within MCP conversations — how many tasks exist, their status distribution, and basic project info. This gives agents situational awareness without multiple API calls.

## Requirements (REQ-MCP-MINDSPACE-001)

> MCP tool: overview with req count, task status distribution, active agents, pending approvals, current focus. AC: Returns project overview.

## Investigation

### Available data

At this point in the architecture, only projects (A2-1) exist as REST API. Tasks, requirements, agents, approvals, and focus are not yet implemented as API endpoints. The tool must work with what exists now and degrade gracefully.

### Design decisions

1. **Progressive enhancement** — Return what's available now (project info). As APIs for tasks, agents, etc. come online, this tool will be extended.
2. **Single project_slug parameter** — Required. Returns status for one project.
3. **Multiple API calls** — Calls GET /api/projects/:slug for project info. In future: calls tasks, agents, approvals, focus endpoints too.
4. **Graceful degradation** — If an endpoint returns 404/error (not yet implemented), that section is omitted from the response rather than failing the entire tool.
5. **Same HTTP client pattern** as ms-a12-1 — native fetch, X-API-Key, MINDSPACE_API_URL env.

## Design

### File 1: `src/tools/mindspace/getProjectStatus.ts` (NEW)

```typescript
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

const GetProjectStatusInput = z.object({
  project_slug: z.string().describe('Project slug to get status for')
});

export type GetProjectStatusInput = z.infer<typeof GetProjectStatusInput>;

export const mindspaceGetProjectStatusTool: Tool = {
  name: 'mindspace_get_project_status',
  description: `Get an overview of a Mindspace project.

Returns project info, member count, and (when available) task status distribution, active agents, pending approvals, and current focus.

Requires MINDSPACE_API_KEY to be configured.`,
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: {
        type: 'string',
        description: 'Project slug to get status for'
      }
    },
    required: ['project_slug']
  }
};

async function apiGet(path: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`${MINDSPACE_API_URL}${path}`, {
      method: 'GET',
      headers: { 'X-API-Key': MINDSPACE_API_KEY, 'Accept': 'application/json' }
    });
    if (!response.ok) return { ok: false, error: `${response.status} ${response.statusText}` };
    return { ok: true, data: await response.json() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function handleMindspaceGetProjectStatus(
  input: unknown
): Promise<ProjectStatusResult> {
  if (!MINDSPACE_API_KEY) {
    return { success: false, error: 'MINDSPACE_API_KEY not configured' };
  }

  const validated = GetProjectStatusInput.parse(input);
  const { project_slug } = validated;

  // Get project info
  const projectRes = await apiGet(`/api/projects/${project_slug}`);
  if (!projectRes.ok) {
    return { success: false, error: `Project not found: ${projectRes.error}` };
  }

  const result: ProjectStatusResult = {
    success: true,
    project: projectRes.data
  };

  // Get members (may not exist yet)
  const membersRes = await apiGet(`/api/projects/${project_slug}/members`);
  if (membersRes.ok) {
    result.member_count = Array.isArray(membersRes.data) ? membersRes.data.length : 0;
    result.members = membersRes.data;
  }

  // Future: task distribution, agents, approvals, focus
  // These endpoints don't exist yet — the tool will be extended as they're built

  return result;
}

export interface ProjectStatusResult {
  success: boolean;
  project?: any;
  member_count?: number;
  members?: any[];
  error?: string;
}
```

### File 2: `src/tools/index.ts` (UPDATE)

Add import and registry entry:
```typescript
import { mindspaceGetProjectStatusTool, handleMindspaceGetProjectStatus } from './mindspace/getProjectStatus.js';

// In tools array:
{
  definition: mindspaceGetProjectStatusTool,
  handler: async (args, _db, _pipeline) => handleMindspaceGetProjectStatus(args)
},
```

## Files Changed

1. `src/tools/mindspace/getProjectStatus.ts` — MCP tool definition + HTTP client handler (NEW)
2. `src/tools/index.ts` — import and register mindspace_get_project_status (UPDATE)

## Testing

1. `src/tools/mindspace/getProjectStatus.ts` exists
2. mindspaceGetProjectStatusTool exported with name 'mindspace_get_project_status'
3. handleMindspaceGetProjectStatus exported
4. Tool requires project_slug parameter (Zod validation)
5. Tool returns error when MINDSPACE_API_KEY not set
6. Tool calls GET /api/projects/:slug with X-API-Key header
7. Tool returns {success: true, project} on valid project
8. Tool returns {success: false, error} for unknown project
9. Tool calls GET /api/projects/:slug/members and includes member_count
10. Tool gracefully handles missing members endpoint (omits from response)
11. Tool registered in src/tools/index.ts tools array
12. inputSchema requires project_slug
