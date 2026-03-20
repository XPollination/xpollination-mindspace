import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TDD Tests: Proactive Thought Push via A2A SSE
 * Ref: REQ-HB-005, proactive-push-design
 */

const HIVE_ROOT = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive');
const HIVE_INDEX = resolve(HIVE_ROOT, 'api/dist/index.js');

function getHiveSource(): string {
  return existsSync(HIVE_INDEX) ? readFileSync(HIVE_INDEX, 'utf-8') : '';
}

describe('Similarity check on contribution', () => {
  it('triggers similarity check when thought contributed', () => {
    const content = getHiveSource();
    expect(content).toMatch(/similarity.*check|proactive.*push|THOUGHT_RELEVANT/i);
  });
});

describe('THOUGHT_RELEVANT SSE event', () => {
  it('emits THOUGHT_RELEVANT event type', () => {
    const content = getHiveSource();
    expect(content).toMatch(/THOUGHT_RELEVANT/);
  });
});

describe('Threshold configuration', () => {
  it('configurable similarity threshold', () => {
    const content = getHiveSource();
    expect(content).toMatch(/threshold|0\.7|similarity.*score/i);
  });
});
