import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDnaRequirements } from '../workflow-engine.js';

/**
 * LIAISON Review Hard Gate Tests — ms-liaison-review-gate
 * Validates: liaison_review required on approval/completion/rework transitions.
 */

// ==========================================================================
// Workflow engine gate — liaison_review required for liaison transitions
// ==========================================================================

describe('Liaison review gate — liaison_review required', () => {

  it('approval->approved BLOCKED without liaison_review when actor=liaison', () => {
    const result = validateDnaRequirements('task', 'approval', 'approved', {
      role: 'liaison'
    }, 'liaison', 'liaison');
    expect(result).toContain('liaison_review');
  });

  it('approval->approved passes with liaison_review', () => {
    const result = validateDnaRequirements('task', 'approval', 'approved', {
      role: 'liaison',
      liaison_review: { decision: 'approve', reasoning: 'Design matches requirements' }
    }, 'liaison', 'liaison');
    expect(result).toBeNull();
  });

  it('review->complete BLOCKED without liaison_review when actor=liaison', () => {
    const result = validateDnaRequirements('task', 'review', 'complete', {
      role: 'liaison',
      abstract_ref: 'https://github.com/test/repo',
      test_pass_count: 5,
      test_total_count: 5
    }, 'liaison', 'liaison');
    expect(result).toContain('liaison_review');
  });

  it('review->complete passes with liaison_review', () => {
    const result = validateDnaRequirements('task', 'review', 'complete', {
      role: 'liaison',
      abstract_ref: 'https://github.com/test/repo',
      test_pass_count: 5,
      test_total_count: 5,
      liaison_review: { decision: 'complete', reasoning: 'All tests pass, QA+PDSA reviewed' }
    }, 'liaison', 'liaison');
    expect(result).toBeNull();
  });

  it('review->rework:liaison BLOCKED without liaison_review', () => {
    const result = validateDnaRequirements('task', 'review', 'rework', {
      role: 'liaison',
      rework_target_role: 'dev'
    }, 'liaison', 'liaison');
    expect(result).toContain('liaison_review');
  });

  it('review->rework:liaison passes with liaison_review', () => {
    const result = validateDnaRequirements('task', 'review', 'rework', {
      role: 'liaison',
      rework_target_role: 'dev',
      liaison_review: { decision: 'rework', reasoning: 'Tests incomplete, missing edge cases' }
    }, 'liaison', 'liaison');
    expect(result).toBeNull();
  });

  // Non-liaison actors should NOT need liaison_review
  it('review->rework by QA does NOT require liaison_review', () => {
    const result = validateDnaRequirements('task', 'review', 'rework', {
      role: 'qa'
    }, 'qa', 'qa');
    expect(result).toBeNull();
  });
});

// ==========================================================================
// SKILL.md includes review protocol
// ==========================================================================

describe('Monitor skill includes liaison review protocol', () => {
  const skillPath = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md');

  it('SKILL.md mentions liaison_review', () => {
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf-8');
      expect(content).toMatch(/liaison_review/);
    }
  });

  it('SKILL.md has review protocol for LIAISON role', () => {
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf-8');
      expect(content).toMatch(/reasoning|review.*protocol|document.*decision/i);
    }
  });
});
