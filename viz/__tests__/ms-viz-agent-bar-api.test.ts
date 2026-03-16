import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz Agent Bar API Tests — ms-viz-agent-bar-api
 * Validates: agent bar reads from agents table (A2A), not stations table.
 */

const VIZ_BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/viz';

function getLatestVersion(): string {
  const fs = require('node:fs');
  const versions = fs.readdirSync(resolve(VIZ_BASE, 'versions'))
    .filter((d: string) => d.startsWith('v'))
    .sort((a: string, b: string) => {
      const pa = a.replace('v', '').split('.').map(Number);
      const pb = b.replace('v', '').split('.').map(Number);
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
      return 0;
    });
  return versions[versions.length - 1];
}

describe('Agent bar reads from agents API', () => {

  it('index.html agent bar fetches from /api/ agents endpoint', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/\/api\/.*agent|fetch.*agent/i);
  });

  it('server.js does NOT query stations table for agent bar', () => {
    const ver = getLatestVersion();
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    // Should not query stations for agent status
    expect(server).not.toMatch(/SELECT.*FROM\s+stations/i);
  });

  it('agent status uses A2A agents data', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    const combined = html + server;
    expect(combined).toMatch(/agents|a2a/i);
  });
});
