/**
 * mindspace_list_tasks MCP Tool
 *
 * Lists tasks for a project with optional filters.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const listTasksTool: Tool = {
  name: 'mindspace_list_tasks',
  description: 'List tasks for a project with optional filters for status, role, available_only, and blocked_only.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: {
        type: 'string',
        description: 'The project slug'
      },
      status: {
        type: 'string',
        description: 'Filter by task status'
      },
      current_role: {
        type: 'string',
        description: 'Filter by current role (pdsa, dev, qa, liaison)'
      },
      available_only: {
        type: 'boolean',
        description: 'Only show unclaimed, unblocked tasks'
      },
      blocked_only: {
        type: 'boolean',
        description: 'Only show tasks with incomplete dependencies'
      }
    },
    required: ['project_slug']
  }
};

export async function handleListTasks(
  input: {
    project_slug: string;
    status?: string;
    current_role?: string;
    available_only?: boolean;
    blocked_only?: boolean;
  }
): Promise<any> {
  const { project_slug, status, current_role, available_only, blocked_only } = input;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (current_role) params.set('current_role', current_role);
  if (available_only) params.set('available_only', 'true');
  if (blocked_only) params.set('blocked_only', 'true');

  const query = params.toString();
  const url = `${MINDSPACE_API_URL}/api/projects/${project_slug}/tasks${query ? '?' + query : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': MINDSPACE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to list tasks: ${response.status} ${response.statusText}`);
  }

  const tasks = await response.json();
  return {
    count: Array.isArray(tasks) ? tasks.length : 0,
    tasks,
    project_slug
  };
}
