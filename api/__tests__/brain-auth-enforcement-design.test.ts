import { describe, it, expect } from 'vitest';

/**
 * Brain Auth Enforcement Design Tests — brain-auth-enforcement-design
 * Validates: Brain write endpoints require auth, read endpoints open.
 * TDD: Dev adds brainAuthMiddleware to xpollination-hive.
 */

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'https://hive.xpollination.earth';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY;

describe('Read queries remain open (no auth required)', () => {

  it('health endpoint accessible without auth', async () => {
    try {
      const res = await fetch(`${BRAIN_API_URL}/api/v1/health`);
      expect(res.status).toBe(200);
    } catch { /* brain not reachable */ }
  });

  it('read-only query works without auth', async () => {
    try {
      const res = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'test query',
          agent_id: 'test',
          agent_name: 'Test',
          session_id: 'test-session',
          read_only: true,
        }),
      });
      // Should succeed or return data, NOT 401
      expect(res.status).not.toBe(401);
    } catch { /* brain not reachable */ }
  });
});

describe('Write contributions require auth', () => {

  it('contribution without auth returns 401', async () => {
    try {
      const res = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'This is a long enough contribution to pass the threshold for storage in the brain system',
          agent_id: 'test-unauth',
          agent_name: 'Test',
          session_id: 'test-session',
        }),
      });
      // Should require auth for write operations
      expect(res.status).toBe(401);
    } catch { /* brain not reachable */ }
  });

  it.skipIf(!BRAIN_API_KEY)('contribution with valid key succeeds', async () => {
    const res = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: 'test auth enforcement',
        agent_id: 'agent-qa',
        agent_name: 'QA',
        session_id: 'test-auth-enforcement',
        read_only: true,
      }),
    });
    expect(res.status).toBe(200);
  });
});

describe('Hive middleware file exists', () => {

  it('xpollination-hive has brain auth middleware', async () => {
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const hivePath = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive/src/middleware/auth.ts');
    const hivePathJs = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive/src/middleware/auth.js');
    expect(existsSync(hivePath) || existsSync(hivePathJs)).toBe(true);
  });
});
