/**
 * mindspace_create_task MCP Tool
 *
 * Creates a task in a project via POST to tasks API.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const createTaskTool: Tool = {
  name: 'mindspace_create_task',
  description: 'Create a new task in a project. Accepts title (required), optional description, current_role (pdsa/dev/qa/liaison), requirement_id, and feature_flag_name. Defaults to status=pending.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: {
        type: 'string',
        description: 'The project slug'
      },
      title: {
        type: 'string',
        description: 'Task title (required)'
      },
      description: {
        type: 'string',
        description: 'Task description'
      },
      current_role: {
        type: 'string',
        enum: ['pdsa', 'dev', 'qa', 'liaison'],
        description: 'Initial role assignment'
      },
      requirement_id: {
        type: 'string',
        description: 'Link to a requirement UUID'
      },
      feature_flag_name: {
        type: 'string',
        description: 'Feature flag name for this task'
      }
    },
    required: ['project_slug', 'title']
  }
};

export async function handleCreateTask(
  input: {
    project_slug: string;
    title: string;
    description?: string;
    current_role?: string;
    requirement_id?: string;
    feature_flag_name?: string;
  }
): Promise<any> {
  const { project_slug, title, description, current_role, requirement_id, feature_flag_name } = input;

  const url = `${MINDSPACE_API_URL}/api/projects/${project_slug}/tasks`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MINDSPACE_API_KEY,
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      title,
      description: description || undefined,
      current_role: current_role || undefined,
      requirement_id: requirement_id || undefined,
      feature_flag_name: feature_flag_name || undefined
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Failed to create task: ${(error as any).error || response.statusText}`);
  }

  return await response.json();
}
