import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * KB URL Routing Tests — kb-url-routing
 * Validates: viz/server.js has KB routes /m/, /c/, /r/, /t/ with short_id lookup.
 * TDD: Dev adds route handler to viz/server.js.
 */

describe('KB route handler exists in server.js', () => {

  it('server.js has KB_ROUTE regex pattern', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/KB_ROUTE|kb.route|\/\(m\|c\|r\|t\)/i);
  });

  it('server.js has handleKbRoute function', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/handleKbRoute|handleKb|kbRoute/);
  });

  it('server.js has renderNodePage function', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/renderNodePage|renderNode|nodeTemplate/);
  });

  it('server.js has 404 handler for unknown short_ids', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/404|send404|Not Found/);
  });
});

describe('Route pattern handles all type prefixes', () => {

  it('handles /m/ for missions', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/missions.*short_id|FROM missions WHERE short_id/i);
  });

  it('handles /c/ for capabilities with mission JOIN', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/capabilities.*short_id.*JOIN.*missions|FROM capabilities.*WHERE.*short_id/i);
  });

  it('handles /r/ for requirements with capability+mission JOIN', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/requirements.*short_id.*JOIN|FROM requirements.*WHERE.*short_id/i);
  });
});

describe('.md suffix returns markdown', () => {

  it('server.js handles .md suffix for raw markdown output', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/\.md|content_md|text\/plain/);
  });
});

describe('HTML response includes metadata', () => {

  it('renderNodePage generates Open Graph meta tags', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/og:title|og:description|meta.*property/i);
  });

  it('renderNodePage includes breadcrumb navigation', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/breadcrumb|mission_title|parent/i);
  });
});
