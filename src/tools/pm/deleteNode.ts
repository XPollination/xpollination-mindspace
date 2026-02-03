/**
 * PM Delete Node Tool
 *
 * Deletes a node from the mindspace DAG.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';
import { getDependents } from '../../workflow/mindspace/DnaLinkResolver.js';

// Input validation schema
const DeleteNodeInput = z.object({
  id: z.string().describe('Node ID to delete'),
  force: z.boolean().optional()
    .describe('Force delete even if other nodes depend on this one')
});

export type DeleteNodeInput = z.infer<typeof DeleteNodeInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmDeleteNodeTool: Tool = {
  name: 'pm_delete_node',
  description: `Delete a node from the mindspace DAG.

By default, deletion is blocked if other nodes depend on this node.
Use force=true to delete anyway (dependents will have broken links).

WARNING: This is a hard delete. The node cannot be recovered.`,
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Node ID to delete'
      },
      force: {
        type: 'boolean',
        description: 'Force delete even if other nodes depend on this one'
      }
    },
    required: ['id']
  }
};

/**
 * Handle the pm_delete_node tool call
 */
export async function handlePmDeleteNode(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<DeleteNodeResult> {
  // Validate input
  const validated = DeleteNodeInput.parse(input);

  // Check if node exists
  const existing = await repo.findById(validated.id);
  if (!existing) {
    return {
      success: false,
      error: `Node not found: ${validated.id}`
    };
  }

  // Check for dependents unless force=true
  if (!validated.force) {
    const getAllNodes = async () => {
      const nodes = await repo.findAll();
      return nodes.map(n => ({ id: n.id, dna_json: n.dna_json }));
    };

    const dependents = await getDependents(validated.id, getAllNodes);

    if (dependents.length > 0) {
      return {
        success: false,
        error: `Cannot delete: ${dependents.length} node(s) depend on this node`,
        dependents
      };
    }
  }

  // Perform deletion
  const result = await repo.delete(validated.id);

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to delete node'
    };
  }

  return {
    success: true,
    nodeId: validated.id,
    message: `Node ${validated.id} deleted successfully`
  };
}

export interface DeleteNodeResult {
  success: boolean;
  nodeId?: string;
  message?: string;
  dependents?: string[];
  error?: string;
}
