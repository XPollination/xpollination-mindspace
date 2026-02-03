/**
 * PM Validate Node Tool
 *
 * Validates node DNA through all 4 validation layers.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';
import { NodeType, NodeStatus, Actor } from '../../workflow/StateMachineValidator.js';
import {
  validateAll,
  validateQuick,
  FullValidationContext,
  FullValidationResult,
  GraphContext,
  GraphNode
} from '../../workflow/mindspace/index.js';

// Input validation schema
const ValidateNodeInput = z.object({
  id: z.string().optional().describe('Existing node ID to validate'),
  dna_json: z.string().optional().describe('JSON string to validate (if not using ID)'),
  type: z.enum(['task', 'group', 'decision', 'requirement', 'design', 'test']).optional()
    .describe('Node type (required if using dna_json)'),
  status: z.enum(['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled']).optional()
    .describe('Status to validate against (defaults to pending)'),
  actor: z.enum(['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system']).optional()
    .describe('Actor context for permission validation'),
  include_graph: z.boolean().optional()
    .describe('Include graph validation (Layer 4)')
});

export type ValidateNodeInput = z.infer<typeof ValidateNodeInput>;

/**
 * Tool definition exposed to Claude
 */
export const pmValidateNodeTool: Tool = {
  name: 'pm_validate_node',
  description: `Validate node DNA through all validation layers.

Validation layers:
1. Syntax: Is it valid JSON?
2. Schema: Does it match the node type's schema?
3. Semantic: Do values make sense? (dates, lengths, status requirements)
4. Graph: Is the DAG structure valid? (optional, use include_graph=true)

Can validate:
- An existing node by ID
- A DNA JSON string before creating a node

Returns detailed results for each layer.`,
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Existing node ID to validate'
      },
      dna_json: {
        type: 'string',
        description: 'JSON string to validate (if not using ID)'
      },
      type: {
        type: 'string',
        enum: ['task', 'group', 'decision', 'requirement', 'design', 'test'],
        description: 'Node type (required if using dna_json)'
      },
      status: {
        type: 'string',
        enum: ['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'],
        description: 'Status to validate against'
      },
      actor: {
        type: 'string',
        enum: ['thomas', 'orchestrator', 'pdsa', 'dev', 'qa', 'system'],
        description: 'Actor context for permission validation'
      },
      include_graph: {
        type: 'boolean',
        description: 'Include graph validation (Layer 4)'
      }
    }
  }
};

/**
 * Handle the pm_validate_node tool call
 */
export async function handlePmValidateNode(
  input: unknown,
  repo: MindspaceNodeRepository
): Promise<ValidateNodeResult> {
  // Validate input
  const validated = ValidateNodeInput.parse(input);

  let jsonString: string;
  let nodeType: NodeType;
  let nodeStatus: NodeStatus;
  let nodeId: string;
  let parentIds: string[] = [];

  if (validated.id) {
    // Validate existing node
    const node = await repo.findById(validated.id);
    if (!node) {
      return {
        success: false,
        error: `Node not found: ${validated.id}`
      };
    }
    jsonString = node.dna_json;
    nodeType = node.type;
    nodeStatus = node.status;
    nodeId = node.id;
    parentIds = repo.getParentIds(node);
  } else if (validated.dna_json && validated.type) {
    // Validate provided JSON
    jsonString = validated.dna_json;
    nodeType = validated.type as NodeType;
    nodeStatus = (validated.status || 'pending') as NodeStatus;
    nodeId = 'validation-test';
  } else {
    return {
      success: false,
      error: 'Either id, or both dna_json and type must be provided'
    };
  }

  const actor = (validated.actor || 'system') as Actor;

  // Build validation context
  const context: FullValidationContext = {
    nodeId,
    nodeType,
    currentStatus: nodeStatus,
    actor,
    parentIds
  };

  let result: FullValidationResult;

  if (validated.include_graph) {
    // Full validation with graph
    const graphContext = createGraphContext(repo);
    result = await validateAll(jsonString, context, { graphContext });
  } else {
    // Quick validation (layers 1-3)
    result = validateQuick(jsonString, nodeType, nodeStatus, actor);
  }

  return {
    success: true,
    valid: result.valid,
    failed_at: result.failedAt,
    layers: result.layers.map(l => ({
      layer: l.layer,
      valid: l.valid,
      errors: l.errors,
      warnings: l.warnings
    })),
    all_errors: result.allErrors,
    all_warnings: result.allWarnings
  };
}

/**
 * Create graph context for validation
 */
function createGraphContext(repo: MindspaceNodeRepository): GraphContext {
  return {
    getAllNodes: async () => {
      const nodes = await repo.findAll();
      return nodes.map(n => ({
        id: n.id,
        type: n.type,
        parentIds: repo.getParentIds(n),
        dna: repo.getDna(n) as unknown as Record<string, unknown>
      }));
    },
    getNode: async (id: string) => {
      const node = await repo.findById(id);
      if (!node) return null;
      return {
        id: node.id,
        type: node.type,
        parentIds: repo.getParentIds(node),
        dna: repo.getDna(node) as unknown as Record<string, unknown>
      };
    }
  };
}

export interface ValidateNodeResult {
  success: boolean;
  valid?: boolean;
  failed_at?: string;
  layers?: Array<{
    layer: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  all_errors?: string[];
  all_warnings?: string[];
  error?: string;
}
