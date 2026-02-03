/**
 * PM Get Valid Transitions Tool
 *
 * Returns valid status transitions for a node.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';
import { getValidTransitions, NodeType, NodeStatus } from '../../workflow/StateMachineValidator.js';
import { getWorkActors, getTransitionActors } from '../../workflow/AgentPermissions.js';

// Input validation schema
const GetValidTransitionsInput = z.object({
  id: z.string().optional().describe('Node ID (to get transitions for existing node)'),
  type: z.enum(['task', 'group', 'decision', 'requirement', 'design', 'test']).optional()
    .describe('Node type (if not using ID)'),
  status: z.enum(['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled']).optional()
    .describe('Current status (if not using ID)')
}).refine(data => data.id || (data.type && data.status), {
  message: 'Either id, or both type and status must be provided'
});

export type GetValidTransitionsInput = z.infer<typeof GetValidTransitionsInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmGetValidTransitionsTool: Tool = {
  name: 'pm_get_valid_transitions',
  description: `Get valid status transitions for a node.

Can be used two ways:
1. By node ID: Get transitions for an existing node
2. By type + status: Get transitions for a hypothetical node

Returns:
- valid_transitions: Statuses the node can transition to
- work_actors: Who can work on the node at current status
- transition_actors: Who can trigger transitions from current status`,
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Node ID (to get transitions for existing node)'
      },
      type: {
        type: 'string',
        enum: ['task', 'group', 'decision', 'requirement', 'design', 'test'],
        description: 'Node type (if not using ID)'
      },
      status: {
        type: 'string',
        enum: ['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'],
        description: 'Current status (if not using ID)'
      }
    }
  }
};

/**
 * Handle the pm_get_valid_transitions tool call
 */
export async function handlePmGetValidTransitions(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<GetValidTransitionsResult> {
  // Validate input
  const validated = GetValidTransitionsInput.parse(input);

  let nodeType: NodeType;
  let currentStatus: NodeStatus;
  let nodeId: string | undefined;

  if (validated.id) {
    // Get from existing node
    const node = await repo.findById(validated.id);
    if (!node) {
      return {
        success: false,
        error: `Node not found: ${validated.id}`
      };
    }
    nodeType = node.type;
    currentStatus = node.status;
    nodeId = node.id;
  } else {
    // Use provided type and status
    nodeType = validated.type as NodeType;
    currentStatus = validated.status as NodeStatus;
  }

  // Get valid transitions
  const validTransitions = getValidTransitions(nodeType, currentStatus);

  // Get actors who can work/transition
  const workActors = getWorkActors(nodeType, currentStatus);
  const transitionActors = getTransitionActors(currentStatus);

  return {
    success: true,
    node_id: nodeId,
    type: nodeType,
    current_status: currentStatus,
    valid_transitions: validTransitions,
    work_actors: workActors,
    transition_actors: transitionActors
  };
}

export interface GetValidTransitionsResult {
  success: boolean;
  node_id?: string;
  type?: string;
  current_status?: string;
  valid_transitions?: string[];
  work_actors?: string[];
  transition_actors?: string[];
  error?: string;
}
