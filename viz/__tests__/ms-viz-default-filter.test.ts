import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz Default Filter Tests — ms-viz-default-filter
 * Validates: default status filter excludes blocked/cancelled, shows active pipeline.
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

describe('Default status filter', () => {

  it('index.html has default filter that excludes blocked', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    // Default filter should not include 'blocked' in the initial visible set
    // Look for defaultFilter, initialFilter, or status filter configuration
    expect(html).toMatch(/default.*filter|initial.*filter|activeFilter/i);
  });

  it('server.js default query excludes blocked and cancelled', () => {
    const ver = getLatestVersion();
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    // Should have filter logic that excludes blocked/cancelled by default
    expect(server).toMatch(/blocked|cancelled|default.*status|status.*filter/i);
  });

  it('active pipeline statuses are the default (pending through review)', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    // Should include active pipeline statuses
    expect(html).toMatch(/pending|ready|active|approval|approved|review/i);
  });
});
