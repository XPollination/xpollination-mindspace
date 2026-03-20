import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * Mission State Viz Tests — mission-state-viz-test
 * TDD: Validates state badges, color mapping, backlog indicators in viz.
 */

describe('State badges rendered in viz', () => {

  it('server.js has MISSION_STATUS_COLORS mapping', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/MISSION_STATUS_COLORS|mission.*status.*color/i);
  });

  it('draft mapped to gray color', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/draft.*#[0-9a-f]{3,6}/i);
  });

  it('active mapped to green color', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/active.*#[0-9a-f]{3,6}/i);
  });

  it('complete mapped to gold/yellow color', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/complete.*#[0-9a-f]{3,6}/i);
  });
});

describe('Backlog count in viz', () => {

  it('server.js references backlog for counting', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/backlog/i);
  });
});
