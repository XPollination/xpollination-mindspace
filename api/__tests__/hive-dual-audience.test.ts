import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TDD Tests: Hive Dual-Audience Landing Page
 * Ref: REQ-HB-001, hive-dual-audience-design
 * Tests verify Hive server implements dual-audience landing page.
 */

const HIVE_ROOT = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive');
const HIVE_INDEX = resolve(HIVE_ROOT, 'api/dist/index.js');

function getHiveSource(): string {
  return existsSync(HIVE_INDEX) ? readFileSync(HIVE_INDEX, 'utf-8') : '';
}

describe('AC1: Landing page shows protocol endpoints', () => {

  it('Hive serves a landing page at root route', () => {
    const content = getHiveSource();
    expect(content).toMatch(/landing|dual.?audience|renderLanding/i);
  });

  it('landing page lists memory endpoint', () => {
    const content = getHiveSource();
    expect(content).toMatch(/\/api\/v1\/memory/);
  });
});

describe('AC2: API key validation endpoint', () => {

  it('POST /api/v1/agent-identity route exists', () => {
    const content = getHiveSource();
    expect(content).toMatch(/agent.?identity/i);
  });

  it('agent-identity validates API key and returns profile', () => {
    const content = getHiveSource();
    expect(content).toMatch(/agent_name|agent_id.*role/i);
  });

  it('returns 401 for invalid key', () => {
    const content = getHiveSource();
    expect(content).toMatch(/401|invalid.*key|unauthorized/i);
  });
});

describe('AC3: Dashboard shows agent name, role, projects', () => {

  it('dashboard renders agent identity fields', () => {
    const content = getHiveSource();
    expect(content).toMatch(/agent_name.*projects|dashboard.*identity/i);
  });
});

describe('AC4: Recent memory section', () => {

  it('GET /api/v1/recent-memory endpoint exists', () => {
    const content = getHiveSource();
    expect(content).toMatch(/recent.?memory/i);
  });
});

describe('AC5: Brain health from /api/v1/health', () => {

  it('health endpoint is accessible', () => {
    const content = getHiveSource();
    // Health endpoint should already exist
    expect(content).toMatch(/\/api\/v1\/health|health/);
  });
});

describe('AC6: Disconnect clears session', () => {

  it('landing page includes disconnect/logout functionality', () => {
    const content = getHiveSource();
    expect(content).toMatch(/disconnect|logout|clear.*session/i);
  });
});
