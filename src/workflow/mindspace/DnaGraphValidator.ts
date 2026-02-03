/**
 * DNA Graph Validator (Layer 4)
 *
 * Validates DAG structure integrity:
 * - No orphan nodes (every node reachable from root or explicitly marked as root)
 * - No circular dependencies
 * - Parent-child type compatibility
 * - DAG structure validation
 */

import { NodeType } from '../StateMachineValidator.js';
import { extractLinks, checkCircularDependencies, NodeLookupFn } from './DnaLinkResolver.js';

/**
 * Graph validation result
 */
export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Node info for graph validation
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  parentIds: string[];
  dna: Record<string, unknown>;
}

/**
 * Graph context for validation
 */
export interface GraphContext {
  getAllNodes: () => Promise<GraphNode[]>;
  getNode: (id: string) => Promise<GraphNode | null>;
  rootNodeIds?: string[];  // Explicit root nodes (no parents required)
}

/**
 * Valid parent types for each node type.
 * Defines what types can contain/parent each node type.
 */
const VALID_PARENT_TYPES: Record<NodeType, NodeType[]> = {
  task: ['group', 'requirement', 'design'],
  group: ['group'],  // Groups can nest
  decision: ['group', 'task', 'requirement'],
  requirement: ['group'],
  design: ['group', 'requirement'],
  test: ['group', 'requirement', 'design', 'task']
};

/**
 * Valid child types for groups (what can be in a group)
 */
const VALID_GROUP_CHILDREN: NodeType[] = [
  'task', 'group', 'decision', 'requirement', 'design', 'test'
];

/**
 * Validate graph integrity for a single node
 */
export async function validateNodeInGraph(
  node: GraphNode,
  context: GraphContext
): Promise<GraphValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate parent-child type compatibility
  await validateParentTypes(node, context, errors, warnings);

  // Validate children types (for groups)
  if (node.type === 'group') {
    await validateGroupChildren(node, context, errors, warnings);
  }

  // Check for circular dependencies
  const lookup: NodeLookupFn = async (id) => {
    const n = await context.getNode(id);
    if (!n) return null;
    return { id: n.id, type: n.type, status: 'pending', slug: '' };
  };

  const getDna = async (id: string) => {
    const n = await context.getNode(id);
    return n?.dna || null;
  };

  const cycleResult = await checkCircularDependencies(node.id, node.dna, lookup, getDna);
  if (cycleResult.hasCycle) {
    errors.push(`Circular dependency detected: ${cycleResult.path?.join(' -> ')}`);
  }

  // Validate dependency targets exist and are valid types
  await validateDependencyTargets(node, context, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate entire graph structure
 */
export async function validateGraphStructure(
  context: GraphContext
): Promise<GraphValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allNodes = await context.getAllNodes();
  const nodeMap = new Map<string, GraphNode>();

  for (const node of allNodes) {
    nodeMap.set(node.id, node);
  }

  // Find root nodes (nodes with no parents)
  const rootNodes: string[] = [];
  const childNodes: Set<string> = new Set();

  for (const node of allNodes) {
    if (node.parentIds.length === 0) {
      rootNodes.push(node.id);
    }

    // Track all referenced children
    const children = (node.dna.children as string[]) || [];
    for (const childId of children) {
      childNodes.add(childId);
    }
  }

  // Check for orphan nodes (not reachable from any root)
  const reachable = await findReachableNodes(rootNodes, context);
  const explicitRoots = new Set(context.rootNodeIds || []);

  for (const node of allNodes) {
    if (!reachable.has(node.id) && !explicitRoots.has(node.id)) {
      // Node is not reachable from roots and not explicitly a root
      if (node.parentIds.length === 0) {
        // It's a root node itself, that's fine
        continue;
      }
      warnings.push(`Node "${node.id}" may be orphaned (not reachable from any root)`);
    }
  }

  // Validate each node
  for (const node of allNodes) {
    const nodeResult = await validateNodeInGraph(node, context);
    errors.push(...nodeResult.errors);
    warnings.push(...nodeResult.warnings);
  }

  // Check for missing nodes (referenced but not found)
  for (const node of allNodes) {
    // Check parent references
    for (const parentId of node.parentIds) {
      if (!nodeMap.has(parentId)) {
        errors.push(`Node "${node.id}" references non-existent parent "${parentId}"`);
      }
    }

    // Check dependency references
    const deps = extractLinks(node.dna).get('dependencies') || [];
    for (const depId of deps) {
      if (!nodeMap.has(depId)) {
        errors.push(`Node "${node.id}" has dependency on non-existent node "${depId}"`);
      }
    }

    // Check children references (for groups)
    const children = (node.dna.children as string[]) || [];
    for (const childId of children) {
      if (!nodeMap.has(childId)) {
        errors.push(`Group "${node.id}" references non-existent child "${childId}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if adding a dependency would create a cycle
 */
export async function wouldCreateCycle(
  nodeId: string,
  newDependencyId: string,
  context: GraphContext
): Promise<boolean> {
  const node = await context.getNode(nodeId);
  if (!node) return false;

  // Create modified DNA with new dependency
  const modifiedDna = { ...node.dna };
  const currentDeps = (modifiedDna.dependencies as string[]) || [];
  modifiedDna.dependencies = [...currentDeps, newDependencyId];

  const lookup: NodeLookupFn = async (id) => {
    const n = await context.getNode(id);
    if (!n) return null;
    return { id: n.id, type: n.type, status: 'pending', slug: '' };
  };

  const getDna = async (id: string) => {
    if (id === nodeId) return modifiedDna;
    const n = await context.getNode(id);
    return n?.dna || null;
  };

  const result = await checkCircularDependencies(nodeId, modifiedDna, lookup, getDna);
  return result.hasCycle;
}

/**
 * Get topological order of nodes (respecting dependencies)
 */
export async function getTopologicalOrder(
  context: GraphContext
): Promise<{ order: string[]; hasCycle: boolean }> {
  const allNodes = await context.getAllNodes();
  const nodeMap = new Map<string, GraphNode>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of allNodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build dependency graph
  for (const node of allNodes) {
    const deps = extractLinks(node.dna).get('dependencies') || [];
    for (const depId of deps) {
      if (nodeMap.has(depId)) {
        // depId must complete before node.id
        adjacency.get(depId)!.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const order: string[] = [];

  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return {
    order,
    hasCycle: order.length !== allNodes.length
  };
}

// Helper functions

async function validateParentTypes(
  node: GraphNode,
  context: GraphContext,
  errors: string[],
  warnings: string[]
): Promise<void> {
  const validParents = VALID_PARENT_TYPES[node.type];

  for (const parentId of node.parentIds) {
    const parent = await context.getNode(parentId);
    if (!parent) {
      errors.push(`Parent node "${parentId}" not found for node "${node.id}"`);
      continue;
    }

    if (!validParents.includes(parent.type)) {
      errors.push(
        `Node "${node.id}" (type: ${node.type}) cannot have parent "${parentId}" ` +
        `(type: ${parent.type}). Valid parent types: ${validParents.join(', ')}`
      );
    }
  }
}

async function validateGroupChildren(
  group: GraphNode,
  context: GraphContext,
  errors: string[],
  warnings: string[]
): Promise<void> {
  const children = (group.dna.children as string[]) || [];

  for (const childId of children) {
    const child = await context.getNode(childId);
    if (!child) {
      errors.push(`Group "${group.id}" references non-existent child "${childId}"`);
      continue;
    }

    if (!VALID_GROUP_CHILDREN.includes(child.type)) {
      errors.push(
        `Group "${group.id}" cannot contain node "${childId}" ` +
        `(type: ${child.type}). Valid child types: ${VALID_GROUP_CHILDREN.join(', ')}`
      );
    }
  }
}

async function validateDependencyTargets(
  node: GraphNode,
  context: GraphContext,
  errors: string[],
  warnings: string[]
): Promise<void> {
  const deps = extractLinks(node.dna).get('dependencies') || [];

  for (const depId of deps) {
    const dep = await context.getNode(depId);
    if (!dep) {
      errors.push(`Dependency "${depId}" not found for node "${node.id}"`);
      continue;
    }

    // Can't depend on self
    if (depId === node.id) {
      errors.push(`Node "${node.id}" cannot depend on itself`);
    }
  }
}

async function findReachableNodes(
  startIds: string[],
  context: GraphContext
): Promise<Set<string>> {
  const reachable = new Set<string>();
  const queue = [...startIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const node = await context.getNode(current);
    if (!node) continue;

    // Add children (for groups)
    const children = (node.dna.children as string[]) || [];
    queue.push(...children);

    // Add nodes that reference this as parent
    const allNodes = await context.getAllNodes();
    for (const n of allNodes) {
      if (n.parentIds.includes(current) && !reachable.has(n.id)) {
        queue.push(n.id);
      }
    }
  }

  return reachable;
}
