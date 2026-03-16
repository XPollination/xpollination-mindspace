import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Viz API-Only Tests — ms-viz-api-only
 * Validates: no direct SQLite calls in viz/server.js, all data via API fetch.
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

function readServerJs(): string {
  const ver = getLatestVersion();
  return readFileSync(resolve(VIZ_BASE, 'versions', ver, 'server.js'), 'utf-8');
}

// ==========================================================================
// No direct SQLite usage in viz server
// ==========================================================================

describe('No direct SQLite in viz/server.js', () => {

  it('does NOT import better-sqlite3 or Database', () => {
    const server = readServerJs();
    expect(server).not.toMatch(/require\s*\(\s*['"]better-sqlite3['"]\s*\)/);
    expect(server).not.toMatch(/import.*from\s+['"]better-sqlite3['"]/);
  });

  it('does NOT call new Database()', () => {
    const server = readServerJs();
    expect(server).not.toMatch(/new\s+Database\s*\(/);
  });

  it('does NOT use .prepare() for SQL queries', () => {
    const server = readServerJs();
    // Should not have db.prepare() calls
    expect(server).not.toMatch(/\.prepare\s*\(\s*[`'"]/);
  });

  it('does NOT reference a .db file path', () => {
    const server = readServerJs();
    // Should not reference xpollination.db or any .db file
    expect(server).not.toMatch(/xpollination\.db/);
  });
});

// ==========================================================================
// Uses API fetch instead
// ==========================================================================

describe('Uses API fetch calls', () => {

  it('uses fetch() for data retrieval', () => {
    const server = readServerJs();
    expect(server).toMatch(/fetch\s*\(/);
  });

  it('references API_PORT or localhost:31', () => {
    const server = readServerJs();
    expect(server).toMatch(/API_PORT|localhost:31|127\.0\.0\.1:31/);
  });

  it('uses /api/ URL paths for data', () => {
    const server = readServerJs();
    expect(server).toMatch(/\/api\//);
  });
});
