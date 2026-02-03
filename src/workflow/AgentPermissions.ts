/**
 * Agent Permissions
 *
 * Defines which actors can perform which operations on nodes.
 * Enforces role-based access control for the station workflow.
 */

import { NodeType, NodeStatus, Actor, ValidationResult } from './StateMachineValidator.js';

/**
 * Permission check request
 */
export interface PermissionRequest {
  nodeType: NodeType;
  status: NodeStatus;
  actor: Actor;
  action: 'work' | 'transition';
}

/**
 * Actors allowed to work on nodes at each status.
 * "work" = can perform the primary activity at this station
 */
const WORK_PERMISSIONS: Record<NodeStatus, Actor[]> = {
  pending: ['system', 'thomas', 'orchestrator'], // System auto-queues, Thomas/Orchestrator can prioritize
  ready: ['orchestrator', 'thomas'], // Orchestrator assigns, Thomas can override
  active: ['dev', 'pdsa', 'thomas'], // Dev implements, PDSA plans, Thomas can do anything
  review: ['pdsa', 'qa', 'thomas'], // PDSA/QA reviews, Thomas approves
  rework: ['dev', 'pdsa', 'thomas'], // Same as active
  complete: [], // No work needed
  blocked: ['thomas', 'orchestrator'], // Only Thomas/Orchestrator can unblock
  cancelled: [] // No work needed
};

/**
 * Actors allowed to trigger transitions FROM each status.
 * "transition" = can change the status of a node
 */
const TRANSITION_PERMISSIONS: Record<NodeStatus, Actor[]> = {
  pending: ['system', 'orchestrator', 'thomas'],
  ready: ['orchestrator', 'thomas', 'dev', 'pdsa'],
  active: ['dev', 'pdsa', 'qa', 'thomas'],
  review: ['pdsa', 'qa', 'thomas'],
  rework: ['dev', 'pdsa', 'thomas'],
  complete: ['thomas'], // Only Thomas can reopen completed items
  blocked: ['orchestrator', 'thomas'],
  cancelled: ['thomas'] // Only Thomas can uncanel
};

/**
 * Special node-type-specific overrides
 */
const NODE_TYPE_OVERRIDES: Partial<Record<NodeType, Partial<Record<NodeStatus, Actor[]>>>> = {
  decision: {
    // Decisions at active status can only be made by Thomas
    active: ['thomas']
  },
  requirement: {
    // Requirements need PDSA to be active (planning)
    active: ['pdsa', 'thomas']
  },
  design: {
    // Designs need PDSA to be active (planning)
    active: ['pdsa', 'thomas']
  },
  test: {
    // Tests are QA's domain when active
    active: ['qa', 'thomas']
  }
};

/**
 * Check if an actor can work on a node at a given status
 *
 * @param request - Permission check request
 * @returns ValidationResult
 */
export function checkPermission(request: PermissionRequest): ValidationResult {
  const { nodeType, status, actor, action } = request;

  // Get base permissions
  const basePermissions = action === 'work'
    ? WORK_PERMISSIONS[status]
    : TRANSITION_PERMISSIONS[status];

  if (!basePermissions) {
    return {
      allowed: false,
      reason: `Unknown status: ${status}`
    };
  }

  // Check for node-type-specific overrides (only for work permissions)
  let allowedActors = basePermissions;
  if (action === 'work') {
    const overrides = NODE_TYPE_OVERRIDES[nodeType];
    if (overrides && overrides[status]) {
      allowedActors = overrides[status]!;
    }
  }

  // Check if actor is in the allowed list
  if (!allowedActors.includes(actor)) {
    const actorList = allowedActors.length > 0
      ? allowedActors.join(', ')
      : 'none';
    return {
      allowed: false,
      reason: `Actor '${actor}' cannot ${action} on ${nodeType} at status '${status}'. Allowed: ${actorList}`
    };
  }

  return { allowed: true };
}

/**
 * Check if an actor can work on a node
 */
export function canWork(nodeType: NodeType, status: NodeStatus, actor: Actor): ValidationResult {
  return checkPermission({ nodeType, status, actor, action: 'work' });
}

/**
 * Check if an actor can trigger a transition
 */
export function canTransition(nodeType: NodeType, status: NodeStatus, actor: Actor): ValidationResult {
  return checkPermission({ nodeType, status, actor, action: 'transition' });
}

/**
 * Get all actors who can work on a node at a given status
 */
export function getWorkActors(nodeType: NodeType, status: NodeStatus): Actor[] {
  // Check for overrides first
  const overrides = NODE_TYPE_OVERRIDES[nodeType];
  if (overrides && overrides[status]) {
    return overrides[status]!;
  }
  return WORK_PERMISSIONS[status] || [];
}

/**
 * Get all actors who can transition a node from a given status
 */
export function getTransitionActors(status: NodeStatus): Actor[] {
  return TRANSITION_PERMISSIONS[status] || [];
}
