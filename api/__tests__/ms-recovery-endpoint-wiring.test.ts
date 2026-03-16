import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tests for ms-recovery-endpoint-wiring task.
 * Validates the SKILL.md file has been updated to use the recovery endpoint.
 * The actual endpoint is tested via curl (manual/integration).
 */

const SKILL_PATHS = [
  // Git source (best-practices)
  resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md'),
  // Deployed copy
  resolve('/home/developer/.claude/skills/xpo.claude.monitor/SKILL.md'),
];

describe('Recovery endpoint wiring in monitor skill', () => {

  for (const skillPath of SKILL_PATHS) {
    const label = skillPath.includes('best-practices') ? 'git source' : 'deployed copy';

    describe(`SKILL.md (${label})`, () => {
      let content: string;

      try {
        content = readFileSync(skillPath, 'utf-8');
      } catch {
        content = '';
      }

      it('AC1: Step 2 calls GET /api/v1/recovery/agent-{role}', () => {
        expect(content).toContain('/api/v1/recovery/');
      });

      it('AC2: instructs agent to present self-test when working_state is non-null', () => {
        expect(content).toMatch(/working_state/);
        expect(content).toMatch(/self.test|self_test|present.*test/i);
      });

      it('AC3: instructs agent to use key_context when working_state is null', () => {
        expect(content).toMatch(/key_context/);
      });

      it('AC4: fallback to generic brain queries on error', () => {
        // Should still contain the fallback curl commands or mention fallback
        expect(content).toMatch(/fallback|fall.back|generic.*quer/i);
      });

      it('AC5: session ID generation is preserved', () => {
        expect(content).toMatch(/SESSION_ID|session.id|uuid/i);
      });

      it('AC6: Reference section documents recovery endpoint', () => {
        expect(content).toMatch(/recovery/i);
        expect(content).toMatch(/api\/v1\/recovery/);
      });
    });
  }
});
