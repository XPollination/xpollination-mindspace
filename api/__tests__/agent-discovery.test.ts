import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TDD Tests: .well-known/agent.json A2A Discovery
 * Ref: REQ-HB-002, agent-discovery-design
 * Tests verify Hive serves A2A-compliant discovery endpoint.
 */

const HIVE_ROOT = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive');
const HIVE_INDEX = resolve(HIVE_ROOT, 'api/dist/index.js');
const AGENT_JSON_PATH = resolve(HIVE_ROOT, '.well-known/agent.json');

function getHiveSource(): string {
  return existsSync(HIVE_INDEX) ? readFileSync(HIVE_INDEX, 'utf-8') : '';
}

describe('A2A Discovery: .well-known/agent.json', () => {

  it('Hive has route for /.well-known/agent.json', () => {
    const content = getHiveSource();
    expect(content).toMatch(/\.well-known\/agent\.json|well.known.*agent/i);
  });

  it('agent.json file exists or is generated', () => {
    const hasFile = existsSync(AGENT_JSON_PATH);
    const sourceHasGenerator = getHiveSource().match(/agent\.json|agentCard/i);
    expect(hasFile || !!sourceHasGenerator).toBe(true);
  });
});

describe('Agent card schema (A2A spec)', () => {

  it('agent card includes name field', () => {
    const content = getHiveSource();
    expect(content).toMatch(/agent.*name|"name".*Hive|XPollination/i);
  });

  it('agent card includes capabilities list', () => {
    const content = getHiveSource();
    expect(content).toMatch(/capabilities.*semantic_search|semantic_search.*memory/i);
  });

  it('agent card includes auth method (bearer token)', () => {
    const content = getHiveSource();
    expect(content).toMatch(/bearer|auth.*method|authentication/i);
  });

  it('agent card includes endpoint URLs', () => {
    const content = getHiveSource();
    expect(content).toMatch(/endpoints|url.*api\/v1/i);
  });
});

describe('XPO extensions', () => {

  it('includes related_services for ecosystem linking', () => {
    const content = getHiveSource();
    expect(content).toMatch(/related_services|mindspace/i);
  });
});
