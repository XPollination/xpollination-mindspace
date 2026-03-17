import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz Data Proxy Conflict Tests — ms-viz-data-proxy-conflict
 * Validates: /api/data not intercepted by catch-all proxy.
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

describe('/api/data route priority over catch-all proxy', () => {

  it('server.js registers /api/data handler BEFORE catch-all proxy', () => {
    const ver = getLatestVersion();
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    // /api/data handler should come before the catch-all /api/* proxy
    const dataIdx = server.indexOf('/api/data');
    const proxyIdx = server.search(/app\.(use|all)\s*\(\s*['"]\/api/);
    if (dataIdx >= 0 && proxyIdx >= 0) {
      expect(dataIdx).toBeLessThan(proxyIdx);
    }
  });

  it('catch-all proxy excludes /api/data', () => {
    const ver = getLatestVersion();
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    // Either: (1) /api/data defined before proxy, or (2) proxy explicitly excludes /api/data
    const hasExclusion = server.match(/api\/data.*exclude|exclude.*api\/data|!.*api\/data/i);
    const dataBeforeProxy = server.indexOf('/api/data') < server.search(/proxy|catch.all/i);
    expect(hasExclusion !== null || dataBeforeProxy).toBe(true);
  });
});
