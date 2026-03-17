import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * User Settings Page Tests — ms-user-settings-page
 * Validates: /settings route, change password form, API key display, sessions.
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

describe('Settings page exists', () => {
  it('settings.html file exists in latest viz version', () => {
    const ver = getLatestVersion();
    const path = resolve(VIZ_BASE, 'versions', ver, 'settings.html');
    expect(existsSync(path)).toBe(true);
  });

  it('server.js serves /settings route', () => {
    const ver = getLatestVersion();
    const server = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
    expect(server).toMatch(/\/settings/);
  });
});

describe('Settings page features', () => {
  it('settings page has change password form', () => {
    const ver = getLatestVersion();
    const path = resolve(VIZ_BASE, 'versions', ver, 'settings.html');
    if (existsSync(path)) {
      const html = readFileSync(path, 'utf-8');
      expect(html).toMatch(/change.*password|password.*change|current.*password/i);
    }
  });

  it('settings page has API key section', () => {
    const ver = getLatestVersion();
    const path = resolve(VIZ_BASE, 'versions', ver, 'settings.html');
    if (existsSync(path)) {
      const html = readFileSync(path, 'utf-8');
      expect(html).toMatch(/api.key|API.*Key/i);
    }
  });

  it('settings page has logout option', () => {
    const ver = getLatestVersion();
    const path = resolve(VIZ_BASE, 'versions', ver, 'settings.html');
    if (existsSync(path)) {
      const html = readFileSync(path, 'utf-8');
      expect(html).toMatch(/logout/i);
    }
  });
});
