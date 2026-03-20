import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const INDEX_PATH = resolve(PROJECT_ROOT, 'src/index.ts');

/**
 * TDD Tests: MCP Tools for Knowledge Browsing + Creation
 * Ref: REQ-A2A-004, mcp-knowledge-tools-design
 */

function getSource(): string {
  if (existsSync(INDEX_PATH)) return readFileSync(INDEX_PATH, 'utf-8');
  const jsPath = resolve(PROJECT_ROOT, 'src/index.js');
  return existsSync(jsPath) ? readFileSync(jsPath, 'utf-8') : '';
}

describe('MCP knowledge read tools', () => {

  it('list_missions tool registered', () => {
    const content = getSource();
    expect(content).toMatch(/list_missions/);
  });

  it('list_capabilities tool registered', () => {
    const content = getSource();
    expect(content).toMatch(/list_capabilities/);
  });

  it('get_requirement tool registered', () => {
    const content = getSource();
    expect(content).toMatch(/get_requirement/);
  });
});

describe('MCP knowledge write tools', () => {

  it('create_mission tool registered', () => {
    const content = getSource();
    expect(content).toMatch(/create_mission/);
  });

  it('create_task tool registered', () => {
    const content = getSource();
    expect(content).toMatch(/create_task/);
  });
});

describe('MCP knowledge query tools', () => {

  it('search_knowledge tool registered', () => {
    const content = getSource();
    expect(content).toMatch(/search_knowledge/);
  });
});

describe('Auth and truncation', () => {

  it('XPO_API_KEY auth referenced', () => {
    const content = getSource();
    expect(content).toMatch(/XPO_API_KEY|xpo.*key/i);
  });

  it('content truncation at 4000 chars', () => {
    const content = getSource();
    expect(content).toMatch(/4000|truncat/i);
  });
});
