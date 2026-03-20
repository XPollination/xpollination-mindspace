import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * TDD Tests: Mission Map Landing Page
 * Ref: REQ-VKF-001, mission-map-landing-design
 * Tests verify viz/server.js implements mission map as root route.
 */

function getServerContent(): string {
  return existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
}

describe('AC1: Root route serves mission map', () => {

  it('root path / has mission map handler (not static file fallback)', () => {
    const content = getServerContent();
    expect(content).toMatch(/renderMissionMap/);
  });

  it('root route handler fetches mission overview data', () => {
    const content = getServerContent();
    // Should call mission overview API or query DB for missions
    expect(content).toMatch(/mission.?overview|getMissionOverview/i);
  });
});

describe('AC2: Card shows title, description, cap count, status badge', () => {

  it('card HTML includes mission title element', () => {
    const content = getServerContent();
    expect(content).toMatch(/mission.*title|card.*title/i);
  });

  it('card HTML includes description excerpt', () => {
    const content = getServerContent();
    // Description truncated to ~120 chars per PDSA
    expect(content).toMatch(/description|excerpt|substring|slice/i);
  });

  it('card includes capability count badge', () => {
    const content = getServerContent();
    expect(content).toMatch(/cap.*count|capabilities.*length|caps\]/i);
  });

  it('card includes status badge with color', () => {
    const content = getServerContent();
    // Status colors from design: #48bb78 (active green), #4299e1 (draft blue), etc.
    expect(content).toMatch(/#48bb78|#4299e1|#a0aec0|status.*badge/i);
  });
});

describe('AC3: Card click navigates to /m/{short_id}', () => {

  it('card links use /m/ URL pattern', () => {
    const content = getServerContent();
    expect(content).toMatch(/\/m\/.*short_id|href.*\/m\//i);
  });
});

describe('AC4: Deprecated missions dimmed below active', () => {

  it('separates active and deprecated missions', () => {
    const content = getServerContent();
    expect(content).toMatch(/deprecated|dimmed|inactive/i);
  });

  it('deprecated section has dimmed styling', () => {
    const content = getServerContent();
    // Per PDSA: text color #a0aec0, background #f7fafc
    expect(content).toMatch(/#a0aec0|opacity|dimmed|deprecated/i);
  });
});

describe('AC5: Footer shows mission/capability stats', () => {

  it('footer includes active count', () => {
    const content = getServerContent();
    expect(content).toMatch(/active.*·|stats.*active/i);
  });

  it('footer includes capability count', () => {
    const content = getServerContent();
    expect(content).toMatch(/capabilit.*count|capabilities|caps/i);
  });
});

describe('AC8: Kanban accessible at /kanban', () => {

  it('kanban route handler exists at /kanban', () => {
    const content = getServerContent();
    expect(content).toMatch(/\/kanban/);
  });

  it('kanban route serves kanban view (not mission map)', () => {
    const content = getServerContent();
    // Kanban should serve index.html or kanban content
    expect(content).toMatch(/kanban.*index\.html|\/kanban.*kanban/i);
  });
});
