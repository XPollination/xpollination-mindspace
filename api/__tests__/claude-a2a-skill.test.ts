import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TDD Tests: /xpo.claude.a2a.{role} Bootstrap Skill
 * Ref: REQ-HB-003, claude-a2a-skill-design
 */

const BP_ROOT = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices');
const SKILL_PATH = resolve(BP_ROOT, '.claude/skills/xpo.claude.a2a/SKILL.md');

describe('Skill file', () => {

  it('SKILL.md exists at expected path', () => {
    expect(existsSync(SKILL_PATH)).toBe(true);
  });

  it('skill accepts role parameter', () => {
    if (!existsSync(SKILL_PATH)) { expect(false).toBe(true); return; }
    const content = readFileSync(SKILL_PATH, 'utf-8');
    expect(content).toMatch(/role|{role}|\<role\>/i);
  });
});

describe('A2A boot sequence', () => {

  it('skill references discovery endpoint', () => {
    if (!existsSync(SKILL_PATH)) { expect(false).toBe(true); return; }
    const content = readFileSync(SKILL_PATH, 'utf-8');
    expect(content).toMatch(/discover|\.well-known|agent\.json/i);
  });

  it('skill references authentication', () => {
    if (!existsSync(SKILL_PATH)) { expect(false).toBe(true); return; }
    const content = readFileSync(SKILL_PATH, 'utf-8');
    expect(content).toMatch(/authenticat|checkin|API.*key|bearer/i);
  });

  it('skill references SSE subscription', () => {
    if (!existsSync(SKILL_PATH)) { expect(false).toBe(true); return; }
    const content = readFileSync(SKILL_PATH, 'utf-8');
    expect(content).toMatch(/SSE|EventSource|events|subscribe/i);
  });
});

describe('Fallback and reconnect', () => {

  it('fallback to monitor polling on A2A failure', () => {
    if (!existsSync(SKILL_PATH)) { expect(false).toBe(true); return; }
    const content = readFileSync(SKILL_PATH, 'utf-8');
    expect(content).toMatch(/fallback|monitor|polling/i);
  });

  it('retry/reconnect logic', () => {
    if (!existsSync(SKILL_PATH)) { expect(false).toBe(true); return; }
    const content = readFileSync(SKILL_PATH, 'utf-8');
    expect(content).toMatch(/retry|reconnect|3.*attempt/i);
  });
});
