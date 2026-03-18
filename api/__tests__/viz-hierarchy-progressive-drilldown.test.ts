import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Viz Hierarchy Progressive Drill-Down Tests — viz-hierarchy-progressive-drilldown
 * Validates: index.html has mission-grouped view with progressive disclosure.
 * TDD: Dev modifies viz/index.html to pass them.
 */

const INDEX_PATH = resolve(__dirname, '../../viz/index.html');

describe('Viz index.html exists and has hierarchy features', () => {

  it('viz/index.html exists', () => {
    expect(existsSync(INDEX_PATH)).toBe(true);
  });

  it('has mission card rendering function', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toMatch(/showMissionDetail|renderMission|missionDetail|mission-card/i);
  });

  it('has capability detail with requirements', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toMatch(/showCapabilityDetail|capabilityDetail|requirement/i);
  });

  it('has breadcrumb navigation', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toMatch(/breadcrumb/i);
  });

  it('has progress bar or progress display', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toMatch(/progress|task_count|complete_count/i);
  });
});

describe('Mission-grouped layout (not flat capability grid)', () => {

  it('calls /api/mission-overview for hierarchy data', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toContain('mission-overview');
  });

  it('renders mission titles from data', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    // Should reference mission title/description from API response
    expect(content).toMatch(/mission.*title|\.title|missions\[/i);
  });

  it('shows capability count per mission', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toMatch(/capabilities\.length|capability_count|capabilit/i);
  });
});

describe('Progressive disclosure levels', () => {

  it('Level 0: mission cards with click handler', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    // Mission cards should be clickable
    expect(content).toMatch(/onclick.*mission|addEventListener.*mission|click.*mission/i);
  });

  it('Level 1: capability list within mission', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toMatch(/capabilities.*forEach|capabilities.*map|capability.*card/i);
  });

  it('has back navigation or breadcrumb click handlers', () => {
    const content = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';
    expect(content).toMatch(/navigateTo|navStack|goBack|breadcrumb.*click/i);
  });
});
