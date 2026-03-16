import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Recover Lost Viz Features Tests — ms-viz-recover-lost-features
 * Validates: LITE_FIELDS includes pdsa_ref, changelog_ref, abstract_ref
 */

const VIZ_BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/viz';

// Find the latest version
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

function readServerJs(): string {
  const ver = getLatestVersion();
  return readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
}

// ==========================================================================
// LITE_FIELDS must include ref fields for detail panel
// ==========================================================================

describe('LITE_FIELDS includes reference fields', () => {

  it('LITE_FIELDS includes pdsa_ref', () => {
    const server = readServerJs();
    // Find the LITE_FIELDS array definition
    const match = server.match(/LITE_FIELDS\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toContain('pdsa_ref');
    }
  });

  it('LITE_FIELDS includes abstract_ref', () => {
    const server = readServerJs();
    const match = server.match(/LITE_FIELDS\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toContain('abstract_ref');
    }
  });

  it('LITE_FIELDS includes changelog_ref', () => {
    const server = readServerJs();
    const match = server.match(/LITE_FIELDS\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toContain('changelog_ref');
    }
  });
});

// ==========================================================================
// Detail panel rendering code still present
// ==========================================================================

describe('Detail panel renders ref fields', () => {

  it('server.js has rendering code for pdsa_ref in detail panel', () => {
    const server = readServerJs();
    expect(server).toMatch(/pdsa_ref/);
  });

  it('server.js has rendering code for abstract_ref in detail panel', () => {
    const server = readServerJs();
    expect(server).toMatch(/abstract_ref/);
  });

  it('server.js has rendering code for changelog_ref in detail panel', () => {
    const server = readServerJs();
    expect(server).toMatch(/changelog_ref/);
  });
});
