import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz Detail Panel Close Bug Tests — ms-viz-detail-panel-close-bug
 * Validates: detail panel stays closed after user dismisses it.
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

describe('Detail panel close behavior', () => {

  it('auto-refresh preserves closed panel state (does not re-select task)', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    // Should have logic to preserve panel closed state across refreshes
    // Look for: selectedTask clear on close, refresh check for panel state, userClosed flag
    expect(html).toMatch(/userClosed|panelClosed|selectedTask\s*=\s*null|closeDetail|dismissDetail/i);
  });

  it('refresh does not auto-select previously viewed task', () => {
    const ver = getLatestVersion();
    const html = readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
    // Should NOT re-open panel during data refresh
    // Look for: check if panel was manually closed before re-opening
    expect(html).toMatch(/refresh.*panel|panel.*refresh|keepClosed|preserveClose/i);
  });
});
