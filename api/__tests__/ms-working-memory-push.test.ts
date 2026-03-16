import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Working Memory Push Tests — ms-working-memory-push
 * Validates SKILL.md pushes working memory at key workflow points.
 */

const SKILL_PATHS = [
  resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md'),
  resolve('/home/developer/.claude/skills/xpo.claude.monitor/SKILL.md'),
];

describe('Working memory push in monitor skill', () => {

  for (const skillPath of SKILL_PATHS) {
    const label = skillPath.includes('best-practices') ? 'git source' : 'deployed copy';

    describe(`SKILL.md (${label})`, () => {
      let content: string;

      try {
        content = readFileSync(skillPath, 'utf-8');
      } catch {
        content = '';
      }

      it('D1: pushes working memory after task claim (Step 4)', () => {
        // Should have a curl POST to /api/v1/working-memory/ after claiming
        expect(content).toMatch(/working-memory/);
        expect(content).toMatch(/task_slug|task-slug/);
      });

      it('D2: includes human_expectation in push payload', () => {
        expect(content).toMatch(/human_expectation/);
      });

      it('D3: clears working memory on task complete (Step 7)', () => {
        // Should push null/empty state or DELETE after task complete
        expect(content).toMatch(/working.memory.*complete|complete.*working.memory|clear.*working|null.*working_state/i);
      });

      it('D4: pushes updated step after transitions', () => {
        // Should reference step updates during transitions
        expect(content).toMatch(/step.*transition|transition.*step|working-memory.*transition/i);
      });
    });
  }
});

// Also check precompact-save script
describe('Precompact save includes working memory push', () => {
  const precompactPath = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/scripts/xpo.claude.compact-recover.sh');

  it('precompact script exists', () => {
    expect(existsSync(precompactPath)).toBe(true);
  });

  it('precompact script references working-memory endpoint', () => {
    if (existsSync(precompactPath)) {
      const content = readFileSync(precompactPath, 'utf-8');
      expect(content).toMatch(/working-memory/);
    }
  });
});
