import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * Viz Light Mode Default Tests — viz-light-mode-default
 * Validates: Light theme default, dark toggle, CSS custom properties, localStorage.
 * TDD: Dev adds theme system to viz.
 */

describe('CSS custom properties for theming', () => {

  it('server.js uses CSS custom properties (--var)', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/--[a-z]+-color|--bg|--text|var\(--/i);
  });

  it('has :root with light theme values', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/:root/);
  });

  it('has [data-theme=dark] or .dark-theme override', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/data-theme.*dark|\.dark-theme|dark-mode/i);
  });
});

describe('Theme toggle functionality', () => {

  it('has toggle button or switch in HTML', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/toggle.*theme|theme.*toggle|dark.*mode.*button|switch.*theme/i);
  });

  it('uses localStorage to persist preference', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/localStorage/);
  });
});

describe('Light mode is default', () => {

  it('default background is light (not dark)', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    // :root should have light colors, not dark
    // Check for light background values (white, light gray, etc.)
    expect(content).toMatch(/:root[^}]*#f[0-9a-f]{5}|:root[^}]*#e[0-9a-f]{5}|:root[^}]*white|:root[^}]*#fff/i);
  });
});
