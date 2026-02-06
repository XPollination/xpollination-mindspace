/**
 * Workflow Engine Unit Tests
 *
 * Tests for the workflow engine module that validates transitions,
 * types, and role changes in the PM system.
 *
 * AC1: Test ALLOWED_TRANSITIONS - verify allowed transitions pass, undefined rejected
 * AC2: Test validateTransition() - actor permissions, role requirements
 * AC3: Test validateType() - only task/bug types allowed
 * AC4: Test role auto-update via getNewRoleForTransition()
 * AC5: Test review->rework sets role to dev
 */

import { describe, it, expect } from 'vitest';
import {
  VALID_STATUSES,
  VALID_TYPES,
  VALID_ROLES,
  ALLOWED_TRANSITIONS,
  validateTransition,
  getNewRoleForTransition,
  validateType,
  validateDnaRequirements
} from '../workflow-engine.js';

// ============================================================================
// AC1: Test ALLOWED_TRANSITIONS whitelist
// ============================================================================

describe('AC1: ALLOWED_TRANSITIONS whitelist', () => {

  describe('Task type transitions', () => {
    it('allows pending->ready for liaison', () => {
      const result = validateTransition('task', 'pending', 'ready', 'liaison', null);
      expect(result).toBeNull();
    });

    it('allows pending->ready for system', () => {
      const result = validateTransition('task', 'pending', 'ready', 'system', null);
      expect(result).toBeNull();
    });

    it('allows ready->active for pdsa when role=pdsa', () => {
      const result = validateTransition('task', 'ready', 'active', 'pdsa', 'pdsa');
      expect(result).toBeNull();
    });

    it('allows ready->active for dev when role=dev', () => {
      const result = validateTransition('task', 'ready', 'active', 'dev', 'dev');
      expect(result).toBeNull();
    });

    it('allows active->approval for pdsa', () => {
      const result = validateTransition('task', 'active', 'approval', 'pdsa', 'pdsa');
      expect(result).toBeNull();
    });

    it('allows approval->approved for thomas', () => {
      const result = validateTransition('task', 'approval', 'approved', 'thomas', 'pdsa');
      expect(result).toBeNull();
    });

    it('allows approved->ready for liaison', () => {
      const result = validateTransition('task', 'approved', 'ready', 'liaison', 'pdsa');
      expect(result).toBeNull();
    });

    it('allows active->review for dev', () => {
      const result = validateTransition('task', 'active', 'review', 'dev', 'dev');
      expect(result).toBeNull();
    });

    it('rejects review->complete for qa (liaison only)', () => {
      // Only liaison can complete - QA reviews but doesn't finalize
      const result = validateTransition('task', 'review', 'complete', 'qa', 'qa');
      expect(result).toContain('not allowed');
    });

    it('allows review->complete for liaison', () => {
      const result = validateTransition('task', 'review', 'complete', 'liaison', 'qa');
      expect(result).toBeNull();
    });

    it('allows review->rework for qa', () => {
      const result = validateTransition('task', 'review', 'rework', 'qa', 'qa');
      expect(result).toBeNull();
    });

    it('allows rework->active for dev', () => {
      const result = validateTransition('task', 'rework', 'active', 'dev', 'dev');
      expect(result).toBeNull();
    });
  });

  describe('Bug type transitions', () => {
    it('allows pending->ready for liaison', () => {
      const result = validateTransition('bug', 'pending', 'ready', 'liaison', null);
      expect(result).toBeNull();
    });

    it('rejects pending->ready for dev (dev not in allowedActors)', () => {
      const result = validateTransition('bug', 'pending', 'ready', 'dev', null);
      expect(result).toContain('not allowed');
      expect(result).toContain('Allowed: liaison, pdsa, system');
    });

    it('allows ready->active for dev', () => {
      const result = validateTransition('bug', 'ready', 'active', 'dev', 'dev');
      expect(result).toBeNull();
    });

    it('allows active->review for dev', () => {
      const result = validateTransition('bug', 'active', 'review', 'dev', 'dev');
      expect(result).toBeNull();
    });

    it('rejects review->complete for qa (liaison only)', () => {
      // Only liaison can complete bugs - QA reviews but doesn't finalize
      const result = validateTransition('bug', 'review', 'complete', 'qa', 'qa');
      expect(result).toContain('not allowed');
    });

    it('allows review->complete for liaison', () => {
      const result = validateTransition('bug', 'review', 'complete', 'liaison', 'qa');
      expect(result).toBeNull();
    });
  });

  describe('Undefined transitions are PROHIBITED', () => {
    it('rejects pending->active (skip ready)', () => {
      const result = validateTransition('task', 'pending', 'active', 'liaison', null);
      expect(result).toContain('not allowed');
    });

    it('rejects active->complete (skip review)', () => {
      const result = validateTransition('task', 'active', 'complete', 'dev', 'dev');
      expect(result).toContain('not allowed');
    });

    it('rejects ready->review (skip active)', () => {
      const result = validateTransition('task', 'ready', 'review', 'dev', 'dev');
      expect(result).toContain('not allowed');
    });

    it('rejects review->ready (backwards)', () => {
      const result = validateTransition('task', 'review', 'ready', 'qa', 'qa');
      expect(result).toContain('not allowed');
    });
  });

  describe('Special any-> transitions', () => {
    it('allows any->blocked for liaison', () => {
      const result = validateTransition('task', 'active', 'blocked', 'liaison', 'dev');
      expect(result).toBeNull();
    });

    it('allows any->cancelled for system', () => {
      const result = validateTransition('task', 'review', 'cancelled', 'system', 'qa');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// AC2: Test validateTransition() actor permissions and role requirements
// ============================================================================

describe('AC2: validateTransition() actor permissions', () => {

  describe('Actor permissions', () => {
    it('rejects dev for pending->ready', () => {
      const result = validateTransition('task', 'pending', 'ready', 'dev', null);
      expect(result).toContain('not allowed');
    });

    it('rejects pdsa-role task for active->review (must use active->approval)', () => {
      // PDSA-role tasks MUST go through approval gate, not directly to review
      const result = validateTransition('task', 'active', 'review', 'pdsa', 'pdsa');
      expect(result).toContain('Only role=dev');
    });

    it('rejects dev for review->complete (qa only)', () => {
      const result = validateTransition('task', 'review', 'complete', 'dev', 'qa');
      expect(result).toContain('not allowed');
    });

    it('rejects dev for approval->approved (thomas only)', () => {
      const result = validateTransition('task', 'approval', 'approved', 'dev', 'pdsa');
      expect(result).toContain('not allowed');
    });
  });

  describe('Role requirements for claiming tasks', () => {
    it('rejects dev claiming pdsa role task (actor check first)', () => {
      // dev is not in allowedActors for ready->active on task type (pdsa only)
      const result = validateTransition('task', 'ready', 'active', 'dev', 'pdsa');
      expect(result).toContain('not allowed');
      expect(result).toContain('Allowed: pdsa');
    });

    it('rejects pdsa claiming dev role task (actor check first)', () => {
      // pdsa tries ready->active:dev path (dev-role specific)
      // Falls back to ready->active which only allows dev
      const result = validateTransition('task', 'ready', 'active', 'pdsa', 'dev');
      expect(result).toContain('not allowed');
      expect(result).toContain('Allowed: dev');
    });

    it('allows dev claiming dev role bug', () => {
      const result = validateTransition('bug', 'ready', 'active', 'dev', 'dev');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// AC3: Test validateType() - only task/bug allowed
// ============================================================================

describe('AC3: validateType() type validation', () => {

  it('accepts task type', () => {
    const result = validateType('task');
    expect(result).toBeNull();
  });

  it('accepts bug type', () => {
    const result = validateType('bug');
    expect(result).toBeNull();
  });

  it('rejects design type', () => {
    const result = validateType('design');
    expect(result).toContain('Invalid type');
    expect(result).toContain('task');
    expect(result).toContain('bug');
  });

  it('rejects requirement type', () => {
    const result = validateType('requirement');
    expect(result).toContain('Invalid type');
  });

  it('rejects feature type', () => {
    const result = validateType('feature');
    expect(result).toContain('Invalid type');
  });

  it('rejects empty type', () => {
    const result = validateType('');
    expect(result).toContain('Invalid type');
  });
});

// ============================================================================
// AC4 & AC5: Test role auto-update via getNewRoleForTransition()
// ============================================================================

describe('AC4 & AC5: getNewRoleForTransition() role changes', () => {

  describe('Task flow role changes', () => {
    it('pending->ready preserves original role (AC1: no automatic override)', () => {
      const result = getNewRoleForTransition('task', 'pending', 'ready');
      expect(result).toBeNull(); // Role preserved, not changed
    });

    it('approved->ready sets role to dev', () => {
      const result = getNewRoleForTransition('task', 'approved', 'ready');
      expect(result).toBe('dev');
    });

    it('active->review sets role to qa', () => {
      const result = getNewRoleForTransition('task', 'active', 'review');
      expect(result).toBe('qa');
    });

    it('review->rework sets role to dev (AC6)', () => {
      const result = getNewRoleForTransition('task', 'review', 'rework');
      expect(result).toBe('dev');
    });

    it('ready->active does NOT change role', () => {
      const result = getNewRoleForTransition('task', 'ready', 'active');
      expect(result).toBeNull();
    });

    it('rework->active does NOT change role', () => {
      const result = getNewRoleForTransition('task', 'rework', 'active');
      expect(result).toBeNull();
    });
  });

  describe('Bug flow role changes', () => {
    it('pending->ready sets role to dev', () => {
      const result = getNewRoleForTransition('bug', 'pending', 'ready');
      expect(result).toBe('dev');
    });

    it('active->review sets role to qa', () => {
      const result = getNewRoleForTransition('bug', 'active', 'review');
      expect(result).toBe('qa');
    });

    it('review->rework sets role to dev', () => {
      const result = getNewRoleForTransition('bug', 'review', 'rework');
      expect(result).toBe('dev');
    });
  });

  describe('Edge cases', () => {
    it('returns null for invalid type', () => {
      const result = getNewRoleForTransition('invalid', 'pending', 'ready');
      expect(result).toBeNull();
    });

    it('returns null for undefined transition', () => {
      const result = getNewRoleForTransition('task', 'pending', 'active');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Constants validation
// ============================================================================

describe('Constants validation', () => {

  it('VALID_STATUSES contains all 11 statuses (includes testing)', () => {
    expect(VALID_STATUSES).toHaveLength(11);
    expect(VALID_STATUSES).toContain('pending');
    expect(VALID_STATUSES).toContain('ready');
    expect(VALID_STATUSES).toContain('active');
    expect(VALID_STATUSES).toContain('approval');
    expect(VALID_STATUSES).toContain('approved');
    expect(VALID_STATUSES).toContain('testing'); // AC6: New testing status
    expect(VALID_STATUSES).toContain('review');
    expect(VALID_STATUSES).toContain('rework');
    expect(VALID_STATUSES).toContain('complete');
    expect(VALID_STATUSES).toContain('blocked');
    expect(VALID_STATUSES).toContain('cancelled');
  });

  it('VALID_TYPES contains only task and bug', () => {
    expect(VALID_TYPES).toHaveLength(2);
    expect(VALID_TYPES).toContain('task');
    expect(VALID_TYPES).toContain('bug');
  });

  it('VALID_ROLES contains expected roles', () => {
    expect(VALID_ROLES).toContain('dev');
    expect(VALID_ROLES).toContain('pdsa');
    expect(VALID_ROLES).toContain('qa');
    expect(VALID_ROLES).toContain('liaison');
  });

  it('ALLOWED_TRANSITIONS has task and bug keys', () => {
    expect(ALLOWED_TRANSITIONS).toHaveProperty('task');
    expect(ALLOWED_TRANSITIONS).toHaveProperty('bug');
  });
});

// ============================================================================
// AC8 & AC9: Full path tests
// ============================================================================

describe('AC8 & AC9: Full workflow paths', () => {

  describe('AC8: LIAISON content path (no role changes)', () => {
    // Path: pending→ready(liaison)→active(liaison)→review(qa)→complete
    it('liaison can transition pending->ready', () => {
      const result = validateTransition('task', 'pending', 'ready', 'liaison', 'liaison');
      expect(result).toBeNull();
    });

    it('pending->ready preserves liaison role', () => {
      const newRole = getNewRoleForTransition('task', 'pending', 'ready');
      expect(newRole).toBeNull(); // Role preserved
    });

    it('liaison can claim ready->active for liaison role task', () => {
      const result = validateTransition('task', 'ready', 'active', 'liaison', 'liaison');
      expect(result).toBeNull();
    });

    it('liaison can submit active->review', () => {
      const result = validateTransition('task', 'active', 'review', 'liaison', 'liaison');
      expect(result).toBeNull();
    });

    it('qa cannot complete review->complete (liaison only)', () => {
      // Only liaison can finalize completion
      const result = validateTransition('task', 'review', 'complete', 'qa', 'qa');
      expect(result).toContain('not allowed');
    });

    it('liaison can complete review->complete', () => {
      const result = validateTransition('task', 'review', 'complete', 'liaison', 'qa');
      expect(result).toBeNull();
    });
  });

  describe('AC9: PDSA design path with testing phase', () => {
    // Path: pending→ready(pdsa)→active(pdsa)→approval→approved→testing(qa)→ready(dev)→active(dev)→review(qa)→complete

    it('pdsa can claim ready->active for pdsa role task', () => {
      const result = validateTransition('task', 'ready', 'active', 'pdsa', 'pdsa');
      expect(result).toBeNull();
    });

    it('pdsa can submit active->approval', () => {
      const result = validateTransition('task', 'active', 'approval', 'pdsa', 'pdsa');
      expect(result).toBeNull();
    });

    it('thomas can approve approval->approved', () => {
      const result = validateTransition('task', 'approval', 'approved', 'thomas', 'pdsa');
      expect(result).toBeNull();
    });

    it('approval->approved sets role to liaison', () => {
      const newRole = getNewRoleForTransition('task', 'approval', 'approved');
      expect(newRole).toBe('liaison');
    });

    it('liaison can transition approved->testing', () => {
      const result = validateTransition('task', 'approved', 'testing', 'liaison', 'liaison');
      expect(result).toBeNull();
    });

    it('approved->testing sets role to qa', () => {
      const newRole = getNewRoleForTransition('task', 'approved', 'testing');
      expect(newRole).toBe('qa');
    });

    it('qa can activate testing->active (to create tests)', () => {
      const result = validateTransition('task', 'testing', 'active', 'qa', 'qa');
      expect(result).toBeNull();
    });

    it('qa can transition testing->ready (tests done, dev can start)', () => {
      const result = validateTransition('task', 'testing', 'ready', 'qa', 'qa');
      expect(result).toBeNull();
    });

    it('testing->ready sets role to dev', () => {
      const newRole = getNewRoleForTransition('task', 'testing', 'ready');
      expect(newRole).toBe('dev');
    });

    it('dev can claim ready->active for dev role task', () => {
      const result = validateTransition('task', 'ready', 'active', 'dev', 'dev');
      expect(result).toBeNull();
    });

    it('dev can submit active->review', () => {
      const result = validateTransition('task', 'active', 'review', 'dev', 'dev');
      expect(result).toBeNull();
    });

    it('active->review sets role to qa', () => {
      const newRole = getNewRoleForTransition('task', 'active', 'review');
      expect(newRole).toBe('qa');
    });

    it('qa can send review->rework', () => {
      const result = validateTransition('task', 'review', 'rework', 'qa', 'qa');
      expect(result).toBeNull();
    });

    it('review->rework sets role to dev', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework');
      expect(newRole).toBe('dev');
    });

    it('dev can reclaim rework->active', () => {
      const result = validateTransition('task', 'rework', 'active', 'dev', 'dev');
      expect(result).toBeNull();
    });
  });

  describe('AC4: PDSA rework path (pdsa can claim pdsa rework)', () => {
    it('pdsa can claim rework->active for pdsa role task', () => {
      const result = validateTransition('task', 'rework', 'active', 'pdsa', 'pdsa');
      expect(result).toBeNull();
    });

    it('dev cannot claim pdsa rework', () => {
      const result = validateTransition('task', 'rework', 'active', 'dev', 'pdsa');
      expect(result).toContain('not allowed');
    });
  });
});

// ============================================================================
// WORKFLOW.md v12: Human-Decision Transitions (liaison executes)
// Source of Truth: docs/WORKFLOW.md
// ============================================================================

describe('WORKFLOW.md v12: Human-Decision Transitions', () => {

  describe('approval → approved/rework (human gate)', () => {
    it('liaison can approve approval->approved', () => {
      const result = validateTransition('task', 'approval', 'approved', 'liaison', 'pdsa');
      expect(result).toBeNull();
    });

    it('thomas can approve approval->approved', () => {
      const result = validateTransition('task', 'approval', 'approved', 'thomas', 'pdsa');
      expect(result).toBeNull();
    });

    it('liaison can reject approval->rework (autonomous)', () => {
      const result = validateTransition('task', 'approval', 'rework', 'liaison', 'pdsa');
      expect(result).toBeNull();
    });

    it('thomas can reject approval->rework (human decision)', () => {
      const result = validateTransition('task', 'approval', 'rework', 'thomas', 'pdsa');
      expect(result).toBeNull();
    });

    it('dev cannot reject approval->rework', () => {
      const result = validateTransition('task', 'approval', 'rework', 'dev', 'pdsa');
      expect(result).toContain('not allowed');
    });

    it('approval->rework routes to pdsa (design rejected, pdsa reworks)', () => {
      const newRole = getNewRoleForTransition('task', 'approval', 'rework');
      expect(newRole).toBe('pdsa');
    });
  });

  describe('review+liaison → complete/rework (final human gate)', () => {
    it('liaison can complete review+liaison (human approves final)', () => {
      const result = validateTransition('task', 'review', 'complete', 'liaison', 'liaison');
      expect(result).toBeNull();
    });

    it('review->complete with role=liaison sets role to liaison', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'complete', 'liaison');
      expect(newRole).toBe('liaison');
    });

    it('liaison can rework review+liaison (human rejects final)', () => {
      const result = validateTransition('task', 'review', 'rework', 'liaison', 'liaison');
      expect(result).toBeNull();
    });

    it('review->rework with role=liaison routes to liaison (not dev)', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework', 'liaison');
      expect(newRole).toBe('liaison');
    });
  });

  describe('complete → rework (human reopens)', () => {
    it('liaison can transition complete->rework', () => {
      const result = validateTransition('task', 'complete', 'rework', 'liaison', 'liaison');
      expect(result).toBeNull();
    });

    it('dev cannot transition complete->rework', () => {
      const result = validateTransition('task', 'complete', 'rework', 'dev', 'liaison');
      expect(result).toContain('not allowed');
    });

    it('qa cannot transition complete->rework', () => {
      const result = validateTransition('task', 'complete', 'rework', 'qa', 'liaison');
      expect(result).toContain('not allowed');
    });

    it('pdsa cannot transition complete->rework', () => {
      const result = validateTransition('task', 'complete', 'rework', 'pdsa', 'liaison');
      expect(result).toContain('not allowed');
    });

    it('liaison can reopen bugs complete->rework', () => {
      const result = validateTransition('bug', 'complete', 'rework', 'liaison', 'liaison');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// WORKFLOW.md v12: Rework Routing (7 entry points)
// ============================================================================

describe('WORKFLOW.md v12: Rework Routing', () => {

  describe('Rework role assignment per entry point', () => {
    // Entry 1+2: approval->rework → pdsa (liaison autonomous OR human rejects design)
    it('approval->rework routes to pdsa', () => {
      const newRole = getNewRoleForTransition('task', 'approval', 'rework');
      expect(newRole).toBe('pdsa');
    });

    // Entry 3: review+qa rework → dev (QA finds test issues)
    it('review->rework with role=qa routes to dev', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework', 'qa');
      expect(newRole).toBe('dev');
    });

    // Entry 4: review+pdsa rework → dev (PDSA finds design mismatch)
    it('review->rework with role=pdsa routes to dev', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework', 'pdsa');
      expect(newRole).toBe('dev');
    });

    // Entry 5: review+liaison rework → liaison (human rejects liaison content)
    it('review->rework with role=liaison routes to liaison', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework', 'liaison');
      expect(newRole).toBe('liaison');
    });
  });

  describe('PDSA review actors', () => {
    it('pdsa can rework from review+pdsa', () => {
      const result = validateTransition('task', 'review', 'rework', 'pdsa', 'pdsa');
      expect(result).toBeNull();
    });

    it('qa can rework from review+qa', () => {
      const result = validateTransition('task', 'review', 'rework', 'qa', 'qa');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// WORKFLOW.md v12: Liaison Content Path - Rework Re-entry
// ============================================================================

describe('WORKFLOW.md v12: Liaison Rework Re-entry', () => {

  it('liaison can reclaim rework->active for liaison role task', () => {
    const result = validateTransition('task', 'rework', 'active', 'liaison', 'liaison');
    expect(result).toBeNull();
  });

  it('dev cannot claim liaison rework', () => {
    const result = validateTransition('task', 'rework', 'active', 'dev', 'liaison');
    expect(result).not.toBeNull(); // Must be rejected
  });

  it('rework->active for liaison preserves liaison role', () => {
    const newRole = getNewRoleForTransition('task', 'rework', 'active', 'liaison');
    expect(newRole).toBeNull(); // Role preserved, not changed
  });
});

// ============================================================================
// WORKFLOW.md v12: QA Rework Re-entry (active+qa → testing)
// ============================================================================

describe('WORKFLOW.md v12: QA Rework Re-entry', () => {

  it('qa can transition active->testing when role=qa', () => {
    const result = validateTransition('task', 'active', 'testing', 'qa', 'qa');
    expect(result).toBeNull();
  });

  it('dev cannot transition active->testing', () => {
    const result = validateTransition('task', 'active', 'testing', 'dev', 'dev');
    expect(result).toContain('not allowed');
  });

  it('active->testing sets role to qa', () => {
    const newRole = getNewRoleForTransition('task', 'active', 'testing', 'qa');
    expect(newRole).toBe('qa');
  });

  it('qa can then transition testing->ready (hand to dev)', () => {
    const result = validateTransition('task', 'testing', 'ready', 'qa', 'qa');
    expect(result).toBeNull();
  });

  it('testing->ready sets role to dev', () => {
    const newRole = getNewRoleForTransition('task', 'testing', 'ready');
    expect(newRole).toBe('dev');
  });
});

// ============================================================================
// WORKFLOW.md v12: Review Chain (review→review with role change)
// ============================================================================

describe('WORKFLOW.md v12: Review Chain Transitions', () => {

  describe('review+qa → review+pdsa (QA approves, PDSA verifies)', () => {
    it('qa can transition review->review when role=qa', () => {
      const result = validateTransition('task', 'review', 'review', 'qa', 'qa');
      expect(result).toBeNull();
    });

    it('review->review with role=qa sets role to pdsa', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'review', 'qa');
      expect(newRole).toBe('pdsa');
    });

    it('dev cannot transition review->review', () => {
      const result = validateTransition('task', 'review', 'review', 'dev', 'qa');
      expect(result).toContain('not allowed');
    });
  });

  describe('review+pdsa → review+liaison (PDSA approves, liaison presents)', () => {
    it('pdsa can transition review->review when role=pdsa', () => {
      const result = validateTransition('task', 'review', 'review', 'pdsa', 'pdsa');
      expect(result).toBeNull();
    });

    it('review->review with role=pdsa sets role to liaison', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'review', 'pdsa');
      expect(newRole).toBe('liaison');
    });
  });

  describe('review+liaison → complete (human approves via liaison)', () => {
    // Already covered in Human-Decision Transitions tests
    it('liaison can complete from review+liaison', () => {
      const result = validateTransition('task', 'review', 'complete', 'liaison', 'liaison');
      expect(result).toBeNull();
    });
  });

  describe('Full review chain path', () => {
    it('review chain: qa→pdsa→liaison role progression', () => {
      // Step 1: review+qa - QA approves → role changes to pdsa
      const role1 = getNewRoleForTransition('task', 'review', 'review', 'qa');
      expect(role1).toBe('pdsa');

      // Step 2: review+pdsa - PDSA approves → role changes to liaison
      const role2 = getNewRoleForTransition('task', 'review', 'review', 'pdsa');
      expect(role2).toBe('liaison');

      // Step 3: review+liaison - human approves → complete
      const role3 = getNewRoleForTransition('task', 'review', 'complete', 'liaison');
      expect(role3).toBe('liaison');
    });
  });
});

// ============================================================================
// AC5: DNA Requirements Validation (pdsa_ref required for approval)
// ============================================================================

describe('AC5: DNA Requirements Validation', () => {

  describe('active->approval requires pdsa_ref', () => {
    it('allows active->approval when pdsa_ref is set', () => {
      const dna = { role: 'pdsa', pdsa_ref: 'pdsa/my-design.md' };
      const result = validateDnaRequirements('task', 'active', 'approval', dna, 'pdsa');
      expect(result).toBeNull();
    });

    it('rejects active->approval when pdsa_ref is missing', () => {
      const dna = { role: 'pdsa' };
      const result = validateDnaRequirements('task', 'active', 'approval', dna, 'pdsa');
      expect(result).toContain('pdsa_ref');
      expect(result).toContain('PDSA');
    });

    it('rejects active->approval when dna is null', () => {
      const result = validateDnaRequirements('task', 'active', 'approval', null, 'pdsa');
      expect(result).toContain('pdsa_ref');
    });

    it('rejects active->approval when pdsa_ref is empty string', () => {
      const dna = { role: 'pdsa', pdsa_ref: '' };
      const result = validateDnaRequirements('task', 'active', 'approval', dna, 'pdsa');
      expect(result).toContain('pdsa_ref');
    });
  });

  describe('other transitions do not require pdsa_ref', () => {
    it('allows pending->ready without pdsa_ref', () => {
      const dna = { role: 'pdsa' };
      const result = validateDnaRequirements('task', 'pending', 'ready', dna, null);
      expect(result).toBeNull();
    });

    it('allows ready->active without pdsa_ref', () => {
      const dna = { role: 'pdsa' };
      const result = validateDnaRequirements('task', 'ready', 'active', dna, 'pdsa');
      expect(result).toBeNull();
    });

    it('allows active->review (dev path) without pdsa_ref', () => {
      const dna = { role: 'dev' };
      const result = validateDnaRequirements('task', 'active', 'review', dna, 'dev');
      expect(result).toBeNull();
    });
  });

  describe('bug type does not require pdsa_ref', () => {
    it('allows bug active->review without pdsa_ref', () => {
      const dna = { role: 'dev' };
      const result = validateDnaRequirements('bug', 'active', 'review', dna, 'dev');
      expect(result).toBeNull();
    });
  });
});
