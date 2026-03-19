import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * KB Navigation Tests — kb-navigation
 * Validates: Breadcrumbs, children links, cross-references in renderNodePage.
 * TDD: Dev enhances renderNodePage in viz/server.js.
 */

describe('Navigation functions exist in server.js', () => {

  it('has buildBreadcrumb function', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/buildBreadcrumb|breadcrumb.*function|function.*breadcrumb/i);
  });

  it('has getSiblings or sibling query', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/getSiblings|siblings|sibling/i);
  });

  it('has slugify function for URL-friendly names', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/slugify|slug.*function|toLowerCase.*replace/i);
  });
});

describe('Breadcrumb renders clickable hierarchy path', () => {

  it('breadcrumb links use short_id URLs', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/href.*\/m\/|href.*\/c\/|breadcrumb.*short_id/i);
  });

  it('capability breadcrumb includes parent mission', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/mission_title|mission_short_id/i);
  });
});

describe('Children section renders links to child nodes', () => {

  it('children cards have clickable links', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/children.*href|child.*link|forEach.*href/i);
  });
});

describe('Siblings shown as secondary navigation', () => {

  it('siblings or related nodes section exists', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/siblings|related|also.*under|other.*capabilities/i);
  });
});
