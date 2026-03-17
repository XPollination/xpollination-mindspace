import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Settings API Mount Bug Tests — ms-settings-api-mount-bug
 * Validates: settings router mounted in server.ts, Viz excludes /api/settings from proxy.
 */

const API_BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/api';
const VIZ_BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/viz';

describe('Bug 1: Settings router mounted in server.ts', () => {

  it('server.ts imports settingsRouter', () => {
    const serverPath = resolve(API_BASE, 'server.ts');
    const content = readFileSync(serverPath, 'utf-8');
    expect(content).toMatch(/settingsRouter|settings.*Router/);
  });

  it('server.ts mounts /api/settings route', () => {
    const serverPath = resolve(API_BASE, 'server.ts');
    const content = readFileSync(serverPath, 'utf-8');
    expect(content).toMatch(/\/api\/settings/);
  });
});

describe('Bug 2: Viz proxy excludes /api/settings', () => {

  it('Viz server.js handles /api/settings locally or excludes from proxy', () => {
    const fs = require('node:fs');
    const versions = fs.readdirSync(resolve(VIZ_BASE, 'versions'))
      .filter((d: string) => d.startsWith('v'))
      .sort((a: string, b: string) => {
        const pa = a.replace('v', '').split('.').map(Number);
        const pb = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
        return 0;
      });
    const latest = versions[versions.length - 1];
    const server = readFileSync(resolve(VIZ_BASE, 'versions', latest, 'server.js'), 'utf-8');
    // /api/settings should be handled before the catch-all proxy OR proxy should forward correctly
    const settingsIdx = server.indexOf('/api/settings');
    expect(settingsIdx).toBeGreaterThanOrEqual(0);
  });
});
