/**
 * TDD tests for viz-v0022-rebuild-from-v0017
 *
 * Root cause: viz/server.js serves static files from __dirname (viz/ root)
 * instead of from viz/active/ symlink. This means the versioning system
 * is decorative — version directories exist but the server ignores them.
 *
 * Fix: server.js must resolve static files through viz/active/ symlink.
 *
 * Acceptance Criteria:
 * AC-SERVE1: Static file base path uses active/ symlink, not __dirname
 * AC-SERVE2: index.html served matches active version content
 * AC-SERVE3: Directory traversal protection works with active/ base
 * AC-SERVE4: Active symlink missing → graceful fallback or error
 * AC-SERVE5: Other static files (changelog.json) also served from active/
 * AC-SERVE6: API routes (/api/*) still work (not affected by static change)
 * AC-SERVE7: Live server test — GET / returns active version index.html
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const VIZ_DIR = path.join(__dirname, '.');
const SERVER_JS = path.join(VIZ_DIR, 'server.js');
const ACTIVE_LINK = path.join(VIZ_DIR, 'active');
const ROOT_INDEX = path.join(VIZ_DIR, 'index.html');

const serverSrc = fs.readFileSync(SERVER_JS, 'utf-8');

// Check if TEST viz server is running on port 4200
async function isVizUp(): Promise<boolean> {
  try {
    const res = await fetch('http://10.33.33.1:4200/api/health', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

describe('viz-v0022-rebuild-from-v0017: static file serving from active symlink', () => {

  // === SOURCE-LEVEL TESTS ===

  describe('AC-SERVE1: Static file base path uses active/ symlink', () => {
    it('should resolve static files through active/ directory, not bare __dirname', () => {
      // The static file serving section should reference 'active' path
      // Old pattern: path.join(__dirname, filePath)
      // New pattern: path.join(__dirname, 'active', filePath) or path.join(activeDir, filePath)
      const staticSection = serverSrc.slice(serverSrc.indexOf('// Static files'));

      // Must NOT use bare __dirname for file resolution (the bug)
      // The path.join(__dirname, filePath) without 'active' is the broken pattern
      const hasActiveInPath = /path\.join\([^)]*['"]active['"][^)]*\)/.test(staticSection) ||
                              /activeDir|ACTIVE_DIR|staticRoot|STATIC_ROOT/.test(staticSection);

      expect(hasActiveInPath).toBe(true);
    });

    it('should define the active directory path variable', () => {
      // Server should have a variable pointing to the active symlink
      const hasActiveDef = /active.*=.*path\.(join|resolve)\(.*['"]active['"]/.test(serverSrc) ||
                          /STATIC_ROOT|staticRoot|activeDir|ACTIVE_DIR/.test(serverSrc);
      expect(hasActiveDef).toBe(true);
    });
  });

  describe('AC-SERVE2: index.html content matches active version', () => {
    it('active symlink should exist and point to a version directory', () => {
      expect(fs.existsSync(ACTIVE_LINK)).toBe(true);
      const target = fs.readlinkSync(ACTIVE_LINK);
      expect(target).toMatch(/versions\/v\d+\.\d+\.\d+/);
    });

    it('active index.html should differ from root index.html (proves root is stale)', () => {
      const activeIndex = fs.readFileSync(path.join(ACTIVE_LINK, 'index.html'), 'utf-8');
      const rootIndex = fs.readFileSync(ROOT_INDEX, 'utf-8');
      // Root is the old 2017-line file, active is the current 2283-line file
      expect(activeIndex.length).toBeGreaterThan(rootIndex.length);
    });

    it('active index.html should have correct dropdown order (manual, semi, auto-approval, auto)', () => {
      const activeIndex = fs.readFileSync(path.join(ACTIVE_LINK, 'index.html'), 'utf-8');
      const dropdownMatch = activeIndex.match(/<option[^>]*>Manual<\/option>\s*<option[^>]*>Semi<\/option>\s*<option[^>]*>Auto-Approval<\/option>\s*<option[^>]*>Auto<\/option>/);
      expect(dropdownMatch).not.toBeNull();
    });
  });

  describe('AC-SERVE3: Directory traversal protection with active/ base', () => {
    it('should still have directory traversal check in server source', () => {
      expect(serverSrc).toContain('Forbidden');
      // Should check that resolved path starts with the base directory
      const hasTraversalCheck = /startsWith/.test(serverSrc) && /403/.test(serverSrc);
      expect(hasTraversalCheck).toBe(true);
    });

    it('traversal check should use active-based path, not bare __dirname', () => {
      // The security check must reference the same base as file resolution
      // i.e., if files are served from activeDir, the startsWith check must use activeDir
      const staticSection = serverSrc.slice(serverSrc.indexOf('// Static files'));

      // Should NOT have the old pattern: filePath.startsWith(__dirname) when serving from active
      // The startsWith check base should match the join base
      const hasConsistentBase =
        // Either both use active-based variable
        (/activeDir|ACTIVE_DIR|staticRoot|STATIC_ROOT/.test(staticSection) &&
         /startsWith\s*\(\s*(activeDir|ACTIVE_DIR|staticRoot|STATIC_ROOT)/.test(staticSection)) ||
        // Or uses path.join(__dirname, 'active') consistently
        /startsWith\s*\([^)]*active/.test(staticSection);

      expect(hasConsistentBase).toBe(true);
    });
  });

  describe('AC-SERVE4: Graceful handling when active symlink is missing', () => {
    it('should have fallback or error handling for missing active symlink', () => {
      // Server should check if active symlink exists at startup or serve time
      const hasActiveCheck = /existsSync.*active/.test(serverSrc) ||
                            /readlinkSync.*active/.test(serverSrc) ||
                            /lstatSync.*active/.test(serverSrc) ||
                            /active.*exist/.test(serverSrc) ||
                            /!.*active/.test(serverSrc);
      expect(hasActiveCheck).toBe(true);
    });
  });

  describe('AC-SERVE5: Other static files served from active/', () => {
    it('active directory should contain changelog.json', () => {
      const changelogPath = path.join(ACTIVE_LINK, 'changelog.json');
      expect(fs.existsSync(changelogPath)).toBe(true);
    });

    it('active directory should contain server.js', () => {
      const serverPath = path.join(ACTIVE_LINK, 'server.js');
      expect(fs.existsSync(serverPath)).toBe(true);
    });
  });

  describe('AC-SERVE6: API routes unaffected by static file change', () => {
    it('API route handling should be before static file handling in source', () => {
      const apiRouteIdx = serverSrc.indexOf('/api/');
      const staticIdx = serverSrc.indexOf('// Static files');
      // API routes are handled before static fallback
      expect(apiRouteIdx).toBeLessThan(staticIdx);
      expect(apiRouteIdx).toBeGreaterThan(0);
    });

    it('API routes should not reference active directory', () => {
      // API handlers use database queries, not filesystem
      // The active/ change should only affect the static file section
      const apiSection = serverSrc.slice(
        serverSrc.indexOf('if (pathname.startsWith(\'/api/'),
        serverSrc.indexOf('// Static files')
      );
      expect(apiSection).not.toContain('active');
    });
  });

  // === LIVE SERVER TESTS ===

  describe('AC-SERVE7: Live server verification', () => {
    it('GET / should return the active version index.html, not root', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return; // skip if server not running

      const res = await fetch('http://10.33.33.1:4200/');
      expect(res.status).toBe(200);
      const html = await res.text();

      // Active version has the correct dropdown order
      expect(html).toContain('auto-approval');

      // Active version is longer than the stale root
      const activeIndex = fs.readFileSync(path.join(ACTIVE_LINK, 'index.html'), 'utf-8');
      // Served content should match active version length (approximately)
      expect(Math.abs(html.length - activeIndex.length)).toBeLessThan(100);
    });

    it('GET /changelog.json should return active version changelog', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const res = await fetch('http://10.33.33.1:4200/changelog.json');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toBeDefined();
    });

    it('GET /../../../etc/passwd should be blocked (traversal)', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const res = await fetch('http://10.33.33.1:4200/../../../etc/passwd');
      // Should get 403 Forbidden or 404 (depending on URL normalization)
      expect([403, 404]).toContain(res.status);
    });

    it('API health endpoint should still work after static change', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const res = await fetch('http://10.33.33.1:4200/api/health');
      expect(res.status).toBe(200);
    });
  });
});
