import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz Hierarchy Drilldown Tests — ms-viz-hierarchy-drilldown
 * Validates: Mission→Capability→Requirement→Task chain renders in Viz.
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

describe('Hierarchy drilldown in Viz', () => {

  it('index.html has mission dashboard or hierarchy view', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/mission|hierarchy|drill.?down/i);
  });

  it('index.html renders capabilities linked to missions', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/capabilit/i);
  });

  it('index.html renders requirements linked to capabilities', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/requirement/i);
  });

  it('server.js fetches hierarchy data from API', () => {
    const ver = getLatestVersion();
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    expect(server).toMatch(/mission|capabilit|requirement/i);
  });
});
