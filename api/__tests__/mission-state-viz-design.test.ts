import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * Mission State Viz Design Tests — mission-state-viz-design
 * Validates: State badges and backlog indicators in viz.
 * TDD: Dev adds state rendering to viz server.
 */

describe('Mission state badges in viz', () => {

  it('server.js renders mission status as badge', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/badge|status.*class|state.*label/i);
  });

  it('has color mapping for states (draft/active/complete)', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/draft.*gray|active.*green|complete.*gold|status.*color/i);
  });
});

describe('Backlog count in mission cards', () => {

  it('mission-overview includes backlog count', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/backlog.*count|backlog_count|backlog/i);
  });
});
