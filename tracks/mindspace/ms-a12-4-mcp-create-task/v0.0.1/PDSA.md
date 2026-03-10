# PDSA: mindspace_create_task MCP Tool

**Task:** ms-a12-4-mcp-create-task
**Status:** Design
**Version:** v0.0.1

## Plan

Create an MCP tool that creates a task via the Mindspace REST API. Accepts title, description, role, requirement_id, and optional blocked_by (dependency task IDs). Returns the created task.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks CRUD endpoints
- **t1-3-repos-bootstrap** (complete)

### Investigation

**Existing pattern** (from `src/tools/mindspace/listProjects.ts`):
- `fetch()` with `X-API-Key` header
- Zod input schema, Tool definition
- Env vars: `MINDSPACE_API_URL`, `MINDSPACE_API_KEY`

**Tasks POST endpoint** (`POST /api/projects/:slug/tasks`):
- Required: `title`
- Optional: `description`, `requirement_id`, `status`, `current_role`, `feature_flag_name`
- Returns 201 with created task

**Design decisions:**
- Input: `project_slug`, `title`, `description`, `current_role`, `requirement_id`, `feature_flag_name`
- The DNA mentions "auto-generates feature flag" but this is handled by ms-a10-2 (auto-create flag on task creation). This tool simply passes through the feature_flag_name field.
- `blocked_by` is listed in DNA but the dependency endpoint (ms-a8-1) is a separate POST. This tool does NOT auto-create dependencies — it creates the task and returns it. Dependency creation is a separate step.

## Do

### File Changes

#### 1. `src/tools/mindspace/createTask.ts` (NEW)

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const createTaskInputSchema = z.object({
  project_slug: z.string().describe('Project slug'),
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  current_role: z.enum(['pdsa', 'dev', 'qa', 'liaison']).optional().describe('Initial role assignment'),
  requirement_id: z.string().optional().describe('Parent requirement UUID'),
  feature_flag_name: z.string().optional().describe('Feature flag name for this task')
});

export const createTaskTool: Tool = {
  name: 'mindspace_create_task',
  description: 'Create a new task in a Mindspace project. Specify title, optional description, role assignment, parent requirement, and feature flag name. Returns the created task with its generated ID.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: { type: 'string', description: 'Project slug' },
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description' },
      current_role: { type: 'string', enum: ['pdsa', 'dev', 'qa', 'liaison'], description: 'Initial role assignment' },
      requirement_id: { type: 'string', description: 'Parent requirement UUID' },
      feature_flag_name: { type: 'string', description: 'Feature flag name' }
    },
    required: ['project_slug', 'title']
  }
};

export async function handleCreateTask(input: {
  project_slug: string;
  title: string;
  description?: string;
  current_role?: string;
  requirement_id?: string;
  feature_flag_name?: string;
}): Promise<CreateTaskResult> {
  const { project_slug, ...body } = input;

  const response = await fetch(`${MINDSPACE_API_URL}/api/projects/${project_slug}/tasks`, {
    method: 'POST',
    headers: {
      'X-API-Key': MINDSPACE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Failed to create task: ${(error as any).error || response.statusText}`);
  }

  const task = await response.json() as any;

  return {
    task,
    message: `Created task "${task.title}" [${task.id}] in project ${project_slug}`
  };
}

export interface CreateTaskResult {
  task: any;
  message: string;
}
```

#### 2. `src/tools/index.ts` (UPDATE)

```typescript
// Add import:
import { createTaskTool, handleCreateTask } from './mindspace/createTask.js';

// Add to tools array:
{
  definition: createTaskTool,
  handler: async (args) => handleCreateTask(args as any)
},
```

## Study

### Test Cases (10 total)

**Successful creation (4):**
1. Creates task with title only, returns 201 response
2. Creates task with all optional fields (description, current_role, requirement_id, feature_flag_name)
3. Returns created task with generated UUID
4. Task status defaults to 'pending'

**Validation (3):**
5. Requires project_slug
6. Requires title
7. Invalid current_role rejected by API

**Error handling (3):**
8. Non-existent project returns descriptive error
9. API authentication failure shows clear error
10. Network error handled gracefully

## Act

### Deployment

- 2 files: createTask.ts (NEW), index.ts (UPDATE)
- Follows existing MCP tool pattern
- Does NOT auto-create dependencies (separate step via ms-a8-1)
