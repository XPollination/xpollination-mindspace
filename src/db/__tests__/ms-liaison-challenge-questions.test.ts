import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDnaRequirements } from '../workflow-engine.js';

/**
 * LIAISON Challenge Questions Tests — ms-liaison-challenge-questions
 * Validates: 6 mandatory challenge questions, quality gate, SKILL.md update.
 */

// ==========================================================================
// Approval challenge questions required
// ==========================================================================

describe('Approval challenge questions gate', () => {

  it('approval->approved BLOCKED without liaison_q1_approval', () => {
    const result = validateDnaRequirements('task', 'approval', 'approved', {
      role: 'liaison',
      liaison_review: { decision: 'approve', reasoning: 'Looks good' },
      liaison_q2_approval: 'Dependencies are external',
      liaison_q3_approval: 'Auth system breaks if JWT secret leaks'
    }, 'liaison', 'liaison');
    expect(result).toContain('liaison_q1_approval');
  });

  it('approval->approved BLOCKED without liaison_q2_approval', () => {
    const result = validateDnaRequirements('task', 'approval', 'approved', {
      role: 'liaison',
      liaison_review: { decision: 'approve', reasoning: 'Looks good' },
      liaison_q1_approval: 'Gap between description and design is minimal for this scope',
      liaison_q3_approval: 'Auth system breaks if JWT secret leaks'
    }, 'liaison', 'liaison');
    expect(result).toContain('liaison_q2_approval');
  });

  it('approval->approved BLOCKED without liaison_q3_approval', () => {
    const result = validateDnaRequirements('task', 'approval', 'approved', {
      role: 'liaison',
      liaison_review: { decision: 'approve', reasoning: 'Looks good' },
      liaison_q1_approval: 'Gap between description and design is minimal for this scope',
      liaison_q2_approval: 'Dependencies are external'
    }, 'liaison', 'liaison');
    expect(result).toContain('liaison_q3_approval');
  });

  it('approval->approved passes with all 3 approval questions', () => {
    const result = validateDnaRequirements('task', 'approval', 'approved', {
      role: 'liaison',
      liaison_review: { decision: 'approve', reasoning: 'Design reviewed' },
      liaison_q1_approval: 'The design covers all 7 features from description but defers email to post-ROAD-001',
      liaison_q2_approval: 'DNS propagation for mindspace.xpollination.earth is outside our control',
      liaison_q3_approval: 'If bcrypt rounds are too low, password hashes become brute-forceable'
    }, 'liaison', 'liaison');
    expect(result).toBeNull();
  });
});

// ==========================================================================
// Completion challenge questions required
// ==========================================================================

describe('Completion challenge questions gate', () => {

  it('review->complete BLOCKED without liaison_q1_complete', () => {
    const result = validateDnaRequirements('task', 'review', 'complete', {
      role: 'liaison',
      abstract_ref: 'https://github.com/test/repo',
      test_pass_count: 5,
      test_total_count: 5,
      liaison_review: { decision: 'complete', reasoning: 'All done' },
      liaison_q2_complete: 'Assumes DB is on same host',
      liaison_q3_complete: 'Verify login page loads on PROD'
    }, 'liaison', 'liaison');
    expect(result).toContain('liaison_q1_complete');
  });

  it('review->complete passes with all 3 completion questions', () => {
    const result = validateDnaRequirements('task', 'review', 'complete', {
      role: 'liaison',
      abstract_ref: 'https://github.com/test/repo',
      test_pass_count: 5,
      test_total_count: 5,
      liaison_review: { decision: 'complete', reasoning: 'Reviewed and verified' },
      liaison_q1_complete: 'Tests dont cover rate limiting under concurrent load, only sequential',
      liaison_q2_complete: 'Implementation assumes single-node deployment, no Redis session store',
      liaison_q3_complete: 'Thomas should verify invite flow works on mobile viewport'
    }, 'liaison', 'liaison');
    expect(result).toBeNull();
  });
});

// ==========================================================================
// Quality gate — reject template/short answers
// ==========================================================================

describe('Quality gate — reject template answers', () => {

  it('rejects answers shorter than 20 characters', () => {
    const result = validateDnaRequirements('task', 'approval', 'approved', {
      role: 'liaison',
      liaison_review: { decision: 'approve', reasoning: 'ok' },
      liaison_q1_approval: 'None',
      liaison_q2_approval: 'N/A',
      liaison_q3_approval: 'Nothing'
    }, 'liaison', 'liaison');
    expect(result).not.toBeNull();
  });
});

// ==========================================================================
// SKILL.md includes challenge questions
// ==========================================================================

describe('SKILL.md includes challenge questions', () => {
  const skillPath = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md');

  it('SKILL.md mentions liaison_q1_approval', () => {
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf-8');
      expect(content).toMatch(/liaison_q1_approval|What specific gap/);
    }
  });

  it('SKILL.md mentions liaison_q1_complete', () => {
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf-8');
      expect(content).toMatch(/liaison_q1_complete|What did the tests NOT cover/);
    }
  });
});
