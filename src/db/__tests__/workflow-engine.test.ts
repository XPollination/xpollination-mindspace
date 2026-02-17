/**
 * Workflow Engine Tests — Source of Truth: docs/WORKFLOW.md v12
 *
 * EVERY test references the specific WORKFLOW.md v12 section it validates.
 * Tests are organized by workflow path, not by function.
 *
 * Bug context: PDSA agent was able to transition active→review on role=pdsa tasks.
 * Per WORKFLOW.md v12 line 21: only DEV is the actor for active→review.
 * PDSA tasks MUST go active→approval (line 15).
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

// Helper: assert transition is ALLOWED (returns null)
function expectAllowed(type: string, from: string, to: string, actor: string, role: string | null) {
  const result = validateTransition(type, from, to, actor, role);
  expect(result, `Expected ${type} ${from}→${to} by ${actor} (role=${role}) to be ALLOWED, got: ${result}`).toBeNull();
}

// Helper: assert transition is REJECTED (returns error string)
function expectRejected(type: string, from: string, to: string, actor: string, role: string | null) {
  const result = validateTransition(type, from, to, actor, role);
  expect(result, `Expected ${type} ${from}→${to} by ${actor} (role=${role}) to be REJECTED`).not.toBeNull();
}

// ==========================================================================
// 1. CONSTANTS — Verify exports match WORKFLOW.md v12
// ==========================================================================

describe('Constants match WORKFLOW.md v12', () => {
  it('VALID_STATUSES has all 11 statuses from Visualization Categories table', () => {
    // WORKFLOW.md v12 lines 96-106: pending, ready, active, approval, approved,
    // testing, review, rework, complete, blocked, cancelled
    const expected = [
      'pending', 'ready', 'active', 'approval', 'approved', 'testing',
      'review', 'rework', 'complete', 'blocked', 'cancelled'
    ];
    expect(VALID_STATUSES).toHaveLength(11);
    for (const s of expected) {
      expect(VALID_STATUSES).toContain(s);
    }
  });

  it('VALID_TYPES contains only task and bug', () => {
    expect(VALID_TYPES).toEqual(['task', 'bug']);
  });

  it('VALID_ROLES contains dev, pdsa, qa, liaison', () => {
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

// ==========================================================================
// 2. TYPE VALIDATION — validateType()
// ==========================================================================

describe('validateType()', () => {
  it('accepts "task"', () => {
    expect(validateType('task')).toBeNull();
  });

  it('accepts "bug"', () => {
    expect(validateType('bug')).toBeNull();
  });

  it.each(['design', 'requirement', 'feature', 'epic', ''])('rejects "%s"', (t) => {
    const result = validateType(t);
    expect(result).toContain('Invalid type');
  });
});

// ==========================================================================
// 3. PDSA DESIGN PATH — Happy path (WORKFLOW.md v12 lines 8-24)
//
//   pending → ready → active → approval → approved → testing →
//   ready(dev) → active(dev) → review(qa) → review(pdsa) →
//   review(liaison) → complete
// ==========================================================================

describe('PDSA Design Path (WORKFLOW.md v12 lines 8-24)', () => {

  // Step 1: pending → ready (Actor: system/liaison, Monitor: pdsa)
  describe('pending → ready', () => {
    it('system can transition', () => {
      expectAllowed('task', 'pending', 'ready', 'system', null);
    });

    it('liaison can transition', () => {
      expectAllowed('task', 'pending', 'ready', 'liaison', null);
    });

    it('dev CANNOT transition', () => {
      expectRejected('task', 'pending', 'ready', 'dev', null);
    });

    it('qa CANNOT transition', () => {
      expectRejected('task', 'pending', 'ready', 'qa', null);
    });

    it('preserves original role (no automatic override)', () => {
      const newRole = getNewRoleForTransition('task', 'pending', 'ready');
      expect(newRole).toBeNull();
    });
  });

  // Step 2: ready → active (Actor: pdsa, Monitor: pdsa) [role=pdsa]
  describe('ready → active (role=pdsa)', () => {
    it('pdsa can claim pdsa-role task', () => {
      expectAllowed('task', 'ready', 'active', 'pdsa', 'pdsa');
    });

    it('dev CANNOT claim pdsa-role task', () => {
      expectRejected('task', 'ready', 'active', 'dev', 'pdsa');
    });

    it('qa CANNOT claim pdsa-role task', () => {
      expectRejected('task', 'ready', 'active', 'qa', 'pdsa');
    });

    it('does NOT change role', () => {
      const newRole = getNewRoleForTransition('task', 'ready', 'active', 'pdsa');
      expect(newRole).toBeNull();
    });
  });

  // Step 3: active → approval (Actor: pdsa, Monitor: liaison) [requires pdsa_ref]
  describe('active → approval (role=pdsa)', () => {
    it('pdsa can submit to approval', () => {
      expectAllowed('task', 'active', 'approval', 'pdsa', 'pdsa');
    });

    it('dev CANNOT submit to approval (even if somehow role=pdsa)', () => {
      // dev is not in allowedActors for active->approval
      expectRejected('task', 'active', 'approval', 'dev', 'pdsa');
    });

    it('requires pdsa_ref in DNA', () => {
      const result = validateDnaRequirements('task', 'active', 'approval', { role: 'pdsa' }, 'pdsa');
      expect(result).toContain('pdsa_ref');
    });

    it('passes DNA check when pdsa_ref is a GitHub link', () => {
      const dna = { role: 'pdsa', pdsa_ref: 'https://github.com/XPollination/xpollination-mcp-server/blob/main/pdsa/my-design.md' };
      const result = validateDnaRequirements('task', 'active', 'approval', dna, 'pdsa');
      expect(result).toBeNull();
    });

    it('rejects local file path as pdsa_ref', () => {
      const dna = { role: 'pdsa', pdsa_ref: 'pdsa/my-design.md' };
      const result = validateDnaRequirements('task', 'active', 'approval', dna, 'pdsa');
      expect(result).toContain('GitHub link');
    });

    it('rejects docs/ path as pdsa_ref', () => {
      const dna = { role: 'pdsa', pdsa_ref: 'docs/my-design.md' };
      const result = validateDnaRequirements('task', 'active', 'approval', dna, 'pdsa');
      expect(result).toContain('GitHub link');
    });

    it('rejects empty pdsa_ref', () => {
      const dna = { role: 'pdsa', pdsa_ref: '' };
      const result = validateDnaRequirements('task', 'active', 'approval', dna, 'pdsa');
      expect(result).toContain('pdsa_ref');
    });

    it('rejects null DNA', () => {
      const result = validateDnaRequirements('task', 'active', 'approval', null, 'pdsa');
      expect(result).toContain('pdsa_ref');
    });

    it('sets role to liaison on active→approval (bug fix verification)', () => {
      const newRole = getNewRoleForTransition('task', 'active', 'approval');
      expect(newRole).toBe('liaison');
    });
  });

  // Step 4: approval → approved (Actor: human/liaison, Monitor: qa)
  describe('approval → approved', () => {
    it('liaison can approve (human proxy)', () => {
      expectAllowed('task', 'approval', 'approved', 'liaison', 'pdsa');
    });

    it('thomas can approve (human)', () => {
      expectAllowed('task', 'approval', 'approved', 'thomas', 'pdsa');
    });

    it('pdsa CANNOT approve', () => {
      expectRejected('task', 'approval', 'approved', 'pdsa', 'pdsa');
    });

    it('dev CANNOT approve', () => {
      expectRejected('task', 'approval', 'approved', 'dev', 'pdsa');
    });

    it('qa CANNOT approve', () => {
      expectRejected('task', 'approval', 'approved', 'qa', 'pdsa');
    });

    it('sets role to liaison', () => {
      const newRole = getNewRoleForTransition('task', 'approval', 'approved');
      expect(newRole).toBe('liaison');
    });
  });

  // Step 5: approved → testing (Actor: liaison, Monitor: qa)
  describe('approved → testing', () => {
    it('liaison can transition', () => {
      expectAllowed('task', 'approved', 'testing', 'liaison', 'liaison');
    });

    it('dev CANNOT transition', () => {
      expectRejected('task', 'approved', 'testing', 'dev', 'liaison');
    });

    it('sets role to qa', () => {
      const newRole = getNewRoleForTransition('task', 'approved', 'testing');
      expect(newRole).toBe('qa');
    });
  });

  // Step 6: testing → ready (Actor: qa, Monitor: dev)
  describe('testing → ready', () => {
    it('qa can transition', () => {
      expectAllowed('task', 'testing', 'ready', 'qa', 'qa');
    });

    it('dev CANNOT transition', () => {
      expectRejected('task', 'testing', 'ready', 'dev', 'qa');
    });

    it('sets role to dev', () => {
      const newRole = getNewRoleForTransition('task', 'testing', 'ready');
      expect(newRole).toBe('dev');
    });
  });

  // Step 7: ready → active (Actor: dev, Monitor: dev) [role=dev]
  describe('ready → active (role=dev)', () => {
    it('dev can claim dev-role task', () => {
      expectAllowed('task', 'ready', 'active', 'dev', 'dev');
    });

    it('pdsa CANNOT claim dev-role task', () => {
      expectRejected('task', 'ready', 'active', 'pdsa', 'dev');
    });

    it('does NOT change role', () => {
      const newRole = getNewRoleForTransition('task', 'ready', 'active', 'dev');
      expect(newRole).toBeNull();
    });
  });

  // Step 8: active → review (Actor: dev, Monitor: qa) [CRITICAL: only dev]
  describe('active → review (role=dev) — THE BUG FIX', () => {
    it('dev can submit to review', () => {
      expectAllowed('task', 'active', 'review', 'dev', 'dev');
    });

    it('sets role to qa', () => {
      const newRole = getNewRoleForTransition('task', 'active', 'review', 'dev');
      expect(newRole).toBe('qa');
    });

    // THE BUG: PDSA must NOT be able to send to review
    it('PDSA CANNOT submit active→review (must use active→approval)', () => {
      expectRejected('task', 'active', 'review', 'pdsa', 'pdsa');
    });

    it('qa CANNOT submit active→review', () => {
      expectRejected('task', 'active', 'review', 'qa', 'dev');
    });

    // Verify the ALLOWED_TRANSITIONS spec: pdsa should NOT be in allowedActors
    it('active->review allowedActors should NOT include pdsa', () => {
      const rule = ALLOWED_TRANSITIONS['task']['active->review'];
      expect(rule.allowedActors).not.toContain('pdsa');
    });
  });

  // Step 9: review → review (Actor: qa, role=qa → pdsa) [review chain step 1]
  describe('review chain: review+qa → review+pdsa', () => {
    it('qa can transition review→review when role=qa', () => {
      expectAllowed('task', 'review', 'review', 'qa', 'qa');
    });

    it('sets role to pdsa', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'review', 'qa');
      expect(newRole).toBe('pdsa');
    });

    it('dev CANNOT do review→review', () => {
      expectRejected('task', 'review', 'review', 'dev', 'qa');
    });
  });

  // Step 10: review → review (Actor: pdsa, role=pdsa → liaison) [review chain step 2]
  describe('review chain: review+pdsa → review+liaison', () => {
    it('pdsa can transition review→review when role=pdsa', () => {
      expectAllowed('task', 'review', 'review', 'pdsa', 'pdsa');
    });

    it('sets role to liaison', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'review', 'pdsa');
      expect(newRole).toBe('liaison');
    });
  });

  // Step 11: review → complete (Actor: human/liaison, role=liaison) [final gate]
  describe('review+liaison → complete', () => {
    it('liaison can complete', () => {
      expectAllowed('task', 'review', 'complete', 'liaison', 'liaison');
    });

    it('qa CANNOT complete', () => {
      expectRejected('task', 'review', 'complete', 'qa', 'qa');
    });

    it('pdsa CANNOT complete', () => {
      expectRejected('task', 'review', 'complete', 'pdsa', 'pdsa');
    });

    it('pdsa CANNOT complete even when role=liaison', () => {
      // Per WORKFLOW.md v12 line 127: review+liaison→complete is human-decision
      // Only liaison (human proxy) can complete
      expectRejected('task', 'review', 'complete', 'pdsa', 'liaison');
    });

    it('dev CANNOT complete', () => {
      expectRejected('task', 'review', 'complete', 'dev', 'liaison');
    });

    it('sets role to liaison on complete', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'complete', 'liaison');
      expect(newRole).toBe('liaison');
    });
  });

  // Full review chain integration
  describe('full review chain: qa → pdsa → liaison → complete', () => {
    it('role progresses correctly through review chain', () => {
      // Start: review+qa (after dev submits)
      const step1 = getNewRoleForTransition('task', 'review', 'review', 'qa');
      expect(step1).toBe('pdsa');

      // review+pdsa → review+liaison
      const step2 = getNewRoleForTransition('task', 'review', 'review', 'pdsa');
      expect(step2).toBe('liaison');

      // review+liaison → complete
      const step3 = getNewRoleForTransition('task', 'review', 'complete', 'liaison');
      expect(step3).toBe('liaison');
    });
  });
});

// ==========================================================================
// 4. LIAISON CONTENT PATH (WORKFLOW.md v12 lines 80-90)
//
//   pending → ready(liaison) → active(liaison) → review(liaison) → complete
// ==========================================================================

describe('Liaison Content Path (WORKFLOW.md v12 lines 80-90)', () => {

  describe('pending → ready (liaison)', () => {
    it('liaison can transition', () => {
      expectAllowed('task', 'pending', 'ready', 'liaison', 'liaison');
    });

    it('preserves liaison role', () => {
      const newRole = getNewRoleForTransition('task', 'pending', 'ready');
      expect(newRole).toBeNull(); // Role preserved
    });
  });

  describe('ready → active (liaison, role=liaison)', () => {
    it('liaison can claim liaison-role task', () => {
      expectAllowed('task', 'ready', 'active', 'liaison', 'liaison');
    });

    it('dev CANNOT claim liaison-role task', () => {
      expectRejected('task', 'ready', 'active', 'dev', 'liaison');
    });
  });

  describe('active → review (liaison, role=liaison)', () => {
    it('liaison can submit to review', () => {
      expectAllowed('task', 'active', 'review', 'liaison', 'liaison');
    });

    it('role stays liaison (liaison presents to human)', () => {
      const newRole = getNewRoleForTransition('task', 'active', 'review', 'liaison');
      expect(newRole).toBe('liaison');
    });
  });

  describe('review+liaison → complete', () => {
    it('liaison can complete', () => {
      expectAllowed('task', 'review', 'complete', 'liaison', 'liaison');
    });
  });
});

// ==========================================================================
// 5. BUG PATH (WORKFLOW.md v12 lines 91-106, simplified)
//
//   pending → ready(dev) → active(dev) → review(qa) → complete
// ==========================================================================

describe('Bug Path (simplified, no PDSA gate)', () => {

  describe('pending → ready', () => {
    it('liaison can transition', () => {
      expectAllowed('bug', 'pending', 'ready', 'liaison', null);
    });

    it('pdsa can transition', () => {
      expectAllowed('bug', 'pending', 'ready', 'pdsa', null);
    });

    it('system can transition', () => {
      expectAllowed('bug', 'pending', 'ready', 'system', null);
    });

    it('dev CANNOT transition', () => {
      expectRejected('bug', 'pending', 'ready', 'dev', null);
    });

    it('sets role to dev', () => {
      const newRole = getNewRoleForTransition('bug', 'pending', 'ready');
      expect(newRole).toBe('dev');
    });
  });

  describe('ready → active (dev)', () => {
    it('dev can claim', () => {
      expectAllowed('bug', 'ready', 'active', 'dev', 'dev');
    });

    it('pdsa CANNOT claim bug', () => {
      expectRejected('bug', 'ready', 'active', 'pdsa', 'dev');
    });
  });

  describe('active → review (dev)', () => {
    it('dev can submit to review', () => {
      expectAllowed('bug', 'active', 'review', 'dev', 'dev');
    });

    it('sets role to qa', () => {
      const newRole = getNewRoleForTransition('bug', 'active', 'review');
      expect(newRole).toBe('qa');
    });
  });

  describe('review → complete', () => {
    it('liaison can complete bug', () => {
      expectAllowed('bug', 'review', 'complete', 'liaison', 'qa');
    });

    it('qa CANNOT complete bug', () => {
      expectRejected('bug', 'review', 'complete', 'qa', 'qa');
    });

    it('pdsa CANNOT complete bug', () => {
      expectRejected('bug', 'review', 'complete', 'pdsa', 'qa');
    });

    it('dev CANNOT complete bug', () => {
      expectRejected('bug', 'review', 'complete', 'dev', 'qa');
    });
  });

  describe('review → rework (bug)', () => {
    it('qa can send bug to rework', () => {
      expectAllowed('bug', 'review', 'rework', 'qa', 'qa');
    });

    it('sets role to dev', () => {
      const newRole = getNewRoleForTransition('bug', 'review', 'rework');
      expect(newRole).toBe('dev');
    });
  });

  describe('review → review:qa (bug, QA forwards to PDSA)', () => {
    it('qa can forward bug review to pdsa', () => {
      expectAllowed('bug', 'review', 'review', 'qa', 'qa');
    });

    it('sets role to pdsa on review→review (role=qa)', () => {
      const newRole = getNewRoleForTransition('bug', 'review', 'review', 'qa');
      expect(newRole).toBe('pdsa');
    });

    it('dev CANNOT forward bug review', () => {
      expectRejected('bug', 'review', 'review', 'dev', 'qa');
    });
  });

  describe('review → review:pdsa (bug, PDSA forwards to Liaison)', () => {
    it('pdsa can forward bug review to liaison', () => {
      expectAllowed('bug', 'review', 'review', 'pdsa', 'pdsa');
    });

    it('sets role to liaison on review→review (role=pdsa)', () => {
      const newRole = getNewRoleForTransition('bug', 'review', 'review', 'pdsa');
      expect(newRole).toBe('liaison');
    });

    it('qa CANNOT use pdsa review forward', () => {
      expectRejected('bug', 'review', 'review', 'qa', 'pdsa');
    });
  });

  describe('rework → active (bug)', () => {
    it('dev can reclaim bug rework', () => {
      expectAllowed('bug', 'rework', 'active', 'dev', 'dev');
    });
  });

  describe('complete → rework (bug, human reopens)', () => {
    it('liaison can reopen bug', () => {
      expectAllowed('bug', 'complete', 'rework', 'liaison', 'liaison');
    });

    it('dev CANNOT reopen bug', () => {
      expectRejected('bug', 'complete', 'rework', 'dev', 'liaison');
    });
  });
});

// ==========================================================================
// 6. REWORK ENTRY POINTS (WORKFLOW.md v12 lines 42-77)
//    7 entry points, each with specific actor and target role
// ==========================================================================

describe('Rework Entry Points (WORKFLOW.md v12 lines 42-56)', () => {

  // Entry 1: liaison catches issue (autonomous) → rework+pdsa
  describe('rework from approval (liaison autonomous)', () => {
    it('liaison can reject approval→rework', () => {
      expectAllowed('task', 'approval', 'rework', 'liaison', 'pdsa');
    });

    it('routes to pdsa', () => {
      const newRole = getNewRoleForTransition('task', 'approval', 'rework');
      expect(newRole).toBe('pdsa');
    });
  });

  // Entry 2: human rejects design (from approval) → rework+pdsa
  describe('rework from approval (human rejects)', () => {
    it('thomas can reject approval→rework', () => {
      expectAllowed('task', 'approval', 'rework', 'thomas', 'pdsa');
    });

    it('dev CANNOT reject approval', () => {
      expectRejected('task', 'approval', 'rework', 'dev', 'pdsa');
    });

    it('qa CANNOT reject approval', () => {
      expectRejected('task', 'approval', 'rework', 'qa', 'pdsa');
    });
  });

  // Entry 3: QA finds test issues (from review+qa) → rework+dev
  describe('rework from review+qa (QA finds issues)', () => {
    it('qa can send review→rework when role=qa', () => {
      expectAllowed('task', 'review', 'rework', 'qa', 'qa');
    });

    it('routes to dev', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework', 'qa');
      expect(newRole).toBe('dev');
    });
  });

  // Entry 4: PDSA finds design mismatch (from review+pdsa) → rework+dev
  describe('rework from review+pdsa (PDSA finds mismatch)', () => {
    it('pdsa can send review→rework when role=pdsa', () => {
      expectAllowed('task', 'review', 'rework', 'pdsa', 'pdsa');
    });

    it('routes to dev', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework', 'pdsa');
      expect(newRole).toBe('dev');
    });
  });

  // Entry 5+6+7: Human reopens — liaison executes (WORKFLOW.md v12 lines 119-131)
  describe('rework from review+liaison (human rejects final)', () => {
    it('liaison can send review→rework when role=liaison', () => {
      expectAllowed('task', 'review', 'rework', 'liaison', 'liaison');
    });

    it('routes to liaison (not dev)', () => {
      const newRole = getNewRoleForTransition('task', 'review', 'rework', 'liaison');
      expect(newRole).toBe('liaison');
    });
  });

  // Entry: complete → rework (human reopens completed task)
  describe('complete → rework (human reopens)', () => {
    it('liaison can reopen completed task', () => {
      expectAllowed('task', 'complete', 'rework', 'liaison', 'liaison');
    });

    it('dev CANNOT reopen', () => {
      expectRejected('task', 'complete', 'rework', 'dev', 'liaison');
    });

    it('qa CANNOT reopen', () => {
      expectRejected('task', 'complete', 'rework', 'qa', 'liaison');
    });

    it('pdsa CANNOT reopen', () => {
      expectRejected('task', 'complete', 'rework', 'pdsa', 'liaison');
    });
  });
});

// ==========================================================================
// 7. REWORK RE-ENTRY — Role-matched claiming (WORKFLOW.md v12 lines 55-71)
//    rework → active: only the matching role can reclaim
// ==========================================================================

describe('Rework Re-entry (role-matched claiming)', () => {

  describe('rework+pdsa → active+pdsa', () => {
    it('pdsa can reclaim pdsa rework', () => {
      expectAllowed('task', 'rework', 'active', 'pdsa', 'pdsa');
    });

    it('dev CANNOT claim pdsa rework', () => {
      expectRejected('task', 'rework', 'active', 'dev', 'pdsa');
    });

    it('qa CANNOT claim pdsa rework', () => {
      expectRejected('task', 'rework', 'active', 'qa', 'pdsa');
    });
  });

  describe('rework+dev → active+dev', () => {
    it('dev can reclaim dev rework', () => {
      expectAllowed('task', 'rework', 'active', 'dev', 'dev');
    });

    it('pdsa CANNOT claim dev rework', () => {
      expectRejected('task', 'rework', 'active', 'pdsa', 'dev');
    });
  });

  describe('rework+qa → active+qa', () => {
    it('qa can reclaim qa rework', () => {
      expectAllowed('task', 'rework', 'active', 'qa', 'qa');
    });

    it('dev CANNOT claim qa rework', () => {
      expectRejected('task', 'rework', 'active', 'dev', 'qa');
    });
  });

  describe('rework+liaison → active+liaison', () => {
    it('liaison can reclaim liaison rework', () => {
      expectAllowed('task', 'rework', 'active', 'liaison', 'liaison');
    });

    it('dev CANNOT claim liaison rework', () => {
      expectRejected('task', 'rework', 'active', 'dev', 'liaison');
    });
  });

  describe('rework→active preserves role (no automatic change)', () => {
    it('does not change role for pdsa rework', () => {
      const newRole = getNewRoleForTransition('task', 'rework', 'active', 'pdsa');
      expect(newRole).toBeNull();
    });

    it('does not change role for dev rework', () => {
      const newRole = getNewRoleForTransition('task', 'rework', 'active', 'dev');
      expect(newRole).toBeNull();
    });

    it('does not change role for qa rework', () => {
      const newRole = getNewRoleForTransition('task', 'rework', 'active', 'qa');
      expect(newRole).toBeNull();
    });

    it('does not change role for liaison rework', () => {
      const newRole = getNewRoleForTransition('task', 'rework', 'active', 'liaison');
      expect(newRole).toBeNull();
    });
  });
});

// ==========================================================================
// 8. QA REWORK RE-ENTRY (WORKFLOW.md v12 line 31, 63-64)
//    rework+qa → active+qa → testing → ready(dev) → ...
// ==========================================================================

describe('QA Rework Re-entry Path', () => {

  it('qa can transition active→testing when role=qa', () => {
    expectAllowed('task', 'active', 'testing', 'qa', 'qa');
  });

  it('dev CANNOT transition active→testing', () => {
    expectRejected('task', 'active', 'testing', 'dev', 'dev');
  });

  it('pdsa CANNOT transition active→testing', () => {
    expectRejected('task', 'active', 'testing', 'pdsa', 'pdsa');
  });

  it('active→testing sets role to qa', () => {
    const newRole = getNewRoleForTransition('task', 'active', 'testing', 'qa');
    expect(newRole).toBe('qa');
  });

  it('testing→active allows qa (for test creation)', () => {
    expectAllowed('task', 'testing', 'active', 'qa', 'qa');
  });

  it('testing→ready (qa hands to dev)', () => {
    expectAllowed('task', 'testing', 'ready', 'qa', 'qa');
  });

  it('testing→ready sets role to dev', () => {
    const newRole = getNewRoleForTransition('task', 'testing', 'ready');
    expect(newRole).toBe('dev');
  });
});

// ==========================================================================
// 9. HUMAN-DECISION TRANSITIONS (WORKFLOW.md v12 lines 119-131)
//    Liaison executes on behalf of human
// ==========================================================================

describe('Human-Decision Transitions (liaison executes)', () => {

  it('approval→approved: liaison can', () => {
    expectAllowed('task', 'approval', 'approved', 'liaison', 'pdsa');
  });

  it('approval→approved: thomas can', () => {
    expectAllowed('task', 'approval', 'approved', 'thomas', 'pdsa');
  });

  it('approval→rework: liaison can', () => {
    expectAllowed('task', 'approval', 'rework', 'liaison', 'pdsa');
  });

  it('approval→rework: thomas can', () => {
    expectAllowed('task', 'approval', 'rework', 'thomas', 'pdsa');
  });

  it('review+liaison→complete: liaison can', () => {
    expectAllowed('task', 'review', 'complete', 'liaison', 'liaison');
  });

  it('review+liaison→rework: liaison can', () => {
    expectAllowed('task', 'review', 'rework', 'liaison', 'liaison');
  });

  it('complete→rework: liaison can', () => {
    expectAllowed('task', 'complete', 'rework', 'liaison', 'liaison');
  });
});

// ==========================================================================
// 10. SPECIAL TRANSITIONS — any→blocked, any→cancelled
// ==========================================================================

describe('Special transitions (any→blocked, any→cancelled)', () => {

  it.each(['pending', 'ready', 'active', 'review', 'rework'])(
    'liaison can block from %s',
    (fromStatus) => {
      expectAllowed('task', fromStatus, 'blocked', 'liaison', null);
    }
  );

  it.each(['pending', 'ready', 'active', 'review', 'rework'])(
    'system can cancel from %s',
    (fromStatus) => {
      expectAllowed('task', fromStatus, 'cancelled', 'system', null);
    }
  );

  it('dev CANNOT block', () => {
    expectRejected('task', 'active', 'blocked', 'dev', 'dev');
  });

  it('dev CANNOT cancel', () => {
    expectRejected('task', 'active', 'cancelled', 'dev', 'dev');
  });
});

// ==========================================================================
// 11. UNDEFINED/FORBIDDEN TRANSITIONS — Must be REJECTED
// ==========================================================================

describe('Undefined transitions are PROHIBITED', () => {

  it('pending→active (skip ready)', () => {
    expectRejected('task', 'pending', 'active', 'liaison', null);
  });

  it('pending→review (skip everything)', () => {
    expectRejected('task', 'pending', 'review', 'liaison', null);
  });

  it('active→complete (skip review)', () => {
    expectRejected('task', 'active', 'complete', 'dev', 'dev');
  });

  it('ready→review (skip active)', () => {
    expectRejected('task', 'ready', 'review', 'dev', 'dev');
  });

  it('review→ready (backwards)', () => {
    expectRejected('task', 'review', 'ready', 'qa', 'qa');
  });

  it('approved→complete (skip testing/dev/review)', () => {
    expectRejected('task', 'approved', 'complete', 'liaison', 'liaison');
  });

  it('testing→complete (skip dev implementation)', () => {
    expectRejected('task', 'testing', 'complete', 'qa', 'qa');
  });

  it('blocked→active (not defined)', () => {
    expectRejected('task', 'blocked', 'active', 'liaison', 'dev');
  });
});

// ==========================================================================
// 12. CRITICAL NEGATIVE TESTS — Specific forbidden actor/role combos
//     These are the scenarios that MUST be blocked per WORKFLOW.md v12
// ==========================================================================

describe('Critical forbidden transitions (spec enforcement)', () => {

  // THE BUG: PDSA sending pdsa-role task to review
  describe('PDSA cannot bypass approval gate', () => {
    it('pdsa CANNOT do active→review on role=pdsa task', () => {
      expectRejected('task', 'active', 'review', 'pdsa', 'pdsa');
    });

    it('pdsa CANNOT do active→review on role=dev task (wrong actor)', () => {
      // Even if somehow role=dev, pdsa should not be actor for active→review
      expectRejected('task', 'active', 'review', 'pdsa', 'dev');
    });

    it('pdsa active→review allowedActors MUST NOT include pdsa', () => {
      // Structural test: verify the rule itself is correct
      const rule = ALLOWED_TRANSITIONS['task']['active->review'];
      expect(rule.allowedActors).not.toContain('pdsa');
    });
  });

  // Dev cannot approve designs
  describe('Dev cannot act as human proxy', () => {
    it('dev CANNOT approve (approval→approved)', () => {
      expectRejected('task', 'approval', 'approved', 'dev', 'pdsa');
    });

    it('dev CANNOT complete (review→complete)', () => {
      expectRejected('task', 'review', 'complete', 'dev', 'liaison');
    });

    it('dev CANNOT reopen (complete→rework)', () => {
      expectRejected('task', 'complete', 'rework', 'dev', 'liaison');
    });
  });

  // Cross-role claiming
  describe('Cross-role claiming is blocked', () => {
    it('dev cannot claim pdsa ready task', () => {
      expectRejected('task', 'ready', 'active', 'dev', 'pdsa');
    });

    it('pdsa cannot claim dev ready task', () => {
      expectRejected('task', 'ready', 'active', 'pdsa', 'dev');
    });

    it('qa cannot claim dev ready task', () => {
      expectRejected('task', 'ready', 'active', 'qa', 'dev');
    });

    it('dev cannot claim qa ready task', () => {
      expectRejected('task', 'ready', 'active', 'dev', 'qa');
    });
  });
});

// ==========================================================================
// 13. DNA REQUIREMENTS (non-approval transitions don't need pdsa_ref)
// ==========================================================================

describe('DNA Requirements — only active→approval requires pdsa_ref', () => {

  it('pending→ready does NOT require pdsa_ref', () => {
    const result = validateDnaRequirements('task', 'pending', 'ready', { role: 'pdsa' }, null);
    expect(result).toBeNull();
  });

  it('ready→active does NOT require pdsa_ref', () => {
    const result = validateDnaRequirements('task', 'ready', 'active', { role: 'pdsa' }, 'pdsa');
    expect(result).toBeNull();
  });

  it('active→review (dev path) does NOT require pdsa_ref', () => {
    const result = validateDnaRequirements('task', 'active', 'review', { role: 'dev' }, 'dev');
    expect(result).toBeNull();
  });

  it('bug active→review does NOT require pdsa_ref', () => {
    const result = validateDnaRequirements('bug', 'active', 'review', { role: 'dev' }, 'dev');
    expect(result).toBeNull();
  });
});

// ==========================================================================
// 14. EDGE CASES
// ==========================================================================

describe('Edge cases', () => {

  it('invalid type returns error from validateTransition', () => {
    const result = validateTransition('epic', 'pending', 'ready', 'liaison', null);
    expect(result).toContain('Invalid type');
  });

  it('getNewRoleForTransition returns null for invalid type', () => {
    expect(getNewRoleForTransition('epic', 'pending', 'ready')).toBeNull();
  });

  it('getNewRoleForTransition returns null for undefined transition', () => {
    expect(getNewRoleForTransition('task', 'pending', 'active')).toBeNull();
  });

  it('validateDnaRequirements returns null for invalid type', () => {
    expect(validateDnaRequirements('epic', 'active', 'approval', null, null)).toBeNull();
  });

  it('validateDnaRequirements returns null for undefined transition', () => {
    expect(validateDnaRequirements('task', 'pending', 'active', null, null)).toBeNull();
  });
});
