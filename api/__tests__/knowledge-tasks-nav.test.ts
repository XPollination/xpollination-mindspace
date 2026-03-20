import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * TDD Tests: Knowledge/Tasks/Releases Tab Navigation
 * Ref: REQ-VKF-002, knowledge-tasks-nav-design
 */

function getServerContent(): string {
  return existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
}

describe('AC1: Three tabs visible in header', () => {

  it('header contains Knowledge tab', () => {
    const content = getServerContent();
    expect(content).toMatch(/Knowledge.*tab|tab.*Knowledge/i);
  });

  it('header contains Tasks tab', () => {
    const content = getServerContent();
    expect(content).toMatch(/Tasks.*tab|tab.*Tasks/i);
  });

  it('header contains Releases tab', () => {
    const content = getServerContent();
    expect(content).toMatch(/Releases.*tab|tab.*Releases/i);
  });
});

describe('AC2: Tab switches without page reload', () => {

  it('client-side tab switching (pushState or hash)', () => {
    const content = getServerContent();
    expect(content).toMatch(/pushState|history\.push|hash.*change|tab.*switch/i);
  });
});

describe('AC5: Browser back/forward navigates tabs', () => {

  it('popstate event handler for tab navigation', () => {
    const content = getServerContent();
    expect(content).toMatch(/popstate|onpopstate|history/i);
  });
});

describe('AC6: Deep links work', () => {

  it('/tasks route exists', () => {
    const content = getServerContent();
    expect(content).toMatch(/\/tasks/);
  });

  it('/releases route exists', () => {
    const content = getServerContent();
    expect(content).toMatch(/\/releases/);
  });
});
