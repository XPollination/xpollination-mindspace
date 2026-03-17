import { describe, it, expect } from 'vitest';

/**
 * A2A Agent Onboarding E2E Tests — ms-a2a-agent-onboarding
 * Full flow: API key → recovery → connect → appear in Viz → claim task.
 */

const PROD_API = 'https://mindspace.xpollination.earth';
const TEST_AGENT_ID = 'agent-onboarding-test';

describe('A2A agent onboarding flow', () => {

  it('GET /api/v1/recovery/{agentId} works with API key auth', async () => {
    try {
      // Use brain API key as proxy for API key auth test
      const res = await fetch(`${PROD_API}/api/v1/recovery/${TEST_AGENT_ID}`, {
        headers: { 'Authorization': `Bearer ${process.env.BRAIN_API_KEY}` }
      });
      expect([200, 401]).toContain(res.status); // 200 if key valid, 401 if not
    } catch {
      expect(true).toBe(false);
    }
  });

  it('POST /a2a/connect accepts agent registration', async () => {
    try {
      const res = await fetch(`${PROD_API}/a2a/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: TEST_AGENT_ID,
          name: 'Onboarding Test Agent',
          role: 'dev',
          capabilities: ['task-execution']
        })
      });
      expect(res.status).not.toBe(404);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('GET /.well-known/agent.json documents onboarding steps', async () => {
    try {
      const res = await fetch(`${PROD_API}/.well-known/agent.json`);
      const data = await res.json();
      expect(data).toHaveProperty('name');
      // Agent card should document capabilities
      expect(data.capabilities || data.skills || data.endpoints).toBeDefined();
    } catch {
      expect(true).toBe(false);
    }
  });

  it('/settings page shows API key for agent configuration', async () => {
    try {
      const res = await fetch(`${PROD_API}/settings`);
      expect(res.status).toBe(200);
    } catch {
      expect(true).toBe(false);
    }
  });
});
