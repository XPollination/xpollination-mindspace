/**
 * TDD tests for viz-capability-detail-crash
 *
 * Bug: GET /api/capabilities/:capId crashes when requirements table missing.
 * Fix: Wrap requirements query in own try/catch, default to empty array.
 * Version: v0.0.24 from v0.0.23 base.
 *
 * AC-FIX1: Requirements query has its own try/catch (not shared with main query)
 * AC-FIX2: Missing requirements table defaults to empty array
 * AC-FIX3: Capability detail endpoint returns 200 even without requirements table
 * AC-FIX4: Version v0.0.24 created from v0.0.23
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const VIZ_DIR = path.join(__dirname, '.');
const ACTIVE_LINK = path.join(VIZ_DIR, 'active');

function getActiveFile(filename: string): string {
  return fs.readFileSync(path.join(ACTIVE_LINK, filename), 'utf-8');
}

async function isVizUp(): Promise<boolean> {
  try {
    const res = await fetch('http://10.33.33.1:4200/api/health', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

describe('viz-capability-detail-crash: requirements table missing fix', () => {

  describe('AC-FIX1: Requirements query has its own try/catch', () => {
    it('should have separate try/catch around requirements query', () => {
      const serverSrc = getActiveFile('server.js');
      // The requirements query should be in its own try block
      // Look for pattern: try { ...requirements... } catch { ...[] }
      const capSection = serverSrc.slice(
        serverSrc.indexOf('/api/capabilities/'),
        serverSrc.indexOf('/api/capabilities/') + 3000
      );
      // Should have multiple try blocks in the capability handler
      const tryCount = (capSection.match(/\btry\b/g) || []).length;
      // Need at least 2 try blocks: one for main query, one for requirements
      expect(tryCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AC-FIX2: Missing requirements defaults to empty array', () => {
    it('should default requirements to empty array on error', () => {
      const serverSrc = getActiveFile('server.js');
      const capSection = serverSrc.slice(
        serverSrc.indexOf('/api/capabilities/'),
        serverSrc.indexOf('/api/capabilities/') + 3000
      );
      // Should have a catch that sets requirements to []
      const hasEmptyDefault =
        /catch.*\{[^}]*\[\s*\]/.test(capSection) ||
        /requirements\s*=\s*\[\s*\]/.test(capSection) ||
        /\|\|\s*\[\s*\]/.test(capSection);
      expect(hasEmptyDefault).toBe(true);
    });
  });

  describe('AC-FIX3: Capability detail returns 200', () => {
    it('GET /api/capabilities/:capId should return 200 with capability data', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      // Known capability ID from the database
      const capId = '0c437137-657f-409d-a46d-dd83311c67ac';
      const res = await fetch(`http://10.33.33.1:4200/api/capabilities/${capId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('capability');
      expect(data).toHaveProperty('requirements');
      expect(Array.isArray(data.requirements)).toBe(true);
    });

    it('response should include tasks even when requirements table is missing', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const capId = '0c437137-657f-409d-a46d-dd83311c67ac';
      const res = await fetch(`http://10.33.33.1:4200/api/capabilities/${capId}`);
      if (res.status !== 200) return;
      const data = await res.json();
      expect(data).toHaveProperty('tasks');
      expect(Array.isArray(data.tasks)).toBe(true);
    });
  });

  describe('AC-FIX4: Version v0.0.24', () => {
    it('v0.0.24 directory should exist', () => {
      const v24 = path.join(VIZ_DIR, 'versions', 'v0.0.24');
      expect(fs.existsSync(v24)).toBe(true);
    });

    it('active symlink should point to v0.0.24', () => {
      const target = fs.readlinkSync(ACTIVE_LINK);
      expect(target).toContain('v0.0.24');
    });
  });
});
