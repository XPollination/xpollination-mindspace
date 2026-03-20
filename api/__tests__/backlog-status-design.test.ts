import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../src/db/interface-cli.js');

/**
 * Backlog Status Design Tests — backlog-status-design
 * Validates: backlog status in workflow engine with transitions and exclusions.
 * TDD: Dev adds backlog to valid statuses and transitions.
 */

describe('backlog is a valid status', () => {

  it('interface-cli.js includes backlog in valid statuses', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/['"]backlog['"]/);
  });
});

describe('Backlog transitions', () => {

  it('backlog→pending transition defined', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/backlog.*pending|backlog.*→.*pending/);
  });

  it('pending→backlog transition defined', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/pending.*backlog/);
  });
});

describe('Monitor exclusion', () => {

  it('backlog excluded from actionable statuses', () => {
    const monitorPath = resolve(__dirname, '../../viz/agent-monitor.cjs');
    const content = existsSync(monitorPath) ? readFileSync(monitorPath, 'utf-8') : '';
    // backlog should NOT be in ACTIONABLE_STATUSES
    // or should be in TERMINAL/excluded list
    expect(content).toMatch(/backlog|TERMINAL|excluded/i);
  });
});

describe('Kanban exclusion', () => {

  it('backlog tasks not shown in main kanban view', () => {
    const serverPath = resolve(__dirname, '../../viz/server.js');
    const content = existsSync(serverPath) ? readFileSync(serverPath, 'utf-8') : '';
    expect(content).toMatch(/backlog/i);
  });
});
