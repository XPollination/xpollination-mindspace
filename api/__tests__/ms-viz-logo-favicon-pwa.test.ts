/**
 * TDD tests for ms-viz-logo-favicon-pwa
 * Viz v0.0.15: Mindspace logo in menu bar + favicons + PWA install.
 *
 * Tests written BEFORE implementation — these should FAIL until dev implements.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VIZ_ROOT = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/viz';

describe('v0.0.15 directory exists', () => {
  it('viz/versions/v0.0.15/index.html exists', () => {
    const indexPath = resolve(VIZ_ROOT, 'versions/v0.0.15/index.html');
    expect(existsSync(indexPath)).toBe(true);
  });
});

describe('Mindspace logo in header', () => {
  it('index.html contains an img tag referencing the mindspace logo', () => {
    const indexPath = resolve(VIZ_ROOT, 'versions/v0.0.15/index.html');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toMatch(/mindspace-logo/i);
    expect(content).toMatch(/<img[^>]+src=[^>]*mindspace-logo/i);
  });

  it('logo is placed in the header section', () => {
    const indexPath = resolve(VIZ_ROOT, 'versions/v0.0.15/index.html');
    const content = readFileSync(indexPath, 'utf-8');
    // Logo img should appear within the header div
    const headerMatch = content.match(/<div[^>]*class="header"[^>]*>([\s\S]*?)<\/div>/i);
    expect(headerMatch).toBeDefined();
    expect(headerMatch![1]).toMatch(/mindspace-logo/i);
  });
});

describe('Favicon references in HTML head', () => {
  it('includes favicon.ico link', () => {
    const indexPath = resolve(VIZ_ROOT, 'versions/v0.0.15/index.html');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toMatch(/favicon\.ico/);
  });

  it('includes apple-touch-icon link', () => {
    const indexPath = resolve(VIZ_ROOT, 'versions/v0.0.15/index.html');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toMatch(/apple-touch-icon/);
  });

  it('includes manifest.webmanifest link', () => {
    const indexPath = resolve(VIZ_ROOT, 'versions/v0.0.15/index.html');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toMatch(/manifest\.webmanifest/);
  });
});

describe('PWA install functionality', () => {
  it('registers a service worker or has beforeinstallprompt listener', () => {
    const indexPath = resolve(VIZ_ROOT, 'versions/v0.0.15/index.html');
    const content = readFileSync(indexPath, 'utf-8');
    // Should have either service worker registration or install prompt handling
    expect(content).toMatch(/beforeinstallprompt|serviceWorker\.register/i);
  });
});
