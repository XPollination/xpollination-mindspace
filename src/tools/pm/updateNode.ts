/**
 * PM Update Node Tool
 *
 * Updates a node's DNA or metadata (not status - use pm_transition for that).
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';
import { NodeDna } from '../../workflow/mindspace/DnaValidator.js';
import { Actor } from '../../workflow/StateMachineValidator.js';

// Input validation schema
const UpdateNodeInput = z.object({
  id: z.string().describe('Node ID to update'),
  slug: z.string().optional().describe('New slug (if changing)'),
  parent_ids: z.array(z.string()).optional().describe('New parent IDs'),
  dna: z.record(z.unknown()).optional().describe('DNA fields to update (merged with existing)'),
  actor: z.enum(['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system']).optional()
    .describe('Actor performing the update (defaults to system)')
});

export type UpdateNodeInput = z.infer<typeof UpdateNodeInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmUpdateNodeTool: Tool = {
  name: 'pm_update_node',
  description: `Update a node's DNA or metadata in the mindspace DAG.

Use this to update:
- slug: Change the human-readable identifier
- parent_ids: Change DAG structure
- dna: Update title, description, or type-specific fields

NOTE: To change node status, use pm_transition instead.`,
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Node ID to update'
      },
      slug: {
        type: 'string',
        description: 'New slug (if changing)'
      },
      parent_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'New parent IDs'
      },
      dna: {
        type: 'object',
        description: 'DNA fields to update (merged with existing)'
      },
      actor: {
        type: 'string',
        enum: ['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system'],
        description: 'Actor performing the update'
      }
    },
    required: ['id']
  }
};

/**
 * Handle the pm_update_node tool call
 */
export async function handlePmUpdateNode(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<UpdateNodeResult> {
  // Validate input
  const validated = UpdateNodeInput.parse(input);
  const actor = (validated.actor || 'system') as Actor;

  // Get existing node
  const existing = await repo.findById(validated.id);
  if (!existing) {
    return {
      success: false,
      error: `Node not found: ${validated.id}`
    };
  }

  // Merge DNA if provided
  let newDna: NodeDna | undefined;
  if (validated.dna) {
    const existingDna = repo.getDna(existing);
    newDna = {
      ...existingDna,
      ...validated.dna
    } as NodeDna;
  }

  // Build update object
  const updateData: {
    slug?: string;
    parent_ids?: string[];
    dna?: NodeDna;
  } = {};

  if (validated.slug) updateData.slug = validated.slug;
  if (validated.parent_ids) updateData.parent_ids = validated.parent_ids;
  if (newDna) updateData.dna = newDna;

  // Nothing to update
  if (Object.keys(updateData).length === 0) {
    return {
      success: true,
      nodeId: validated.id,
      message: 'No changes specified'
    };
  }

  // Perform update
  const result = await repo.update(validated.id, updateData, actor);

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to update node'
    };
  }

  return {
    success: true,
    nodeId: validated.id,
    message: `Node updated successfully`
  };
}

export interface UpdateNodeResult {
  success: boolean;
  nodeId?: string;
  message?: string;
  error?: string;
}
