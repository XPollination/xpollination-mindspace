// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Thomas Pichler <herr.thomas.pichler@gmail.com>

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
  'backlog', 'pending', 'ready', 'active', 'approval', 'approved', 'testing',
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
    // Backlog transitions: backlog→pending (mission release), pending→backlog (re-prioritize)
    'backlog->pending': { allowedActors: ['liaison', 'system', 'pdsa'] },
    'pending->backlog': { allowedActors: ['liaison', 'system', 'pdsa'] },

    // AC1: pending->ready forces PDSA start — all tasks must go through PDSA planning first
    'pending->ready': { allowedActors: ['liaison', 'system', 'pdsa'], newRole: 'pdsa' },

    // AC2: ready->active allows role-matched claiming
    'ready->active': { allowedActors: ['pdsa', 'dev', 'qa', 'liaison'], requiresDna: ['memory_query_session'] },
    'ready->active:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa', requiresDna: ['memory_query_session'] },
    'ready->active:dev': { allowedActors: ['dev'], requireRole: 'dev', requiresDna: ['memory_query_session', 'pdsa_ref'] },
    'ready->active:qa': { allowedActors: ['qa'], requireRole: 'qa', requiresDna: ['memory_query_session', 'pdsa_ref'] },
    'ready->active:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', requiresDna: ['memory_query_session'] },

    // Per WORKFLOW.md v12 line 21: dev sends to review, Monitor=qa (QA reviews dev work)
    // ONLY dev can do active->review. PDSA MUST use active->approval instead.
    'active->review': { allowedActors: ['dev'], requireRole: 'dev', newRole: 'qa', requiresDna: ['memory_contribution_id'] },
    // Liaison content path: liaison sends to review, Monitor=liaison (liaison presents to human)
    'active->review:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', newRole: 'liaison', requiresDna: ['memory_contribution_id'] },
    // Per WORKFLOW.md v12 line 15: only pdsa submits to approval (human gate)
    // Requires pdsa_ref in DNA. Monitor=liaison, so set newRole: liaison
    'active->approval': { allowedActors: ['pdsa'], requireRole: 'pdsa', requiresDna: ['pdsa_ref', 'memory_contribution_id'], newRole: 'liaison' },

    // Per WORKFLOW.md v12 line 16: approved state monitor=qa
    'approval->approved': { allowedActors: ['liaison', 'thomas'], newRole: 'qa', requiresHumanConfirm: true },
    // Per WORKFLOW.md v15: research tasks complete directly from approval (skip QA — nothing to test)
    'approval->complete': { allowedActors: ['liaison'], newRole: 'liaison', requiresHumanConfirm: true, requiresDna: ['abstract_ref'] },
    // Per WORKFLOW.md: approval->rework routes to pdsa (design rejected, pdsa reworks)
    'approval->rework': { allowedActors: ['liaison', 'thomas'], newRole: 'pdsa', clearsDna: ['memory_query_session', 'memory_contribution_id'], requiresHumanConfirm: true },

    // QA claims approved task into active (WORKFLOW.md: approved monitor=qa)
    'approved->active': { allowedActors: ['qa'], requireRole: 'qa', newRole: 'qa', requiresDna: ['memory_query_session', 'pdsa_ref'] },

    // AC6 & AC7: QA testing phase
    'approved->testing': { allowedActors: ['liaison', 'system'], newRole: 'qa' },
    'testing->active': { allowedActors: ['qa'], requireRole: 'qa', requiresDna: ['memory_query_session'] },
    'testing->ready': { allowedActors: ['qa'], newRole: 'dev' },

    // Legacy path (approved->ready for non-TDD flow)
    'approved->ready': { allowedActors: ['liaison', 'system'], newRole: 'dev' },

    // AC4: rework->active allows pdsa, dev, qa, liaison (role-matched)
    'rework->active': { allowedActors: ['pdsa', 'dev', 'qa', 'liaison'], requiresDna: ['memory_query_session'] },
    'rework->active:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa', requiresDna: ['memory_query_session'] },
    'rework->active:dev': { allowedActors: ['dev'], requireRole: 'dev', requiresDna: ['memory_query_session'] },
    'rework->active:qa': { allowedActors: ['qa'], requireRole: 'qa', requiresDna: ['memory_query_session'] },
    // Per WORKFLOW.md v12: liaison reclaims liaison rework
    'rework->active:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', requiresDna: ['memory_query_session'] },

    // Per WORKFLOW.md v12: QA active->testing transition (only QA actor, sets qa role)
    'active->testing': { allowedActors: ['qa'], newRole: 'qa' },

    // Review flow - per WORKFLOW.md v12: only liaison (human proxy) can complete
    // PDSA forwards via review->review:pdsa, does not complete directly
    'review->complete': { allowedActors: ['liaison'], newRole: 'liaison', requiresHumanConfirm: true, requiresDna: ['abstract_ref', 'test_pass_count', 'test_total_count'] },
    'review->rework': { allowedActors: ['pdsa', 'qa'], newRole: 'dev', clearsDna: ['memory_query_session', 'memory_contribution_id', 'pr_review_verdict', 'pr_review_reasoning', 'pr_merge_sha'] },
    // Per WORKFLOW.md rework entry table: review+liaison → rework
    // Role routing determined by cmdTransition using DNA context:
    //   Design tasks (has pdsa_ref) → rework+pdsa (designer reworks)
    //   Liaison content tasks (no pdsa_ref) → rework+liaison (content creator reworks)
    // PR fields: verdict+reasoning+sha cleared on rework, pr_url+feature_branch preserved (branch still exists, PR stays open)
    'review->rework:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', clearsDna: ['memory_query_session', 'memory_contribution_id', 'pr_review_verdict', 'pr_review_reasoning', 'pr_merge_sha'], requiresDna: ['rework_target_role'], requiresHumanConfirm: true },
    // Per WORKFLOW.md v12: review chain transitions (QA->PDSA->Liaison)
    'review->review:qa': { allowedActors: ['qa'], requireRole: 'qa', newRole: 'pdsa' },
    'review->review:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa', newRole: 'liaison' },

    // Per WORKFLOW.md v12: complete->rework (human reopens task)
    // rework_target_role in DNA determines re-entry point (pdsa, dev, qa, or liaison)
    'complete->rework': { allowedActors: ['liaison'], requiresDna: ['rework_target_role'] },

    // Special transitions
    'any->blocked': { allowedActors: ['liaison', 'system', 'pdsa', 'dev', 'qa'], requiresDna: ['blocked_reason'] },
    'blocked->restore': { allowedActors: ['liaison', 'system'], clearsDna: ['blocked_from_state', 'blocked_from_role', 'blocked_reason', 'blocked_at'] },
    'any->cancelled': { allowedActors: ['liaison'], requiresDna: ['abstract_ref'], newRole: 'liaison' },
    'any->cancelled:system': { allowedActors: ['system'], newRole: 'liaison' }
  },
  // Bug flow (can bypass PDSA, simplified)
  'bug': {
    'pending->ready': { allowedActors: ['liaison', 'pdsa', 'system'], newRole: 'dev' },
    'ready->active': { allowedActors: ['dev'], requireRole: 'dev', requiresDna: ['memory_query_session'] },
    // Per WORKFLOW.md: dev sends to review, Monitor=qa (QA reviews)
    'active->review': { allowedActors: ['dev'], newRole: 'qa', requiresDna: ['memory_contribution_id'] },
    // Bug path: only liaison can finalize completion (QA reviews but doesn't complete)
    'review->complete': { allowedActors: ['liaison'], newRole: 'liaison', requiresDna: ['abstract_ref', 'test_pass_count', 'test_total_count'] },
    'review->rework': { allowedActors: ['pdsa', 'qa'], newRole: 'dev', clearsDna: ['memory_query_session', 'memory_contribution_id'] },
    // Review chain transitions (QA->PDSA->Liaison) — same as task type
    'review->review:qa': { allowedActors: ['qa'], requireRole: 'qa', newRole: 'pdsa' },
    'review->review:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa', newRole: 'liaison' },
    'rework->active': { allowedActors: ['dev'], requiresDna: ['memory_query_session'] },
    // Per WORKFLOW.md v12: complete->rework (human reopens bug)
    // rework_target_role in DNA determines re-entry point (dev, qa, etc.)
    'complete->rework': { allowedActors: ['liaison'], requiresDna: ['rework_target_role'] },
    // Special transitions
    'any->blocked': { allowedActors: ['liaison', 'system', 'pdsa', 'dev', 'qa'], requiresDna: ['blocked_reason'] },
    'blocked->restore': { allowedActors: ['liaison', 'system'], clearsDna: ['blocked_from_state', 'blocked_from_role', 'blocked_reason', 'blocked_at'] },
    'any->cancelled': { allowedActors: ['liaison'], requiresDna: ['abstract_ref'], newRole: 'liaison' },
    'any->cancelled:system': { allowedActors: ['system'], newRole: 'liaison' }
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
  // Try actor-specific variant first (e.g., any->cancelled:system)
  if (!rule) {
    rule = typeTransitions[`any->${toStatus}:${actor}`];
  }
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

  // Active status requires a valid role (either already set or will be set by transition)
  if (toStatus === 'active') {
    const effectiveRole = rule.newRole || currentRole;
    if (!effectiveRole || !VALID_ROLES.includes(effectiveRole)) {
      return `Transition to active requires a valid role. Current role: ${currentRole || 'null'}. Valid roles: ${VALID_ROLES.join(', ')}. Use role-specific transition (e.g., ready->active:dev) or ensure task has a role assigned.`;
    }
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
  if (rule?.newRole) return rule.newRole;

  // Check 'any' transitions (e.g., any->cancelled, any->blocked)
  const anyRule = typeTransitions[`any->${toStatus}`];
  return anyRule?.newRole || null;
}

/**
 * Get DNA fields that should be cleared on a transition.
 *
 * @param {string} nodeType - 'task' or 'bug'
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @param {string|null} currentRole - Current role (for role-specific transitions)
 * @returns {string[]} Array of DNA field names to clear, empty if none
 */
export function getClearsDnaForTransition(nodeType, fromStatus, toStatus, currentRole = null) {
  const typeTransitions = ALLOWED_TRANSITIONS[nodeType];
  if (!typeTransitions) return [];

  const transitionKey = `${fromStatus}->${toStatus}`;

  // Check role-specific transition first
  if (currentRole) {
    const roleSpecificRule = typeTransitions[`${transitionKey}:${currentRole}`];
    if (roleSpecificRule?.clearsDna) return roleSpecificRule.clearsDna;
  }

  // Fall back to generic transition
  const rule = typeTransitions[transitionKey];
  return rule?.clearsDna || [];
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

/**
 * Validate DNA requirements for a transition.
 * Some transitions require specific DNA fields to be present.
 *
 * @param {string} nodeType - 'task' or 'bug'
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @param {object} dna - The node's DNA object
 * @param {string|null} currentRole - Current role (for role-specific rules)
 * @returns {string|null} Error message if invalid, null if valid
 */
export function validateDnaRequirements(nodeType, fromStatus, toStatus, dna, currentRole = null, actor = null) {
  const typeTransitions = ALLOWED_TRANSITIONS[nodeType];
  if (!typeTransitions) return null;

  const transitionKey = `${fromStatus}->${toStatus}`;

  // Check role-specific transition first
  let rule = null;
  if (currentRole) {
    rule = typeTransitions[`${transitionKey}:${currentRole}`];
  }
  if (!rule) {
    rule = typeTransitions[transitionKey];
  }
  // Check for actor-specific 'any' transitions (e.g., any->cancelled:system)
  if (!rule && actor) {
    rule = typeTransitions[`any->${toStatus}:${actor}`];
  }
  // Fall back to generic 'any' transition
  if (!rule) {
    rule = typeTransitions[`any->${toStatus}`];
  }
  if (!rule) return null;

  // Check DNA requirements
  if (rule.requiresDna && Array.isArray(rule.requiresDna)) {
    for (const field of rule.requiresDna) {
      if (!dna || !dna[field]) {
        return `Transition ${transitionKey} requires dna.${field} to be set. PDSA tasks must have a linked PDSA document before approval.`;
      }
      // pdsa_ref must be a GitHub link (enforces git protocol)
      if (field === 'pdsa_ref' && typeof dna[field] === 'string' && !dna[field].startsWith('https://github.com/')) {
        return `dna.pdsa_ref must be a GitHub link (https://github.com/...). Local file paths are not allowed. Execute git protocol first (git add, git commit, git push), then use the GitHub URL. Current value: "${dna[field]}"`;
      }
      // abstract_ref must be a GitHub link (enforces git protocol)
      if (field === 'abstract_ref' && typeof dna[field] === 'string' && !dna[field].startsWith('https://github.com/')) {
        return `dna.abstract_ref must be a GitHub link (https://github.com/...). Local file paths are not allowed. Execute git protocol first (git add, git commit, git push), then use the GitHub URL. Current value: "${dna[field]}"`;
      }
    }

    // Test pass gate: validate test_pass_count === test_total_count and test_total_count > 0
    if (rule.requiresDna.includes('test_pass_count') && rule.requiresDna.includes('test_total_count')) {
      const test_total_count = dna.test_total_count;
      const test_pass_count = dna.test_pass_count;

      if (test_total_count <= 0) {
        return `Test gate blocked: test_total_count must be positive (> 0), got ${test_total_count}. Tasks must have tests before completion.`;
      }

      if (test_pass_count !== test_total_count) {
        return `Test gate blocked: 100% test pass required. test_pass_count=${test_pass_count} but test_total_count=${test_total_count}. All tests must pass before completion.`;
      }
    }
  }

  // PR merge gate: tasks with feature_branch require PR review before completion.
  // When dna.feature_branch exists, the review→complete transition requires:
  //   pr_url (GitHub URL), pr_review_verdict === "merge",
  //   pr_review_reasoning (min 50 chars), pr_merge_sha (git SHA).
  // This ensures branch lifecycle mirrors task lifecycle (REQ-BRANCH-001).
  // Tasks without feature_branch are unaffected (liaison content, research, etc.).
  // See: MISSION-CONTINUOUS-DELIVERY Part 2.
  if (toStatus === 'complete' && dna && dna.feature_branch) {
    if (!dna.pr_url || typeof dna.pr_url !== 'string' || !dna.pr_url.startsWith('https://github.com/')) {
      return `PR merge gate: pr_url required (GitHub URL). Task has feature_branch="${dna.feature_branch}" — create a PR and set pr_url before completing.`;
    }
    if (dna.pr_review_verdict !== 'merge') {
      return `PR merge gate: pr_review_verdict must be "merge" to complete. Current: "${dna.pr_review_verdict || 'not set'}". Review the PR diff and set verdict before completing.`;
    }
    if (!dna.pr_review_reasoning || typeof dna.pr_review_reasoning !== 'string' || dna.pr_review_reasoning.length < 50) {
      return `PR merge gate: pr_review_reasoning required (min 50 chars). Document what was checked in the PR diff. Current length: ${(dna.pr_review_reasoning || '').length}.`;
    }
    if (!dna.pr_merge_sha || typeof dna.pr_merge_sha !== 'string' || dna.pr_merge_sha.length < 7) {
      return `PR merge gate: pr_merge_sha required. Merge the PR first (gh pr merge), then record the merge commit SHA.`;
    }
  }

  // Version bump gate: if task modifies a versioned component, require version_bump_ref
  if (dna && dna.versioned_component && !dna.version_bump_ref) {
    return `Task modifies versioned component "${dna.versioned_component}" but no version_bump_ref in DNA. Run scripts/version-bump.sh ${dna.versioned_component} first.`;
  }

  // Liaison review gate: liaison must document reasoning for approval/completion/rework decisions
  const liaisonGatedTransitions = ['approval->approved', 'review->complete', 'review->rework'];
  if (actor === 'liaison' && liaisonGatedTransitions.includes(transitionKey)) {
    if (!dna || !dna.liaison_review) {
      return `Transition ${transitionKey} by liaison requires dna.liaison_review. Document your reasoning: What did you check? What did you challenge? What is your recommendation and why?`;
    }

    // Liaison challenge questions — mandatory per transition type
    const MIN_ANSWER_LENGTH = 20;
    if (transitionKey === 'approval->approved') {
      const approvalQuestions = ['liaison_q1_approval', 'liaison_q2_approval', 'liaison_q3_approval'];
      for (const q of approvalQuestions) {
        if (!dna[q] || typeof dna[q] !== 'string' || dna[q].length < MIN_ANSWER_LENGTH) {
          return `Transition ${transitionKey} requires dna.${q} (min ${MIN_ANSWER_LENGTH} chars). Answer must be task-specific, not a template.`;
        }
      }
    }
    if (transitionKey === 'review->complete') {
      const completeQuestions = ['liaison_q1_complete', 'liaison_q2_complete', 'liaison_q3_complete'];
      for (const q of completeQuestions) {
        if (!dna[q] || typeof dna[q] !== 'string' || dna[q].length < MIN_ANSWER_LENGTH) {
          return `Transition ${transitionKey} requires dna.${q} (min ${MIN_ANSWER_LENGTH} chars). Answer must be task-specific, not a template.`;
        }
      }
    }
  }

  return null;
}

// Expected roles by state - fixed-role states per WORKFLOW.md
// Variable-role states (active, review, ready, rework, pending, blocked) are NOT checked
export const EXPECTED_ROLES_BY_STATE = {
  'complete': 'liaison',
  'approval': 'liaison',
  'approved': 'qa',
  'testing': 'qa',
  'cancelled': 'liaison'
};

/**
 * Validate that a transition produces the correct role for fixed-role states.
 * Returns null if OK (or state is variable-role), error string if wrong role.
 *
 * @param {string} targetStatus - The status being transitioned to
 * @param {string} effectiveRole - The role that would result from the transition
 * @returns {string|null} Error message if violation, null if valid
 */
export function validateRoleConsistency(targetStatus, effectiveRole) {
  const expected = EXPECTED_ROLES_BY_STATE[targetStatus];
  if (!expected) return null;
  if (effectiveRole === expected) return null;
  return `Role consistency violation: ${targetStatus} requires role=${expected} (per WORKFLOW.md), but transition would set role=${effectiveRole || 'null'}. Fix the transition rule to include newRole: '${expected}', or check rework_target_role configuration.`;
}

/**
 * Get all transition keys that require human confirmation.
 * Used by viz to know which transitions need gating.
 *
 * @returns {string[]} Array of transition keys with requiresHumanConfirm: true
 */
export function getHumanConfirmTransitions() {
  const keys = [];
  for (const [, transitions] of Object.entries(ALLOWED_TRANSITIONS)) {
    for (const [key, rule] of Object.entries(transitions)) {
      if (rule.requiresHumanConfirm) {
        keys.push(key);
      }
    }
  }
  // Deduplicate (same key may appear in both task and bug types)
  return [...new Set(keys)];
}

/**
 * Attestation gate: check if transition requires attestation.
 * If checkAttestationGate returns {allowed: false}, the caller should
 * respond with 422 (Unprocessable Entity) and include the reason.
 *
 * Usage in transition handler:
 *   const gateResult = checkAttestationGate(taskSlug, projectSlug, fromStatus, toStatus);
 *   if (!gateResult.allowed) {
 *     return res.status(422).json({ error: gateResult.reason });
 *   }
 */
export { checkAttestationGate } from '../api/services/attestation-gate.js';
