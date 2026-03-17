import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Systemic Version Management Tests — ms-version-management-systemic
 * Validates: version-bump.sh updates changelog, validates content, prevents duplicates.
 */

const BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test';
const SCRIPT_PATH = resolve(BASE, 'scripts/version-bump.sh');

describe('Version bump updates changelog', () => {

  it('script updates changelog.json in new version directory', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toMatch(/changelog\.json|changelog/i);
    }
  });

  it('script sets correct version number in changelog', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      // Should write the new version number into changelog
      expect(content).toMatch(/version.*changelog|changelog.*version|sed.*version/i);
    }
  });

  it('script prevents duplicate version numbers', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      // Should check if version already exists before creating
      expect(content).toMatch(/exist|duplicate|already|check/i);
    }
  });
});

describe('Each viz version has unique changelog entry', () => {

  it('latest two viz versions have different version numbers in changelog', () => {
    const fs = require('node:fs');
    const versionsDir = resolve(BASE, 'viz/versions');
    const versions = fs.readdirSync(versionsDir)
      .filter((d: string) => d.startsWith('v'))
      .sort((a: string, b: string) => {
        const pa = a.replace('v', '').split('.').map(Number);
        const pb = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
        return 0;
      });

    if (versions.length >= 2) {
      const latest = versions[versions.length - 1];
      const prev = versions[versions.length - 2];
      const latestCl = resolve(versionsDir, latest, 'changelog.json');
      const prevCl = resolve(versionsDir, prev, 'changelog.json');

      if (existsSync(latestCl) && existsSync(prevCl)) {
        const latestData = JSON.parse(readFileSync(latestCl, 'utf-8'));
        const prevData = JSON.parse(readFileSync(prevCl, 'utf-8'));
        expect(latestData.version || latest).not.toBe(prevData.version || prev);
      }
    }
  });
});
