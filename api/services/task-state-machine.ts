/**
 * Task state machine — validates transitions and computes new role.
 * Based on WORKFLOW.md v17 transition rules.
 */

// Allowed transitions: from_status → [to_status, ...]
export const TRANSITION_MAP: Record<string, string[]> = {
  pending:  ['ready', 'cancelled'],
  ready:    ['active', 'cancelled'],
  active:   ['review', 'blocked', 'cancelled'],
  review:   ['approval', 'rework', 'complete', 'blocked'],
  approval: ['approved', 'rework'],
  approved: ['active', 'testing'],
  testing:  ['ready', 'rework', 'blocked'],
  rework:   ['active', 'cancelled'],
  blocked:  ['active', 'ready', 'cancelled'],
  complete: [],  // terminal
  cancelled: [],  // terminal
};

/**
 * Validate whether a transition from the task's current status to toStatus is allowed.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateTransition(
  currentStatus: string,
  toStatus: string
): { valid: boolean; error?: string } {
  const allowed = TRANSITION_MAP[currentStatus];

  if (!allowed) {
    return { valid: false, error: `Unknown status: ${currentStatus}` };
  }

  if (!TRANSITION_MAP[toStatus] && toStatus !== 'cancelled') {
    return { valid: false, error: `Unknown target status: ${toStatus}` };
  }

  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      error: `Invalid transition: ${currentStatus} → ${toStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`
    };
  }

  return { valid: true };
}

/**
 * Compute the new role for a task after a transition.
 * Implements review chain (qa → pdsa → liaison) and rework routing.
 */
export function computeRole(
  fromStatus: string,
  toStatus: string,
  actor?: string
): string | null {
  // Review chain: qa → pdsa → liaison
  if (toStatus === 'review') {
    if (actor === 'dev') return 'qa';
    if (actor === 'qa') return 'pdsa';
    if (actor === 'pdsa') return 'liaison';
    return 'qa'; // default
  }

  // Rework routes back to dev
  if (toStatus === 'rework') {
    return 'dev';
  }

  // Approval goes to liaison for human gate
  if (toStatus === 'approval') {
    return 'liaison';
  }

  // Approved goes to qa for testing
  if (toStatus === 'approved') {
    return 'qa';
  }

  // Active from ready: keep the task's assigned role
  if (toStatus === 'active') {
    return null; // preserve existing role
  }

  // Ready: depends on context
  if (toStatus === 'ready') {
    return null; // preserve existing role
  }

  // Blocked: preserve role
  if (toStatus === 'blocked') {
    return null;
  }

  // Complete: no role needed
  if (toStatus === 'complete') {
    return null;
  }

  return null;
}
