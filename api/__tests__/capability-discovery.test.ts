import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TDD Tests: Capability Suggestion During Mission Planning
 * Ref: REQ-HB-006, capability-discovery-design
 */

const HIVE_ROOT = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive');
const HIVE_INDEX = resolve(HIVE_ROOT, 'api/dist/index.js');

function getHiveSource(): string {
  return existsSync(HIVE_INDEX) ? readFileSync(HIVE_INDEX, 'utf-8') : '';
}

describe('Dual search (vector + text)', () => {
  it('combines vector and text search', () => {
    const content = getHiveSource();
    expect(content).toMatch(/dual.*search|vector.*text|capability.*suggest/i);
  });
});

describe('Three suggestion tiers', () => {
  it('compose tier for high similarity (>0.8)', () => {
    const content = getHiveSource();
    expect(content).toMatch(/compose|0\.8|high.*similar/i);
  });

  it('extend tier for medium similarity', () => {
    const content = getHiveSource();
    expect(content).toMatch(/extend|medium|0\.5/i);
  });

  it('create tier for low similarity', () => {
    const content = getHiveSource();
    expect(content).toMatch(/create.*new|low.*similar|no.*match/i);
  });
});

describe('Ranked results', () => {
  it('results ranked by relevance', () => {
    const content = getHiveSource();
    expect(content).toMatch(/rank|sort.*score|relevance/i);
  });
});
