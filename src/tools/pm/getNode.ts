/**
 * PM Get Node Tool
 *
 * Retrieves a node by ID or slug.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';

// Input validation schema
const GetNodeInput = z.object({
  id: z.string().optional().describe('Node ID'),
  slug: z.string().optional().describe('Node slug')
}).refine(data => data.id || data.slug, {
  message: 'Either id or slug must be provided'
});

export type GetNodeInput = z.infer<typeof GetNodeInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmGetNodeTool: Tool = {
  name: 'pm_get_node',
  description: `Get a node from the mindspace DAG by ID or slug.

Returns the full node including:
- ID, type, status, slug
- Parent IDs (DAG structure)
- DNA (title, description, type-specific fields)
- Timestamps`,
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Node ID'
      },
      slug: {
        type: 'string',
        description: 'Node slug'
      }
    }
  }
};

/**
 * Handle the pm_get_node tool call
 */
export async function handlePmGetNode(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<GetNodeResult> {
  // Validate input
  const validated = GetNodeInput.parse(input);

  // Find by ID or slug
  const node = validated.id
    ? await repo.findById(validated.id)
    : await repo.findBySlug(validated.slug!);

  if (!node) {
    return {
      success: false,
      error: `Node not found: ${validated.id || validated.slug}`
    };
  }

  // Parse DNA and parent_ids
  const dna = repo.getDna(node);
  const parentIds = repo.getParentIds(node);

  return {
    success: true,
    node: {
      id: node.id,
      type: node.type,
      status: node.status,
      slug: node.slug,
      parent_ids: parentIds,
      dna,
      created_at: node.created_at,
      updated_at: node.updated_at
    }
  };
}

export interface GetNodeResult {
  success: boolean;
  node?: {
    id: string;
    type: string;
    status: string;
    slug: string;
    parent_ids: string[];
    dna: unknown;
    created_at?: string;
    updated_at?: string;
  };
  error?: string;
}
