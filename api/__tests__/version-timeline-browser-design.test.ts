import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * Version Timeline Browser Design Tests — version-timeline-browser-design
 * Validates: Version timeline section in KB capability pages.
 * TDD: Dev adds timeline rendering to renderNodePage.
 */

describe('Version timeline in renderNodePage', () => {

  it('renderNodePage includes version timeline section', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/version.*timeline|timeline.*version|version.*history/i);
  });

  it('queries capability_version_history table', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/capability_version_history/);
  });

  it('has expandable/collapsible UI for older versions', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/expand|collapse|toggle|show.*more|details|summary/i);
  });
});
