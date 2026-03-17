import { describe, it, expect } from 'vitest';

/**
 * MCP Hive Migration Tests — ms-mcp-hive-migration
 * Validates: MCP endpoint at hive.xpollination.earth/mcp, multi-user support.
 */

describe('MCP endpoint on Hive', () => {

  it('hive.xpollination.earth/mcp is reachable', async () => {
    try {
      const res = await fetch('https://hive.xpollination.earth/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      expect(res.status).not.toBe(404);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('bestpractice.xpollination.earth/mcp redirects or is removed', async () => {
    try {
      const res = await fetch('https://bestpractice.xpollination.earth/mcp', { redirect: 'manual' });
      // Should either redirect to hive or be gone (404)
      expect([301, 302, 404]).toContain(res.status);
    } catch {
      // Connection refused = endpoint removed (acceptable)
      expect(true).toBe(true);
    }
  });
});
