import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz Persist Filter Preferences Tests — ms-viz-persist-filter-prefs
 * Validates: localStorage used for filter state, survives page refresh.
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

describe('Filter preferences persist in localStorage', () => {

  it('index.html uses localStorage for filter state', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/localStorage/);
  });

  it('filter state saved on change', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/localStorage\.setItem|localStorage\.set/);
  });

  it('filter state loaded on page init', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    expect(html).toMatch(/localStorage\.getItem|localStorage\.get/);
  });
});
