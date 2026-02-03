/**
 * State Machine Validator
 *
 * Defines valid state transitions for DAG nodes (PM tool).
 * Enforces station-based workflow: nodes must follow defined paths.
 */

/**
 * Node types in the PM system
 */
export type NodeType = 'task' | 'group' | 'decision' | 'requirement' | 'design' | 'test';

/**
 * Valid statuses for all nodes
 */
export type NodeStatus =
  | 'pending'
  | 'ready'
  | 'active'
  | 'review'
  | 'rework'
  | 'complete'
  | 'blocked'
  | 'cancelled';

/**
 * Actor types who can perform transitions
 */
export type Actor = 'thomas' | 'orchestrator' | 'pdsa' | 'dev' | 'qa' | 'system';

/**
 * Transition request
 */
export interface TransitionRequest {
  nodeType: NodeType;
  fromStatus: NodeStatus;
  toStatus: NodeStatus;
  actor: Actor;
}

/**
 * Validation result
 */
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Valid transitions per node type.
 * Key format: "fromStatus" -> array of valid "toStatus" values
 */
const NODE_TRANSITIONS: Record<NodeType, Record<NodeStatus, NodeStatus[]>> = {
  task: {
    pending: ['ready', 'blocked', 'cancelled'],
    ready: ['active', 'blocked', 'cancelled'],
    active: ['review', 'blocked', 'cancelled'],
    review: ['complete', 'rework', 'cancelled'],
    rework: ['active', 'blocked', 'cancelled'],
    complete: [], // Terminal state
    blocked: ['ready', 'cancelled'],
    cancelled: [] // Terminal state
  },
  group: {
    pending: ['active', 'blocked', 'cancelled'],
    ready: [],  // Group skips ready
    active: ['complete', 'blocked', 'cancelled'],
    review: [],  // NO review for group
    rework: [],  // NO rework for group
    complete: [],
    blocked: ['active', 'cancelled'],
    cancelled: []
  },
  decision: {
    pending: ['ready', 'blocked', 'cancelled'],
    ready: ['active', 'blocked', 'cancelled'],
    active: ['complete', 'blocked', 'cancelled'], // Decisions don't go through review
    review: [], // Decisions skip review
    rework: [],
    complete: [],
    blocked: ['ready', 'cancelled'],
    cancelled: []
  },
  requirement: {
    pending: ['ready', 'blocked', 'cancelled'],
    ready: ['active', 'blocked', 'cancelled'],
    active: ['review', 'blocked', 'cancelled'],
    review: ['complete', 'rework', 'cancelled'],
    rework: ['active', 'blocked', 'cancelled'],
    complete: [],
    blocked: ['ready', 'cancelled'],
    cancelled: []
  },
  design: {
    pending: ['ready', 'blocked', 'cancelled'],
    ready: ['active', 'blocked', 'cancelled'],
    active: ['review', 'blocked', 'cancelled'],
    review: ['complete', 'rework', 'cancelled'],
    rework: ['active', 'blocked', 'cancelled'],
    complete: [],
    blocked: ['ready', 'cancelled'],
    cancelled: []
  },
  test: {
    pending: ['ready', 'blocked', 'cancelled'],
    ready: ['active', 'blocked', 'cancelled'],
    active: ['review', 'blocked', 'cancelled'],
    review: ['complete', 'rework', 'cancelled'],
    rework: ['active', 'blocked', 'cancelled'],
    complete: [],
    blocked: ['ready', 'cancelled'],
    cancelled: []
  }
};

/**
 * Validate a state transition
 *
 * @param request - The transition request to validate
 * @returns ValidationResult with allowed flag and reason if rejected
 */
export function validateTransition(request: TransitionRequest): ValidationResult {
  const { nodeType, fromStatus, toStatus, actor } = request;

  // Get valid transitions for this node type
  const transitions = NODE_TRANSITIONS[nodeType];
  if (!transitions) {
    return {
      allowed: false,
      reason: `Unknown node type: ${nodeType}`
    };
  }

  // Get valid target statuses from current status
  const validTargets = transitions[fromStatus];
  if (!validTargets) {
    return {
      allowed: false,
      reason: `Unknown status: ${fromStatus}`
    };
  }

  // Check if transition is allowed
  if (!validTargets.includes(toStatus)) {
    const validList = validTargets.length > 0
      ? validTargets.join(', ')
      : 'none (terminal state)';
    return {
      allowed: false,
      reason: `Invalid transition: ${nodeType} cannot go from '${fromStatus}' to '${toStatus}'. Valid targets: ${validList}`
    };
  }

  return { allowed: true };
}

/**
 * Get all valid transitions from a given state
 *
 * @param nodeType - The type of node
 * @param fromStatus - The current status
 * @returns Array of valid target statuses
 */
export function getValidTransitions(nodeType: NodeType, fromStatus: NodeStatus): NodeStatus[] {
  const transitions = NODE_TRANSITIONS[nodeType];
  if (!transitions) {
    return [];
  }
  return transitions[fromStatus] || [];
}

/**
 * Check if a status is terminal (no valid outgoing transitions)
 *
 * @param nodeType - The type of node
 * @param status - The status to check
 * @returns true if terminal
 */
export function isTerminalStatus(nodeType: NodeType, status: NodeStatus): boolean {
  const validTargets = getValidTransitions(nodeType, status);
  return validTargets.length === 0;
}

/**
 * Get all valid statuses
 */
export function getAllStatuses(): NodeStatus[] {
  return ['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
}

/**
 * Get all node types
 */
export function getAllNodeTypes(): NodeType[] {
  return ['task', 'group', 'decision', 'requirement', 'design', 'test'];
}
