import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz User Controls Tests — ms-viz-user-controls
 * Validates: logout button, change password page, project names from API.
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

describe('Logout button', () => {
  it('index.html has a logout button or link', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/logout/i);
  });

  it('logout triggers /logout endpoint or clears cookie', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/\/logout|ms_session|cookie/i);
  });
});

describe('Change password page', () => {
  it('change-password page or link exists', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/change.password|password.*change/i);
  });
});

describe('Project names from API', () => {
  it('server.js uses API for project names (not local paths)', () => {
    const ver = getLatestVersion();
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    // Should not show filesystem paths as project names
    expect(server).not.toMatch(/workspaces.*github.*PichlerThomas/);
  });
});
