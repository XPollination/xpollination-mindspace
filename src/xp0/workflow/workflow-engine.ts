interface WorkflowContent {
  status: string;
  role: string;
  [key: string]: unknown;
}

interface WorkflowResult {
  valid: boolean;
  reason?: string;
}

// Valid state transitions
const TRANSITIONS: Record<string, string[]> = {
  pending: ['ready'],
  ready: ['active'],
  active: ['review', 'approval', 'blocked', 'testing'],
  approval: ['approved', 'rework'],
  approved: ['testing', 'active'],
  testing: ['ready', 'rework'],
  review: ['complete', 'rework', 'review'],
  rework: ['active'],
  blocked: ['ready', 'active'],
};

// States with fixed roles
const FIXED_ROLE_STATES: Record<string, string> = {
  complete: 'liaison',
  approved: 'qa',
  testing: 'qa',
};

// Transitions that require human answer audit trail
const HUMAN_ANSWER_TRANSITIONS = new Set([
  'approval->approved',
  'review->complete',
]);

export function validateWorkflow(from: WorkflowContent, to: WorkflowContent): WorkflowResult {
  const fromStatus = from.status;
  const toStatus = to.status;

  // 1. Check state transition is allowed
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed || !allowed.includes(toStatus)) {
    return { valid: false, reason: `Invalid transition: ${fromStatus} → ${toStatus}` };
  }

  // 2. Check fixed-role states
  const fixedRole = FIXED_ROLE_STATES[toStatus];
  if (fixedRole && to.role !== fixedRole) {
    return { valid: false, reason: `State '${toStatus}' requires role '${fixedRole}', got '${to.role}'` };
  }

  // 3. Role consistency — role must stay same unless forwarding (review→review) or to fixed-role
  if (!fixedRole && !(fromStatus === 'review' && toStatus === 'review')) {
    if (from.role !== to.role) {
      return { valid: false, reason: `Role change not allowed: ${from.role} → ${to.role}` };
    }
  }

  // 4. Quality gates — active→approval requires pdsa_ref + memory_contribution_id
  if (fromStatus === 'active' && toStatus === 'approval') {
    if (!to.pdsa_ref) {
      return { valid: false, reason: 'Quality gate: pdsa_ref required for active→approval' };
    }
    if (!to.memory_contribution_id) {
      return { valid: false, reason: 'Quality gate: memory_contribution_id required for active→approval' };
    }
  }

  // 5. Rework routing — rework requires rework_target_role
  if (toStatus === 'rework' && !to.rework_target_role) {
    return { valid: false, reason: 'Rework transition requires rework_target_role' };
  }

  // 6. Blocked state — requires blocked_from_state + blocked_from_role
  if (toStatus === 'blocked') {
    if (!to.blocked_from_state || !to.blocked_from_role) {
      return { valid: false, reason: 'Blocked transition requires blocked_from_state and blocked_from_role' };
    }
  }

  // 7. Human answer audit trail
  const transitionKey = `${fromStatus}->${toStatus}`;
  if (HUMAN_ANSWER_TRANSITIONS.has(transitionKey)) {
    if (!to.human_answer) {
      return { valid: false, reason: `human_answer required for ${transitionKey}` };
    }
    if (!to.human_answer_at) {
      return { valid: false, reason: `human_answer_at required for ${transitionKey}` };
    }
    if (!to.approval_mode) {
      return { valid: false, reason: `approval_mode required for ${transitionKey}` };
    }
  }

  return { valid: true };
}
