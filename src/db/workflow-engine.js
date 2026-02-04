/**
 * Workflow Engine Module
 *
 * CRITICAL PRINCIPLE: If the system does not PREVENT it, it WILL happen.
 *
 * This module exports the workflow rules and validation functions for the
 * XPollination PM system. ALLOWED_TRANSITIONS whitelist - any undefined
 * transition is REJECTED.
 */

// Valid statuses (no 'd' in complete!)
// approval = human gate (Thomas reviews design)
// approved = design approved, ready for dev release
export const VALID_STATUSES = [
  'pending', 'ready', 'active', 'approval', 'approved',
  'review', 'rework', 'complete', 'blocked', 'cancelled'
];

// Valid types (simplified: only task and bug)
export const VALID_TYPES = ['task', 'bug'];

// Valid roles
export const VALID_ROLES = ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator'];

// ALLOWED_TRANSITIONS whitelist - any undefined transition is REJECTED
export const ALLOWED_TRANSITIONS = {
  // Task flow (requires PDSA first)
  'task': {
    'pending->ready': { allowedActors: ['liaison', 'system'], newRole: 'pdsa' },
    'ready->active': { allowedActors: ['pdsa'], requireRole: 'pdsa' },
    'active->approval': { allowedActors: ['pdsa'] },
    'approval->approved': { allowedActors: ['liaison', 'thomas'] },
    'approval->rework': { allowedActors: ['liaison', 'thomas'] },
    'approved->ready': { allowedActors: ['liaison', 'system'], newRole: 'dev' },
    'ready->active:dev': { allowedActors: ['dev'], requireRole: 'dev' },
    'active->review': { allowedActors: ['dev'], newRole: 'qa' },
    'review->complete': { allowedActors: ['pdsa', 'qa'] },
    'review->rework': { allowedActors: ['pdsa', 'qa'], newRole: 'dev' },
    'rework->active': { allowedActors: ['dev'] },
    // Special transitions
    'any->blocked': { allowedActors: ['liaison', 'system'] },
    'any->cancelled': { allowedActors: ['liaison', 'system'] }
  },
  // Bug flow (can bypass PDSA)
  'bug': {
    'pending->ready': { allowedActors: ['liaison', 'pdsa', 'system'], newRole: 'dev' },
    'ready->active': { allowedActors: ['dev'], requireRole: 'dev' },
    'active->review': { allowedActors: ['dev'], newRole: 'qa' },
    'review->complete': { allowedActors: ['pdsa', 'qa'] },
    'review->rework': { allowedActors: ['pdsa', 'qa'], newRole: 'dev' },
    'rework->active': { allowedActors: ['dev'] },
    // Special transitions
    'any->blocked': { allowedActors: ['liaison', 'system'] },
    'any->cancelled': { allowedActors: ['liaison', 'system'] }
  }
};

/**
 * Validate a status transition against the whitelist.
 *
 * @param {string} nodeType - 'task' or 'bug'
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @param {string} actor - Who is performing the transition
 * @param {string|null} currentRole - Current role assigned to the node
 * @returns {string|null} Error message if invalid, null if valid
 */
export function validateTransition(nodeType, fromStatus, toStatus, actor, currentRole) {
  const typeTransitions = ALLOWED_TRANSITIONS[nodeType];
  if (!typeTransitions) {
    return `Invalid type: ${nodeType}. Allowed: ${VALID_TYPES.join(', ')}`;
  }

  const transitionKey = `${fromStatus}->${toStatus}`;
  let rule = null;

  // Check for role-specific transition FIRST (e.g., ready->active:dev)
  // This allows different actors for the same transition based on current role
  if (currentRole) {
    rule = typeTransitions[`${transitionKey}:${currentRole}`];
  }

  // Fall back to generic transition if no role-specific rule
  if (!rule) {
    rule = typeTransitions[transitionKey];
  }

  // Check for 'any' transitions (blocked, cancelled)
  if (!rule) {
    rule = typeTransitions[`any->${toStatus}`];
  }

  if (!rule) {
    return `Transition ${transitionKey} not allowed for type=${nodeType}. Undefined transitions are PROHIBITED.`;
  }

  // Check actor permission
  // 'system' actor can always perform any transition
  // Other actors must be in the allowedActors list
  if (actor !== 'system' && !rule.allowedActors.includes(actor)) {
    return `Actor ${actor} not allowed for transition ${transitionKey}. Allowed: ${rule.allowedActors.join(', ')}`;
  }

  // Check role requirement for claim (ready->active)
  if (rule.requireRole && currentRole !== rule.requireRole) {
    return `Only role=${rule.requireRole} can claim this task. Current role: ${currentRole}`;
  }

  return null; // Valid
}

/**
 * Get the new role that should be set on a transition.
 *
 * @param {string} nodeType - 'task' or 'bug'
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @param {string|null} currentRole - Current role (for role-specific transitions)
 * @returns {string|null} New role to set, or null if no change
 */
export function getNewRoleForTransition(nodeType, fromStatus, toStatus, currentRole = null) {
  const typeTransitions = ALLOWED_TRANSITIONS[nodeType];
  if (!typeTransitions) return null;

  const transitionKey = `${fromStatus}->${toStatus}`;

  // Check role-specific transition first
  if (currentRole) {
    const roleSpecificRule = typeTransitions[`${transitionKey}:${currentRole}`];
    if (roleSpecificRule?.newRole) return roleSpecificRule.newRole;
  }

  // Fall back to generic transition
  const rule = typeTransitions[transitionKey];
  return rule?.newRole || null;
}

/**
 * Validate a type for creation.
 *
 * @param {string} type - The type to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
export function validateType(type) {
  if (!VALID_TYPES.includes(type)) {
    return `Invalid type: "${type}". Only allowed: ${VALID_TYPES.join(', ')}. Use 'task' for features/requirements, 'bug' for fixes.`;
  }
  return null;
}
