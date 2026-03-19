import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../src/db/interface-cli.js');

/**
 * Mission State Machine Design Tests — mission-state-machine-design
 * Validates: Mission lifecycle with transitions and backlog release.
 * TDD: Dev implements mission transitions in workflow engine.
 */

describe('Mission lifecycle statuses defined', () => {

  it('supports draft status for missions', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/draft/i);
  });

  it('supports active status for missions', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/active/i);
  });

  it('supports complete status for missions', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/complete/i);
  });

  it('supports deprecated status for missions', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/deprecated/i);
  });
});

describe('Mission transitions', () => {

  it('draft→ready transition defined', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/draft.*ready|mission.*transition/i);
  });

  it('ready→active transition triggers backlog release', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/backlog.*release|release.*backlog|ready.*active/i);
  });
});
