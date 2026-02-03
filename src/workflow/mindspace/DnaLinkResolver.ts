/**
 * DNA Link Resolver
 *
 * Resolves references between nodes (requirement_ref, design_ref, dependencies).
 * Validates that referenced nodes exist and have compatible types.
 */

import { NodeType } from '../StateMachineValidator.js';

/**
 * Node reference for resolution
 */
export interface NodeReference {
  id: string;
  type: NodeType;
  status: string;
  slug: string;
}

/**
 * Resolver function type - looks up a node by ID
 */
export type NodeLookupFn = (nodeId: string) => Promise<NodeReference | null>;

/**
 * Link resolution result
 */
export interface LinkResolutionResult {
  valid: boolean;
  errors: string[];
  resolvedLinks: ResolvedLink[];
}

/**
 * A resolved link with target node info
 */
export interface ResolvedLink {
  field: string;
  targetId: string;
  targetNode: NodeReference;
}

/**
 * Valid link targets by field name
 */
const VALID_LINK_TARGETS: Record<string, NodeType[]> = {
  requirement_ref: ['requirement'],
  design_ref: ['design'],
  dependencies: ['task', 'group', 'decision', 'requirement', 'design', 'test'],
  children: ['task', 'group', 'decision', 'requirement', 'design', 'test']
};

/**
 * Extract link fields from DNA
 */
export function extractLinks(dna: Record<string, unknown>): Map<string, string[]> {
  const links = new Map<string, string[]>();

  // Single reference fields
  for (const field of ['requirement_ref', 'design_ref']) {
    if (typeof dna[field] === 'string' && dna[field]) {
      links.set(field, [dna[field] as string]);
    }
  }

  // Array reference fields
  for (const field of ['dependencies', 'children']) {
    if (Array.isArray(dna[field])) {
      const refs = (dna[field] as unknown[]).filter(
        (item): item is string => typeof item === 'string' && item.length > 0
      );
      if (refs.length > 0) {
        links.set(field, refs);
      }
    }
  }

  return links;
}

/**
 * Resolve all links in a DNA object
 */
export async function resolveLinks(
  dna: Record<string, unknown>,
  lookup: NodeLookupFn
): Promise<LinkResolutionResult> {
  const errors: string[] = [];
  const resolvedLinks: ResolvedLink[] = [];

  const links = extractLinks(dna);

  for (const [field, targetIds] of links) {
    const validTargetTypes = VALID_LINK_TARGETS[field];

    for (const targetId of targetIds) {
      const targetNode = await lookup(targetId);

      if (!targetNode) {
        errors.push(`${field}: Referenced node "${targetId}" not found`);
        continue;
      }

      if (validTargetTypes && !validTargetTypes.includes(targetNode.type)) {
        errors.push(
          `${field}: Node "${targetId}" has type "${targetNode.type}", ` +
          `expected one of: ${validTargetTypes.join(', ')}`
        );
        continue;
      }

      resolvedLinks.push({
        field,
        targetId,
        targetNode
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    resolvedLinks
  };
}

/**
 * Check for circular dependencies
 */
export async function checkCircularDependencies(
  nodeId: string,
  dna: Record<string, unknown>,
  lookup: NodeLookupFn,
  getDna: (nodeId: string) => Promise<Record<string, unknown> | null>
): Promise<{ hasCycle: boolean; path?: string[] }> {
  const visited = new Set<string>();
  const path: string[] = [];

  async function visit(currentId: string): Promise<boolean> {
    if (visited.has(currentId)) {
      return true; // Cycle detected
    }

    visited.add(currentId);
    path.push(currentId);

    const currentDna = currentId === nodeId ? dna : await getDna(currentId);
    if (!currentDna) {
      path.pop();
      return false;
    }

    const links = extractLinks(currentDna);
    const dependencies = links.get('dependencies') || [];

    for (const depId of dependencies) {
      if (depId === nodeId) {
        path.push(depId);
        return true; // Cycle back to original node
      }
      if (await visit(depId)) {
        return true;
      }
    }

    path.pop();
    return false;
  }

  // Start from the dependencies of the current node
  const links = extractLinks(dna);
  const dependencies = links.get('dependencies') || [];

  for (const depId of dependencies) {
    visited.clear();
    path.length = 0;
    path.push(nodeId);

    if (await visit(depId)) {
      return { hasCycle: true, path: [...path] };
    }
  }

  return { hasCycle: false };
}

/**
 * Get all dependencies (transitive) for a node
 */
export async function getTransitiveDependencies(
  nodeId: string,
  lookup: NodeLookupFn,
  getDna: (nodeId: string) => Promise<Record<string, unknown> | null>
): Promise<Set<string>> {
  const allDeps = new Set<string>();
  const visited = new Set<string>();

  async function collect(currentId: string): Promise<void> {
    if (visited.has(currentId)) {
      return;
    }
    visited.add(currentId);

    const dna = await getDna(currentId);
    if (!dna) {
      return;
    }

    const links = extractLinks(dna);
    const dependencies = links.get('dependencies') || [];

    for (const depId of dependencies) {
      allDeps.add(depId);
      await collect(depId);
    }
  }

  await collect(nodeId);
  return allDeps;
}

/**
 * Get all nodes that depend on a given node
 */
export async function getDependents(
  nodeId: string,
  getAllNodes: () => Promise<Array<{ id: string; dna_json: string }>>
): Promise<string[]> {
  const dependents: string[] = [];
  const allNodes = await getAllNodes();

  for (const node of allNodes) {
    try {
      const dna = JSON.parse(node.dna_json) as Record<string, unknown>;
      const links = extractLinks(dna);
      const dependencies = links.get('dependencies') || [];

      if (dependencies.includes(nodeId)) {
        dependents.push(node.id);
      }
    } catch {
      // Skip nodes with invalid JSON
    }
  }

  return dependents;
}
