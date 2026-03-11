/**
 * mindspace_set_focus MCP Tool
 *
 * Sets or updates the project focus scope and task list.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const setFocusTool: Tool = {
  name: 'mindspace_set_focus',
  description: 'Set or update the project focus scope and optional task IDs. Makes a PUT request to the focus endpoint.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: {
        type: 'string',
        description: 'The project slug'
      },
      scope: {
        type: 'string',
        description: 'The focus scope description'
      },
      task_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional array of task IDs to include in focus'
      }
    },
    required: ['project_slug', 'scope']
  }
};

export async function handleSetFocus(
  input: {
    project_slug: string;
    scope: string;
    task_ids?: string[];
  }
): Promise<any> {
  const { project_slug, scope, task_ids } = input;

  const url = `${MINDSPACE_API_URL}/api/projects/${project_slug}/focus`;

  const body: any = { scope };
  if (task_ids) body.task_ids = task_ids;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MINDSPACE_API_KEY,
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Failed to set focus: ${(error as any).error || response.statusText}`);
  }

  const result = await response.json();
  return result;
}
