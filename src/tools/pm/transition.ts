/**
 * PM Transition Tool
 *
 * Transitions a node to a new status with validation.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';
import { NodeStatus, Actor, getValidTransitions } from '../../workflow/StateMachineValidator.js';

// Input validation schema
const TransitionInput = z.object({
  id: z.string().describe('Node ID to transition'),
  to_status: z.enum(['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'])
    .describe('Target status'),
  actor: z.enum(['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system'])
    .describe('Actor performing the transition')
});

export type TransitionInput = z.infer<typeof TransitionInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmTransitionTool: Tool = {
  name: 'pm_transition',
  description: `Transition a node to a new status.

Valid transitions depend on node type and current status.
The system validates:
1. Transition is valid for the node type
2. Actor has permission to perform the transition

Common workflows:
- Task: pending → ready → active → review → complete
- Decision: pending → ready → active → complete (no review)
- Group: pending → active → complete (simplified)

Use pm_get_valid_transitions to see available transitions.`,
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Node ID to transition'
      },
      to_status: {
        type: 'string',
        enum: ['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'],
        description: 'Target status'
      },
      actor: {
        type: 'string',
        enum: ['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system'],
        description: 'Actor performing the transition'
      }
    },
    required: ['id', 'to_status', 'actor']
  }
};

/**
 * Handle the pm_transition tool call
 */
export async function handlePmTransition(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<TransitionResult> {
  // Validate input
  const validated = TransitionInput.parse(input);

  // Get existing node
  const existing = await repo.findById(validated.id);
  if (!existing) {
    return {
      success: false,
      error: `Node not found: ${validated.id}`
    };
  }

  const fromStatus = existing.status;
  const toStatus = validated.to_status as NodeStatus;
  const actor = validated.actor as Actor;

  // Perform transition (validation happens in repository)
  const result = await repo.transition(validated.id, toStatus, actor);

  if (!result.success) {
    // Get valid transitions for helpful error message
    const validTargets = getValidTransitions(existing.type, fromStatus);
    return {
      success: false,
      error: result.error,
      current_status: fromStatus,
      valid_transitions: validTargets
    };
  }

  return {
    success: true,
    nodeId: validated.id,
    from_status: fromStatus,
    to_status: toStatus,
    message: `Node transitioned from ${fromStatus} to ${toStatus}`
  };
}

export interface TransitionResult {
  success: boolean;
  nodeId?: string;
  from_status?: string;
  to_status?: string;
  current_status?: string;
  valid_transitions?: string[];
  message?: string;
  error?: string;
}
