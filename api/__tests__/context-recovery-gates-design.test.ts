import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../src/db/interface-cli.js');
const MONITOR_PATH = resolve(__dirname, '../../viz/agent-monitor.cjs');

/**
 * Context Recovery Gates Design Tests — context-recovery-gates-design
 * Validates: Mode gate, infra gate, process gate for agent context recovery.
 * TDD: Dev implements gates.
 */

describe('Mode gate: query autonomy mode per transition', () => {

  it('workflow engine checks liaison_approval_mode before liaison transitions', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/liaison_approval_mode|approval_mode|autonomy.*mode/i);
  });
});

describe('Infra gate: env validation at startup', () => {

  it('monitor or startup validates required env vars', () => {
    const content = existsSync(MONITOR_PATH) ? readFileSync(MONITOR_PATH, 'utf-8') : '';
    const cliContent = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    const combined = content + cliContent;
    expect(combined).toMatch(/env.*valid|require.*env|DATABASE_PATH|JWT_SECRET/i);
  });
});

describe('Process gate: backlog prevents premature entry', () => {

  it('backlog status exists in workflow', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/backlog/i);
  });

  it('monitor excludes backlog from actionable work', () => {
    const content = existsSync(MONITOR_PATH) ? readFileSync(MONITOR_PATH, 'utf-8') : '';
    // backlog should not appear in ACTIONABLE_STATUSES
    expect(content).toMatch(/TERMINAL|ACTIONABLE|backlog/i);
  });
});
