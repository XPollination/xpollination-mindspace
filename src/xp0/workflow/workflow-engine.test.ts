import { describe, it, expect } from 'vitest';
import { validateWorkflow } from './workflow-engine.js';

// Helper: create minimal twin content with status and role
function twinContent(status: string, role: string, extra: Record<string, unknown> = {}) {
  return { status, role, ...extra };
}

// ─── AC1: Valid transitions accepted ───

describe('valid transitions', () => {
  it('ready+dev → active+dev is valid', () => {
    const from = twinContent('ready', 'dev');
    const to = twinContent('active', 'dev');
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });

  it('active+dev → review+dev is valid', () => {
    const from = twinContent('active', 'dev');
    const to = twinContent('review', 'dev');
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });

  it('active+pdsa → approval+pdsa is valid', () => {
    const from = twinContent('active', 'pdsa');
    const to = twinContent('approval', 'pdsa', {
      pdsa_ref: 'https://example.com/pdsa',
      memory_contribution_id: 'uuid-123',
    });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });

  it('review+qa → review (forward) is valid', () => {
    const from = twinContent('review', 'qa');
    const to = twinContent('review', 'pdsa');
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });
});

// ─── AC2: Invalid transitions rejected with reason ───

describe('invalid transitions', () => {
  it('ready+dev → complete is rejected', () => {
    const from = twinContent('ready', 'dev');
    const to = twinContent('complete', 'dev');
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toMatch(/transition/i);
  });

  it('pending → complete is rejected', () => {
    const from = twinContent('pending', 'liaison');
    const to = twinContent('complete', 'liaison');
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
  });

  it('complete → active is rejected (terminal state)', () => {
    const from = twinContent('complete', 'liaison');
    const to = twinContent('active', 'dev');
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
  });
});

// ─── AC3: Role consistency on fixed-role states ───

describe('role consistency — fixed-role states', () => {
  it('complete must have role=liaison', () => {
    const from = twinContent('review', 'liaison');
    const to = twinContent('complete', 'dev'); // wrong role
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/role/i);
  });

  it('approval must have role=liaison', () => {
    const from = twinContent('active', 'pdsa');
    const to = twinContent('approval', 'dev', {
      pdsa_ref: 'ref',
      memory_contribution_id: 'id',
    }); // wrong role
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/role/i);
  });

  it('approved must have role=qa', () => {
    const from = twinContent('approval', 'liaison');
    const to = twinContent('approved', 'dev', {
      human_answer: 'approved',
      human_answer_at: new Date().toISOString(),
      approval_mode: 'autonomous',
    }); // wrong role
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/role/i);
  });

  it('testing must have role=qa', () => {
    const from = twinContent('active', 'qa');
    const to = twinContent('testing', 'dev'); // wrong role
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/role/i);
  });
});

// ─── AC4: Quality gates ───

describe('quality gates', () => {
  it('active→approval requires pdsa_ref', () => {
    const from = twinContent('active', 'pdsa');
    const to = twinContent('approval', 'pdsa', {
      memory_contribution_id: 'uuid',
      // missing pdsa_ref
    });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/pdsa_ref/i);
  });

  it('active→approval requires memory_contribution_id', () => {
    const from = twinContent('active', 'pdsa');
    const to = twinContent('approval', 'pdsa', {
      pdsa_ref: 'ref',
      // missing memory_contribution_id
    });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/memory_contribution/i);
  });

  it('active→approval passes with both required fields', () => {
    const from = twinContent('active', 'pdsa');
    const to = twinContent('approval', 'pdsa', {
      pdsa_ref: 'https://example.com/pdsa',
      memory_contribution_id: 'uuid-123',
    });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });
});

// ─── AC5: Rework routing ───

describe('rework routing', () => {
  it('rework transition requires rework_target_role', () => {
    const from = twinContent('review', 'qa');
    const to = twinContent('rework', 'qa');
    // missing rework_target_role
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/rework_target_role/i);
  });

  it('rework transition with rework_target_role passes', () => {
    const from = twinContent('review', 'qa');
    const to = twinContent('rework', 'qa', { rework_target_role: 'dev' });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });
});

// ─── AC6: Blocked state ───

describe('blocked state', () => {
  it('blocked transition stores blocked_from_state and blocked_from_role', () => {
    const from = twinContent('active', 'dev');
    const to = twinContent('blocked', 'dev', {
      blocked_from_state: 'active',
      blocked_from_role: 'dev',
      blocked_reason: 'dependency unavailable',
    });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });

  it('blocked transition without blocked_from_state is rejected', () => {
    const from = twinContent('active', 'dev');
    const to = twinContent('blocked', 'dev', {
      blocked_reason: 'something',
    });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/blocked_from/i);
  });
});

// ─── AC7: Human answer audit trail ───

describe('human answer audit trail', () => {
  it('approval→approved requires human_answer fields', () => {
    const from = twinContent('approval', 'liaison');
    const to = twinContent('approved', 'qa');
    // missing human_answer, human_answer_at, approval_mode
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/human_answer/i);
  });

  it('approval→approved passes with all audit fields', () => {
    const from = twinContent('approval', 'liaison');
    const to = twinContent('approved', 'qa', {
      human_answer: 'Approved — design is correct',
      human_answer_at: new Date().toISOString(),
      approval_mode: 'autonomous',
    });
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });

  it('review+liaison → complete requires human_answer fields', () => {
    const from = twinContent('review', 'liaison');
    const to = twinContent('complete', 'liaison');
    // missing human_answer
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/human_answer/i);
  });
});

// ─── AC8: TransactionValidator Step 5 integration ───

describe('TransactionValidator Step 5 integration', () => {
  it('validateWorkflow returns {valid, reason?} compatible with TX validator', () => {
    const from = twinContent('ready', 'dev');
    const to = twinContent('active', 'dev');
    const result = validateWorkflow(from, to);
    expect(typeof result.valid).toBe('boolean');
    expect(result.reason === undefined || typeof result.reason === 'string').toBe(true);
  });
});
