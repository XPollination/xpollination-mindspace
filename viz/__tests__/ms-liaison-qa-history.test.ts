import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * LIAISON Q&A History Tests — ms-liaison-qa-history
 * Validates: Q&A fields in LITE_FIELDS, visible in Viz Object Details.
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

function readIndexHtml(): string {
  const ver = getLatestVersion();
  return readFileSync(resolve(VIZ_BASE, 'versions', ver, 'index.html'), 'utf-8');
}

describe('LITE_FIELDS includes Q&A fields', () => {

  it('LITE_FIELDS includes liaison_q1_approval', () => {
    const server = readServerJs();
    const match = server.match(/LITE_FIELDS\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toContain('liaison_q1_approval');
    }
  });

  it('LITE_FIELDS includes liaison_q1_complete', () => {
    const server = readServerJs();
    const match = server.match(/LITE_FIELDS\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toContain('liaison_q1_complete');
    }
  });

  it('LITE_FIELDS includes liaison_review', () => {
    const server = readServerJs();
    const match = server.match(/LITE_FIELDS\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toContain('liaison_review');
    }
  });
});

describe('Viz Object Details renders Q&A fields', () => {

  it('index.html or server.js renders liaison_q1_approval', () => {
    const server = readServerJs();
    const html = readIndexHtml();
    const combined = server + html;
    expect(combined).toMatch(/liaison_q1_approval/);
  });

  it('index.html or server.js renders liaison_q1_complete', () => {
    const server = readServerJs();
    const html = readIndexHtml();
    const combined = server + html;
    expect(combined).toMatch(/liaison_q1_complete/);
  });
});
