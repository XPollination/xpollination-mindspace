import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');
const PKG_PATH = resolve(__dirname, '../../package.json');

/**
 * TDD Tests: PLATFORM-001 Document Styling
 * Ref: REQ-KB-006, platform001-styling-design
 */

function getServerContent(): string {
  return existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
}

describe('AC1: Alternating table rows', () => {

  it('CSS includes nth-child(even) rule for table rows', () => {
    const content = getServerContent();
    expect(content).toMatch(/nth-child\(even\)/);
  });

  it('uses --stripe-bg CSS variable', () => {
    const content = getServerContent();
    expect(content).toMatch(/--stripe-bg/);
  });
});

describe('AC2: Code syntax highlighting', () => {

  it('references highlight.js or hljs', () => {
    const content = getServerContent();
    expect(content).toMatch(/hljs|highlight\.js|highlightjs/i);
  });

  it('applies highlighting to code blocks', () => {
    const content = getServerContent();
    expect(content).toMatch(/hljs.*highlight|highlight.*code/i);
  });
});

describe('AC3: Typography scale', () => {

  it('defines h1 styling (28px or equivalent)', () => {
    const content = getServerContent();
    expect(content).toMatch(/h1.*\{|h1.*font-size|h1.*28px|1\.75rem/);
  });

  it('defines heading hierarchy (h2, h3, h4)', () => {
    const content = getServerContent();
    expect(content).toMatch(/h2.*font-size|h2.*22px|1\.375rem/);
  });
});

describe('AC4: SVG centering with dark mode protection', () => {

  it('SVG elements have max-width and centering', () => {
    const content = getServerContent();
    expect(content).toMatch(/svg.*max-width|svg.*margin.*auto|svg.*center/i);
  });

  it('SVG has white background in dark mode', () => {
    const content = getServerContent();
    expect(content).toMatch(/svg.*background.*white|svg.*bg.*#fff/i);
  });
});

describe('AC5: Print stylesheet', () => {

  it('includes @media print rules', () => {
    const content = getServerContent();
    expect(content).toMatch(/@media\s+print/);
  });

  it('hides navigation in print', () => {
    const content = getServerContent();
    expect(content).toMatch(/print.*display.*none|print.*nav.*hide/i);
  });
});

describe('AC7: highlight.js dependency', () => {

  it('highlight.js is in package.json dependencies', () => {
    const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps['highlight.js']).toBeDefined();
  });
});
