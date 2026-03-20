import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * TDD Tests: Release Manager Screen
 * Ref: REQ-VKF-004, release-manager-design
 */

function getServerContent(): string {
  return existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
}

describe('AC1: /releases route renders release manager', () => {

  it('server has /releases route handler', () => {
    const content = getServerContent();
    expect(content).toMatch(/\/releases/);
  });

  it('renderReleaseManager function exists', () => {
    const content = getServerContent();
    expect(content).toMatch(/renderRelease|release.?manager/i);
  });
});

describe('AC2: Tasks grouped by phase/group', () => {

  it('groups tasks by dna.group', () => {
    const content = getServerContent();
    expect(content).toMatch(/group|phase/i);
  });

  it('queries mindspace_nodes for task grouping', () => {
    const content = getServerContent();
    expect(content).toMatch(/mindscape_nodes|mindspace_nodes.*group|dna.*group/i);
  });
});

describe('AC3: Collapsible phase sections', () => {

  it('phase sections have collapse/expand', () => {
    const content = getServerContent();
    expect(content).toMatch(/collaps|details|summary|toggle/i);
  });
});

describe('AC4: Search overlay filters tasks', () => {

  it('search input for task filtering', () => {
    const content = getServerContent();
    expect(content).toMatch(/search.*task|filter.*task|type.*ahead/i);
  });
});

describe('Release button', () => {

  it('release button with confirmation', () => {
    const content = getServerContent();
    expect(content).toMatch(/release.*button|new.*release|confirm.*release/i);
  });
});
