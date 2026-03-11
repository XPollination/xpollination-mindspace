/**
 * mindspace_get_task MCP Tool
 *
 * Returns full task detail with enrichment from requirement,
 * dependencies, and transitions. Graceful degradation for unavailable endpoints.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const getTaskTool: Tool = {
  name: 'mindspace_get_task',
  description: 'Get full task detail including DNA, parent requirement, dependencies, claim status, and transition history. Gracefully degrades when some data sources are unavailable.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: {
        type: 'string',
        description: 'The project slug'
      },
      task_id: {
        type: 'string',
        description: 'The task ID (UUID)'
      }
    },
    required: ['project_slug', 'task_id']
  }
};

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const url = `${MINDSPACE_API_URL}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': MINDSPACE_API_KEY,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export async function handleGetTask(
  input: { project_slug: string; task_id: string }
): Promise<any> {
  const { project_slug, task_id } = input;

  // Fetch task
  const task = await apiGet<any>(`/api/projects/${project_slug}/tasks/${task_id}`);
  if (!task) {
    throw new Error(`Task not found: ${task_id} in project ${project_slug}`);
  }

  // Enrich with requirement if requirement_id present (graceful degradation)
  let requirement = null;
  if (task.requirement_id) {
    try {
      requirement = await apiGet<any>(`/api/projects/${project_slug}/requirements/${task.requirement_id}`);
    } catch {
      // Graceful degradation: requirement endpoint may not exist yet
    }
  }

  // Fetch dependencies (graceful degradation — catch 404)
  let dependencies = null;
  try {
    dependencies = await apiGet<any>(`/api/projects/${project_slug}/tasks/${task_id}/dependencies`);
  } catch {
    // Graceful degradation
  }

  // Fetch transition history (graceful degradation — catch 404)
  let transitions = null;
  try {
    transitions = await apiGet<any>(`/api/projects/${project_slug}/tasks/${task_id}/transition`);
  } catch {
    // Graceful degradation
  }

  return {
    ...task,
    requirement: requirement || undefined,
    dependencies: dependencies || undefined,
    transitions: transitions || undefined
  };
}
