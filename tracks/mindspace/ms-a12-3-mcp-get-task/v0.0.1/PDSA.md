# PDSA: mindspace_get_task MCP Tool

**Task:** ms-a12-3-mcp-get-task
**Status:** Design
**Version:** v0.0.1

## Plan

Create an MCP tool that returns complete task detail from the Mindspace API: task fields, parent requirement info, dependencies, claim status, transition history, and related brain thoughts.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks CRUD endpoints
- **t1-3-repos-bootstrap** (complete)

### Investigation

**Existing MCP tool pattern** (from `src/tools/mindspace/listProjects.ts`):
- Uses `fetch()` to call Mindspace REST API
- Auth via `X-API-Key` header from `MINDSPACE_API_KEY` env var
- Zod schema for input validation
- Tool definition with `inputSchema` for MCP SDK
- Returns typed result object

**Available REST endpoints:**
- `GET /api/projects/:slug/tasks/:taskId` — single task
- `GET /api/projects/:slug/requirements/:reqId` — requirement detail (for enrichment)
- Dependencies, transitions, brain thoughts — future endpoints, graceful degradation

**Design decisions:**
- Accepts `project_slug` and `task_id` as input
- Fetches task from REST API
- Enriches with requirement info if `requirement_id` is set (parallel fetch)
- Dependencies, transitions, brain thoughts: graceful degradation (returns null if endpoints not yet available)
- Follows same `apiGet` helper pattern as `getProjectStatus.ts`

## Do

### File Changes

#### 1. `src/tools/mindspace/getTask.ts` (NEW)

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const getTaskInputSchema = z.object({
  project_slug: z.string().describe('Project slug'),
  task_id: z.string().describe('Task ID (UUID)')
});

export const getTaskTool: Tool = {
  name: 'mindspace_get_task',
  description: 'Get complete task detail including DNA, parent requirement, dependencies, claim status, transition history, and related brain thoughts. Returns comprehensive task information for inspection or decision-making.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: { type: 'string', description: 'Project slug' },
      task_id: { type: 'string', description: 'Task ID (UUID)' }
    },
    required: ['project_slug', 'task_id']
  }
};

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${MINDSPACE_API_URL}${path}`, {
      method: 'GET',
      headers: { 'X-API-Key': MINDSPACE_API_KEY, 'Accept': 'application/json' }
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export async function handleGetTask(input: { project_slug: string; task_id: string }): Promise<GetTaskResult> {
  const { project_slug, task_id } = input;

  // Fetch task
  const task = await apiGet<any>(`/api/projects/${project_slug}/tasks/${task_id}`);
  if (!task) {
    throw new Error(`Task not found: ${task_id} in project ${project_slug}`);
  }

  // Enrich with requirement info (graceful)
  let requirement = null;
  if (task.requirement_id) {
    requirement = await apiGet<any>(`/api/projects/${project_slug}/requirements/${task.requirement_id}`);
  }

  // Future endpoints — graceful degradation
  const dependencies = await apiGet<any>(`/api/projects/${project_slug}/tasks/${task_id}/dependencies`);
  const transitions = await apiGet<any>(`/api/projects/${project_slug}/tasks/${task_id}/transitions`);

  return {
    task,
    requirement: requirement ? {
      id: requirement.id,
      req_id_human: requirement.req_id_human,
      title: requirement.title,
      status: requirement.status,
      priority: requirement.priority
    } : null,
    dependencies: dependencies || { available: false, message: 'Dependency endpoints not yet deployed' },
    transitions: transitions || { available: false, message: 'Transition history not yet deployed' },
    message: `Task "${task.title}" [${task.status}] in project ${project_slug}`
  };
}

export interface GetTaskResult {
  task: any;
  requirement: any;
  dependencies: any;
  transitions: any;
  message: string;
}
```

#### 2. `src/tools/index.ts` (UPDATE)

```typescript
// Add import:
import { getTaskTool, handleGetTask } from './mindspace/getTask.js';

// Add to tools array:
{
  definition: getTaskTool,
  handler: async (args) => handleGetTask(args as { project_slug: string; task_id: string })
},
```

## Study

### Test Cases (10 total)

**Basic fetch (3):**
1. Returns complete task object for valid project_slug + task_id
2. Throws error for non-existent task
3. Returns task with all fields (id, title, status, current_role, etc.)

**Requirement enrichment (3):**
4. Includes requirement object when task has requirement_id
5. Requirement includes req_id_human, title, status, priority
6. Returns requirement:null when task has no requirement_id

**Graceful degradation (2):**
7. Returns available:false for dependencies when endpoint not deployed
8. Returns available:false for transitions when endpoint not deployed

**Input validation (2):**
9. Requires project_slug parameter
10. Requires task_id parameter

## Act

### Deployment

- 2 files: getTask.ts (NEW), index.ts (UPDATE)
- Follows existing MCP tool pattern (fetch + X-API-Key auth)
- Graceful degradation for future endpoints
