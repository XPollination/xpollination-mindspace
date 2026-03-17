import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Monitor A2A Connect Tests — ms-monitor-a2a-connect
 * Validates: monitor skill calls POST /a2a/connect at wake-up.
 */

const SKILL_PATHS = [
  resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md'),
  resolve('/home/developer/.claude/skills/xpo.claude.monitor/SKILL.md'),
];

describe('Monitor skill calls /a2a/connect', () => {
  for (const skillPath of SKILL_PATHS) {
    const label = skillPath.includes('best-practices') ? 'git source' : 'deployed copy';

    describe(`SKILL.md (${label})`, () => {
      let content: string;
      try { content = readFileSync(skillPath, 'utf-8'); } catch { content = ''; }

      it('references /a2a/connect endpoint', () => {
        expect(content).toMatch(/a2a\/connect/);
      });

      it('sends digital twin or agent identity on connect', () => {
        expect(content).toMatch(/digital.twin|agent_id|agent_name.*connect/i);
      });

      it('connect happens during wake-up (Step 2 or Step 3)', () => {
        expect(content).toMatch(/a2a.*connect|connect.*a2a/i);
      });
    });
  }
});
