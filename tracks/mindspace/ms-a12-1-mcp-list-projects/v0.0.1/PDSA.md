# PDSA: mindspace_list_projects MCP tool

**Task:** ms-a12-1-mcp-list-projects
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Claude agents need to interact with the Mindspace API from within MCP conversations. Currently the only way to query projects is via direct HTTP calls or the CLI. An MCP tool wrapping the REST API lets Claude list projects naturally within a conversation, using the user's API key for authentication.

## Requirements (REQ-MCP-MINDSPACE-001)

> MCP tool definition in existing xpollination-mcp-server. Calls mindspace REST API with user's API key. AC: Tool callable from Claude conversation, returns correct data.

## Investigation

### Existing tool pattern

- **Tool registry:** `src/tools/index.ts` — `ToolDefinition[]` array with `{definition, handler}`
- **Tool file pattern:** Zod schema + JSON Schema inputSchema + handler function + result interface
- **Handler signature:** `async (args, db, pipeline) => handler(args, ...)`
- **Existing tools:** 8 PM tools (direct DB), 2 frame tools, 4 content tools, 1 publish tool

### New pattern: REST API client

This tool calls the Mindspace API via HTTP (not DB). Key differences from existing tools:
- Uses `fetch()` (Node 18+ built-in) to call `GET /api/projects` on the Mindspace API
- Requires `MINDSPACE_API_URL` env var (defaults to `http://localhost:3100`)
- Requires `MINDSPACE_API_KEY` env var for X-API-Key header authentication
- No direct DB access — tool is a REST client

### Design decisions

1. **Tool name:** `mindspace_list_projects` — prefixed with `mindspace_` to distinguish from existing PM tools
2. **HTTP client:** Node.js native `fetch()` — no new dependencies needed (Node 22)
3. **Auth:** X-API-Key header using `MINDSPACE_API_KEY` env var
4. **API URL:** `MINDSPACE_API_URL` env var, defaults to `http://localhost:3100`
5. **No input parameters** — list all projects. Filtering can be added later if needed.
6. **Error handling:** Returns structured error if API is unreachable or returns non-200
7. **Separate file:** `src/tools/mindspace/listProjects.ts` — new `mindspace/` category

## Design

### File 1: `src/tools/mindspace/listProjects.ts` (NEW)

```typescript
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

// No input required for list
const ListProjectsInput = z.object({});

export type ListProjectsInput = z.infer<typeof ListProjectsInput>;

export const mindspaceListProjectsTool: Tool = {
  name: 'mindspace_list_projects',
  description: `List all projects in the Mindspace system.

Returns an array of projects with id, slug, name, description, created_at, and created_by.
Requires MINDSPACE_API_KEY to be configured.`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

export async function handleMindspaceListProjects(
  _input: unknown
): Promise<ListProjectsResult> {
  if (!MINDSPACE_API_KEY) {
    return {
      success: false,
      error: 'MINDSPACE_API_KEY not configured'
    };
  }

  try {
    const response = await fetch(`${MINDSPACE_API_URL}/api/projects`, {
      method: 'GET',
      headers: {
        'X-API-Key': MINDSPACE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API returned ${response.status}: ${response.statusText}`
      };
    }

    const projects = await response.json();
    return {
      success: true,
      count: Array.isArray(projects) ? projects.length : 0,
      projects
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to reach Mindspace API: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

export interface ListProjectsResult {
  success: boolean;
  count?: number;
  projects?: any[];
  error?: string;
}
```

### File 2: `src/tools/index.ts` (UPDATE)

Add import and registry entry:
```typescript
import { mindspaceListProjectsTool, handleMindspaceListProjects } from './mindspace/listProjects.js';

// In tools array:
{
  definition: mindspaceListProjectsTool,
  handler: async (args, _db, _pipeline) => handleMindspaceListProjects(args)
},
```

## Files Changed

1. `src/tools/mindspace/listProjects.ts` — MCP tool definition + HTTP client handler (NEW)
2. `src/tools/index.ts` — import and register mindspace_list_projects (UPDATE)

## Testing

1. `src/tools/mindspace/listProjects.ts` exists
2. mindspaceListProjectsTool exported with name 'mindspace_list_projects'
3. handleMindspaceListProjects exported
4. Tool returns error when MINDSPACE_API_KEY not set
5. Tool calls GET /api/projects with X-API-Key header
6. Tool returns {success: true, count, projects} on 200 response
7. Tool returns {success: false, error} on non-200 response
8. Tool returns {success: false, error} on network failure
9. Tool registered in src/tools/index.ts tools array
10. Tool definition has correct inputSchema (empty object)
11. Handler ignores input parameters
12. Response includes project count
