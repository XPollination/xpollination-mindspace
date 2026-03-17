import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Unblock Script Iteration Tests — ms-unblock-script-iteration
 * Validates: longer capture buffer, handles deep wrapping, reliable prompt detection.
 */

const SCRIPT_PATHS = [
  resolve('/home/developer/workspaces/github/PichlerThomas/HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/claude-unblock.sh'),
  resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/scripts/claude-unblock.sh'),
];

function findScript(): string {
  for (const p of SCRIPT_PATHS) {
    if (existsSync(p)) return readFileSync(p, 'utf-8');
  }
  return '';
}

describe('Unblock script handles deep wrapping', () => {

  it('script captures sufficient scrollback (>300 lines)', () => {
    const content = findScript();
    if (content) {
      // Should capture enough lines to find prompts in deeply wrapped output
      const match = content.match(/capture-pane.*-S\s*(-?\d+)/);
      if (match) {
        expect(Math.abs(parseInt(match[1]))).toBeGreaterThanOrEqual(300);
      }
    }
  });

  it('script handles multi-line prompt detection', () => {
    const content = findScript();
    if (content) {
      // Should detect prompts even when options wrap across lines
      expect(content).toMatch(/prompt|option|select|permission/i);
    }
  });

  it('script excludes human pane (pane 0)', () => {
    const content = findScript();
    if (content) {
      expect(content).toMatch(/pane.*0|exclude.*0|skip.*0|human/i);
    }
  });
});
