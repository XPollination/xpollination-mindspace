import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Login Page Redesign Tests — ms-login-page-redesign
 * Validates: light theme, branding, image pipeline, accessibility, responsive
 */

const VIZ_BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/viz';

// Find the latest version (should be v0.0.27 after redesign)
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

function readLogin(): string {
  const ver = getLatestVersion();
  const path = resolve(VIZ_BASE, 'versions', ver, 'login.html');
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

function readRegister(): string {
  const ver = getLatestVersion();
  const path = resolve(VIZ_BASE, 'versions', ver, 'register.html');
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

// ==========================================================================
// 1. Light theme
// ==========================================================================

describe('D1: Light theme', () => {
  it('login.html uses light background (not dark)', () => {
    const html = readLogin();
    // Should have light/white background, not dark (#1a1a2e, #000, etc.)
    expect(html).toMatch(/#faf|#fff|#f5f|white|background.*light/i);
    expect(html).not.toMatch(/background.*#1a1a2e/);
  });
});

// ==========================================================================
// 2. Image pipeline — optimized logo
// ==========================================================================

describe('D2: Image pipeline', () => {
  it('login.html uses picture element with srcset or webp', () => {
    const html = readLogin();
    expect(html).toMatch(/<picture|\.webp|srcset/i);
  });

  it('optimized logo files exist (120px WebP)', () => {
    const webp = resolve(VIZ_BASE, 'assets/mindspace-logo-120.webp');
    const png = resolve(VIZ_BASE, 'assets/mindspace-logo-120.png');
    expect(existsSync(webp) || existsSync(png)).toBe(true);
  });

  it('login.html does NOT reference the full 723px logo directly', () => {
    const html = readLogin();
    expect(html).not.toMatch(/mindspace-logo\.png/);
  });
});

// ==========================================================================
// 3. Visual hierarchy — logo, tagline, form
// ==========================================================================

describe('D3: Visual hierarchy', () => {
  it('login.html has a tagline or description text', () => {
    const html = readLogin();
    // Should have some descriptive text about Mindspace
    expect(html).toMatch(/mindspace|collective|intelligence|knowledge/i);
  });

  it('login.html has a form with email and password inputs', () => {
    const html = readLogin();
    expect(html).toMatch(/type=["']email["']/i);
    expect(html).toMatch(/type=["']password["']/i);
  });
});

// ==========================================================================
// 4. Accessibility
// ==========================================================================

describe('D4: Accessibility', () => {
  it('login.html inputs have associated labels', () => {
    const html = readLogin();
    expect(html).toMatch(/<label/i);
  });

  it('login.html form has submit button', () => {
    const html = readLogin();
    expect(html).toMatch(/type=["']submit["']|<button/i);
  });
});

// ==========================================================================
// 5. Performance — system-ui font stack, no external fonts
// ==========================================================================

describe('D5: Performance', () => {
  it('login.html uses system-ui font stack', () => {
    const html = readLogin();
    expect(html).toMatch(/system-ui|font-family.*-apple-system/i);
  });

  it('login.html does NOT load external fonts', () => {
    const html = readLogin();
    expect(html).not.toMatch(/fonts\.googleapis\.com/);
  });
});

// ==========================================================================
// 6. Register page consistency
// ==========================================================================

describe('D6: Register page matches login', () => {
  it('register.html uses same light theme', () => {
    const html = readRegister();
    expect(html).toMatch(/#faf|#fff|#f5f|white|background.*light/i);
  });

  it('register.html has invite code field', () => {
    const html = readRegister();
    expect(html).toMatch(/invite/i);
  });
});

// ==========================================================================
// 7. Responsive
// ==========================================================================

describe('D7: Responsive', () => {
  it('login.html has viewport meta tag', () => {
    const html = readLogin();
    expect(html).toMatch(/name=["']viewport["']/i);
  });

  it('login.html has max-width constraint on form', () => {
    const html = readLogin();
    expect(html).toMatch(/max-width/i);
  });
});
