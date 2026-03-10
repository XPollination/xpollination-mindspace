# PDSA: mindspace_create_requirement MCP Tool

**Task:** ms-a12-5-mcp-create-req
**Status:** Design
**Version:** v0.0.1

## Plan

Create an MCP tool that creates a requirement via the Mindspace REST API. Accepts project_slug, req_id_human, title, description, status, and priority. Returns the created requirement with its generated ID.

### Dependencies

- **ms-a4-1-requirements-crud** (complete): Requirements CRUD endpoints
- **t1-3-repos-bootstrap** (complete)

### Investigation

**Requirements POST endpoint** (`POST /api/projects/:slug/requirements`):
- Required: `req_id_human`, `title`
- Optional: `description`, `status` (draft/active/deprecated, default: draft), `priority` (low/medium/high/critical, default: medium), `current_version`
- Returns 201 with created requirement
- Returns 409 if `req_id_human` already exists in project

**Design decisions:**
- Follows same pattern as listProjects.ts and createTask.ts
- Input matches REST API fields
- Returns created requirement with message

## Do

### File Changes

#### 1. `src/tools/mindspace/createRequirement.ts` (NEW)

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const createRequirementInputSchema = z.object({
  project_slug: z.string().describe('Project slug'),
  req_id_human: z.string().describe('Human-readable requirement ID (e.g., REQ-AUTH-001)'),
  title: z.string().describe('Requirement title'),
  description: z.string().optional().describe('Requirement description'),
  status: z.enum(['draft', 'active', 'deprecated']).optional().describe('Status (default: draft)'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Priority (default: medium)')
});

export const createRequirementTool: Tool = {
  name: 'mindspace_create_requirement',
  description: 'Create a new requirement in a Mindspace project. Requirements define what must be built. Specify a human-readable ID (e.g., REQ-AUTH-001), title, and optional description/status/priority. Returns the created requirement.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: { type: 'string', description: 'Project slug' },
      req_id_human: { type: 'string', description: 'Human-readable requirement ID (e.g., REQ-AUTH-001)' },
      title: { type: 'string', description: 'Requirement title' },
      description: { type: 'string', description: 'Requirement description' },
      status: { type: 'string', enum: ['draft', 'active', 'deprecated'], description: 'Status (default: draft)' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priority (default: medium)' }
    },
    required: ['project_slug', 'req_id_human', 'title']
  }
};

export async function handleCreateRequirement(input: {
  project_slug: string;
  req_id_human: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
}): Promise<CreateRequirementResult> {
  const { project_slug, ...body } = input;

  const response = await fetch(`${MINDSPACE_API_URL}/api/projects/${project_slug}/requirements`, {
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
    throw new Error(`Failed to create requirement: ${(error as any).error || response.statusText}`);
  }

  const requirement = await response.json() as any;

  return {
    requirement,
    message: `Created requirement "${requirement.title}" [${requirement.req_id_human}] in project ${project_slug}`
  };
}

export interface CreateRequirementResult {
  requirement: any;
  message: string;
}
```

#### 2. `src/tools/index.ts` (UPDATE)

```typescript
// Add import:
import { createRequirementTool, handleCreateRequirement } from './mindspace/createRequirement.js';

// Add to tools array:
{
  definition: createRequirementTool,
  handler: async (args) => handleCreateRequirement(args as any)
},
```

## Study

### Test Cases (10 total)

**Successful creation (4):**
1. Creates requirement with req_id_human and title, returns created object
2. Creates requirement with all optional fields (description, status, priority)
3. Status defaults to 'draft' when not specified
4. Priority defaults to 'medium' when not specified

**Validation (3):**
5. Requires project_slug
6. Requires req_id_human and title
7. Duplicate req_id_human in same project returns 409 error

**Error handling (3):**
8. Non-existent project returns descriptive error
9. Invalid status value rejected by API
10. Invalid priority value rejected by API

## Act

### Deployment

- 2 files: createRequirement.ts (NEW), index.ts (UPDATE)
- Follows existing MCP tool pattern
