import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * TDD Tests: Vector Search Bar in Viz Header
 * Ref: REQ-VKF-006, search-bar-design
 */

function getServerContent(): string {
  return existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
}

describe('Search bar in header', () => {
  it('header contains search input', () => {
    const content = getServerContent();
    expect(content).toMatch(/search.*input|input.*search|searchBar/i);
  });
});

describe('Brain vector search', () => {
  it('search queries brain/memory API', () => {
    const content = getServerContent();
    expect(content).toMatch(/\/api\/v1\/memory|brain.*search|vector.*search/i);
  });

  it('debounce on search input', () => {
    const content = getServerContent();
    expect(content).toMatch(/debounce|300.*ms|setTimeout.*search/i);
  });
});

describe('Result overlay', () => {
  it('dropdown overlay for results', () => {
    const content = getServerContent();
    expect(content).toMatch(/overlay|dropdown.*result|search.*result/i);
  });

  it('results show type badges', () => {
    const content = getServerContent();
    expect(content).toMatch(/type.*badge|badge.*type|result.*type/i);
  });
});
