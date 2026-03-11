/**
 * mindspace_transition_task MCP Tool
 *
 * Executes a task status transition via the Mindspace API.
 * Surfaces approval_request_id when human gate is hit.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const transitionTaskTool: Tool = {
  name: 'mindspace_transition_task',
  description: 'Execute a task status transition. Returns transition result including approval_request_id if human gate is triggered.',
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
      },
      to_status: {
        type: 'string',
        description: 'Target status for the transition'
      },
      actor: {
        type: 'string',
        description: 'The actor performing the transition (e.g., dev, pdsa, qa, liaison)'
      },
      reason: {
        type: 'string',
        description: 'Optional reason for the transition'
      }
    },
    required: ['project_slug', 'task_id', 'to_status', 'actor']
  }
};

export async function handleTransitionTask(
  input: {
    project_slug: string;
    task_id: string;
    to_status: string;
    actor: string;
    reason?: string;
  }
): Promise<any> {
  const { project_slug, task_id, to_status, actor, reason } = input;

  const url = `${MINDSPACE_API_URL}/api/projects/${project_slug}/tasks/${task_id}/transition`;

  const body: any = { to_status, actor };
  if (reason) body.reason = reason;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MINDSPACE_API_KEY,
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Transition failed: ${(error as any).error || response.statusText}`);
  }

  const result = await response.json() as any;

  // Surface approval_request_id when human gate is hit
  if (result.approval_request_id) {
    return {
      ...result,
      message: `Transition to ${to_status} triggered approval gate. Approval request: ${result.approval_request_id}`
    };
  }

  return result;
}
