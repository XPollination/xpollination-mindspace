/**
 * mindspace_create_requirement MCP Tool
 *
 * Creates a requirement in a project via POST to requirements API.
 * Handles 409 duplicate req_id_human conflict.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const createRequirementTool: Tool = {
  name: 'mindspace_create_requirement',
  description: 'Create a new requirement in a project. Requires req_id_human and title. Optional status (draft/active/deprecated, default draft) and priority (low/medium/high/critical, default medium). Returns 409 if req_id_human already exists.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: {
        type: 'string',
        description: 'The project slug'
      },
      req_id_human: {
        type: 'string',
        description: 'Human-readable requirement ID (e.g., REQ-001)'
      },
      title: {
        type: 'string',
        description: 'Requirement title'
      },
      description: {
        type: 'string',
        description: 'Requirement description'
      },
      status: {
        type: 'string',
        enum: ['draft', 'active', 'deprecated'],
        description: 'Requirement status (default: draft)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Requirement priority (default: medium)'
      }
    },
    required: ['project_slug', 'req_id_human', 'title']
  }
};

export async function handleCreateRequirement(
  input: {
    project_slug: string;
    req_id_human: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
  }
): Promise<any> {
  const { project_slug, req_id_human, title, description, status, priority } = input;

  const url = `${MINDSPACE_API_URL}/api/projects/${project_slug}/requirements`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MINDSPACE_API_KEY,
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      req_id_human,
      title,
      description: description || undefined,
      status: status || undefined,
      priority: priority || undefined
    })
  });

  if (response.status === 409) {
    throw new Error(`Duplicate: req_id_human '${req_id_human}' already exists in project ${project_slug}`);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Failed to create requirement: ${(error as any).error || response.statusText}`);
  }

  return await response.json();
}
