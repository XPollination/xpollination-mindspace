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
  validateType
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
