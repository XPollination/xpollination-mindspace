/**
 * PM Create Node Tool
 *
 * Creates a new node in the mindspace DAG.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuid } from 'uuid';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';
import { NodeType, Actor } from '../../workflow/StateMachineValidator.js';
import { NodeDna } from '../../workflow/mindspace/DnaValidator.js';

// Input validation schema
const CreateNodeInput = z.object({
  type: z.enum(['task', 'group', 'decision', 'requirement', 'design', 'test'])
    .describe('Type of node to create'),
  slug: z.string().min(1).max(100)
    .describe('Human-readable identifier (e.g., "implement-login")'),
  title: z.string().min(3).max(200)
    .describe('Node title'),
  description: z.string().optional()
    .describe('Detailed description'),
  parent_ids: z.array(z.string()).optional()
    .describe('Parent node IDs (for DAG structure)'),
  dna: z.record(z.unknown()).optional()
    .describe('Additional DNA fields specific to node type'),
  actor: z.enum(['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system']).optional()
    .describe('Actor creating the node (defaults to system)')
});

export type CreateNodeInput = z.infer<typeof CreateNodeInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmCreateNodeTool: Tool = {
  name: 'pm_create_node',
  description: `Create a new node in the mindspace project management DAG.

Node types:
- task: Work items with acceptance criteria
- group: Container for related nodes
- decision: Decision points requiring human input
- requirement: Specifications and requirements
- design: Technical design documents
- test: Test cases

The node is created in 'pending' status. Use pm_transition to change status.`,
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['task', 'group', 'decision', 'requirement', 'design', 'test'],
        description: 'Type of node to create'
      },
      slug: {
        type: 'string',
        description: 'Human-readable identifier (e.g., "implement-login")'
      },
      title: {
        type: 'string',
        description: 'Node title'
      },
      description: {
        type: 'string',
        description: 'Detailed description'
      },
      parent_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Parent node IDs (for DAG structure)'
      },
      dna: {
        type: 'object',
        description: 'Additional DNA fields specific to node type'
      },
      actor: {
        type: 'string',
        enum: ['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system'],
        description: 'Actor creating the node'
      }
    },
    required: ['type', 'slug', 'title']
  }
};

/**
 * Handle the pm_create_node tool call
 */
export async function handlePmCreateNode(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<CreateNodeResult> {
  // Validate input
  const validated = CreateNodeInput.parse(input);

  // Build DNA from input
  const dna: NodeDna = {
    title: validated.title,
    description: validated.description,
    ...validated.dna
  } as NodeDna;

  // Generate unique ID
  const nodeId = uuid();

  // Create the node
  const result = await repo.create({
    id: nodeId,
    type: validated.type as NodeType,
    slug: validated.slug,
    parent_ids: validated.parent_ids,
    dna
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to create node'
    };
  }

  return {
    success: true,
    nodeId,
    slug: validated.slug,
    type: validated.type,
    status: 'pending',
    message: `Node "${validated.title}" created with ID ${nodeId}`
  };
}

export interface CreateNodeResult {
  success: boolean;
  nodeId?: string;
  slug?: string;
  type?: string;
  status?: string;
  message?: string;
  error?: string;
}
