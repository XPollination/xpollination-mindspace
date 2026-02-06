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
// approved = design approved, ready for next phase
// testing = QA creates tests before dev implements
export const VALID_STATUSES = [
  'pending', 'ready', 'active', 'approval', 'approved', 'testing',
  'review', 'rework', 'complete', 'blocked', 'cancelled'
];

// Valid types (simplified: only task and bug)
export const VALID_TYPES = ['task', 'bug'];

// Valid roles
export const VALID_ROLES = ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator'];

// ALLOWED_TRANSITIONS whitelist - any undefined transition is REJECTED
export const ALLOWED_TRANSITIONS = {
  // Task flow - role-aware transitions
  // Key principle: Role assigned at creation should be preserved unless explicitly transitioned
  'task': {
    // AC1: pending->ready preserves original role (no automatic override)
    'pending->ready': { allowedActors: ['liaison', 'system', 'pdsa'] },

    // AC2: ready->active allows role-matched claiming
    'ready->active': { allowedActors: ['pdsa', 'dev', 'qa', 'liaison'] },
    'ready->active:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa' },
    'ready->active:dev': { allowedActors: ['dev'], requireRole: 'dev' },
    'ready->active:qa': { allowedActors: ['qa'], requireRole: 'qa' },
    'ready->active:liaison': { allowedActors: ['liaison'], requireRole: 'liaison' },

    // AC3: active->review - pdsa MUST go through approval (requireRole enforces this)
    // Per WORKFLOW.md: dev sends to review, Monitor=qa (QA reviews dev work)
    'active->review': { allowedActors: ['pdsa', 'dev', 'liaison'], requireRole: 'dev', newRole: 'qa' },
    // Liaison content path: liaison sends to review, Monitor=liaison (liaison presents to human)
    'active->review:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', newRole: 'liaison' },
    // AC3: active->approval - only pdsa role tasks (dev cannot skip to approval)
    'active->approval': { allowedActors: ['pdsa', 'dev', 'liaison'], requireRole: 'pdsa' },

    // AC5: approval enforces role=liaison
    'approval->approved': { allowedActors: ['liaison', 'thomas'], newRole: 'liaison' },
    // Per WORKFLOW.md: approval->rework routes to pdsa (design rejected, pdsa reworks)
    'approval->rework': { allowedActors: ['liaison', 'thomas'], newRole: 'pdsa' },

    // AC6 & AC7: QA testing phase
    'approved->testing': { allowedActors: ['liaison', 'system'], newRole: 'qa' },
    'testing->active': { allowedActors: ['qa'], requireRole: 'qa' },
    'testing->ready': { allowedActors: ['qa'], newRole: 'dev' },

    // Legacy path (approved->ready for non-TDD flow)
    'approved->ready': { allowedActors: ['liaison', 'system'], newRole: 'dev' },

    // AC4: rework->active allows pdsa, dev, qa, liaison (role-matched)
    'rework->active': { allowedActors: ['pdsa', 'dev', 'qa', 'liaison'] },
    'rework->active:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa' },
    'rework->active:dev': { allowedActors: ['dev'], requireRole: 'dev' },
    'rework->active:qa': { allowedActors: ['qa'], requireRole: 'qa' },
    // Per WORKFLOW.md v12: liaison reclaims liaison rework
    'rework->active:liaison': { allowedActors: ['liaison'], requireRole: 'liaison' },

    // Per WORKFLOW.md v12: QA active->testing transition (only QA actor, sets qa role)
    'active->testing': { allowedActors: ['qa'], newRole: 'qa' },

    // Review flow - per WORKFLOW.md: pdsa completes PDSA path, liaison completes liaison path
    'review->complete': { allowedActors: ['pdsa', 'liaison'], newRole: 'liaison' },
    'review->rework': { allowedActors: ['pdsa', 'qa'], newRole: 'dev' },
    // Per WORKFLOW.md v12: review+liaison -> rework routes back to liaison (human rejects final)
    'review->rework:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', newRole: 'liaison' },
    // Per WORKFLOW.md v12: review chain transitions (QA->PDSA->Liaison)
    'review->review:qa': { allowedActors: ['qa'], requireRole: 'qa', newRole: 'pdsa' },
    'review->review:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa', newRole: 'liaison' },

    // Per WORKFLOW.md v12: complete->rework (human reopens task)
    'complete->rework': { allowedActors: ['liaison'] },

    // Special transitions
    'any->blocked': { allowedActors: ['liaison', 'system'] },
    'any->cancelled': { allowedActors: ['liaison', 'system'] }
  },
  // Bug flow (can bypass PDSA, simplified)
  'bug': {
    'pending->ready': { allowedActors: ['liaison', 'pdsa', 'system'], newRole: 'dev' },
    'ready->active': { allowedActors: ['dev'], requireRole: 'dev' },
    // Per WORKFLOW.md: dev sends to review, Monitor=qa (QA reviews)
    'active->review': { allowedActors: ['dev'], newRole: 'qa' },
    // Bug path: only liaison can finalize completion (QA reviews but doesn't complete)
    'review->complete': { allowedActors: ['liaison'], newRole: 'liaison' },
    'review->rework': { allowedActors: ['pdsa', 'qa'], newRole: 'dev' },
    'rework->active': { allowedActors: ['dev'] },
    // Per WORKFLOW.md v12: complete->rework (human reopens bug)
    'complete->rework': { allowedActors: ['liaison'] },
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

  // Check role requirement FIRST (before actor check)
  // This ensures role-based rejections produce "Only role=X" messages
  if (rule.requireRole && currentRole !== rule.requireRole) {
    return `Only role=${rule.requireRole} can use this transition. Task role: ${currentRole}`;
  }

  // Check actor permission
  // 'system' actor can always perform any transition
  // Other actors must be in the allowedActors list
  if (actor !== 'system' && !rule.allowedActors.includes(actor)) {
    return `Actor ${actor} not allowed for transition ${transitionKey}. Allowed: ${rule.allowedActors.join(', ')}`;
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
