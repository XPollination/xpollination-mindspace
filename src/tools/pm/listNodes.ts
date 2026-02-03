/**
 * PM List Nodes Tool
 *
 * Lists nodes with optional filtering.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';
import { NodeType, NodeStatus } from '../../workflow/StateMachineValidator.js';

// Input validation schema
const ListNodesInput = z.object({
  type: z.enum(['task', 'group', 'decision', 'requirement', 'design', 'test']).optional()
    .describe('Filter by node type'),
  status: z.enum(['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled']).optional()
    .describe('Filter by status'),
  limit: z.number().min(1).max(100).optional()
    .describe('Maximum number of nodes to return (default 50)')
});

export type ListNodesInput = z.infer<typeof ListNodesInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmListNodesTool: Tool = {
  name: 'pm_list_nodes',
  description: `List nodes in the mindspace DAG with optional filtering.

Can filter by:
- type: task, group, decision, requirement, design, test
- status: pending, ready, active, review, rework, complete, blocked, cancelled

Returns a summary of each node (id, type, status, slug, title).`,
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['task', 'group', 'decision', 'requirement', 'design', 'test'],
        description: 'Filter by node type'
      },
      status: {
        type: 'string',
        enum: ['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'],
        description: 'Filter by status'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of nodes to return (default 50)'
      }
    }
  }
};

/**
 * Handle the pm_list_nodes tool call
 */
export async function handlePmListNodes(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<ListNodesResult> {
  // Validate input
  const validated = ListNodesInput.parse(input);
  const limit = validated.limit || 50;

  // Get nodes based on filters
  let nodes;
  if (validated.type && validated.status) {
    // Both filters - need to filter in memory
    const byType = await repo.findByType(validated.type as NodeType);
    nodes = byType.filter(n => n.status === validated.status);
  } else if (validated.type) {
    nodes = await repo.findByType(validated.type as NodeType);
  } else if (validated.status) {
    nodes = await repo.findByStatus(validated.status as NodeStatus);
  } else {
    nodes = await repo.findAll();
  }

  // Apply limit
  nodes = nodes.slice(0, limit);

  // Map to summary format
  const summaries = nodes.map(node => {
    const dna = repo.getDna(node);
    return {
      id: node.id,
      type: node.type,
      status: node.status,
      slug: node.slug,
      title: (dna as any).title || ''
    };
  });

  return {
    success: true,
    count: summaries.length,
    nodes: summaries
  };
}

export interface ListNodesResult {
  success: boolean;
  count?: number;
  nodes?: Array<{
    id: string;
    type: string;
    status: string;
    slug: string;
    title: string;
  }>;
  error?: string;
}
