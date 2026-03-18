import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Viz v0.0.35 Hierarchy Drilldown Tests — viz-v0035-hierarchy-drilldown
 * Validates: v0.0.35 index.html has progressive Mission→Capability drilldown.
 * TDD: Dev creates viz/versions/v0.0.35/ with updated loadMissionDashboard().
 */

const V35_DIR = resolve(__dirname, '../../viz/versions/v0.0.35');
const V35_INDEX = resolve(V35_DIR, 'index.html');
const V33_INDEX = resolve(__dirname, '../../viz/versions/v0.0.33/index.html');

describe('v0.0.35 directory exists', () => {

  it('viz/versions/v0.0.35/ directory exists', () => {
    expect(existsSync(V35_DIR)).toBe(true);
  });

  it('viz/versions/v0.0.35/index.html exists', () => {
    expect(existsSync(V35_INDEX)).toBe(true);
  });

  it('v0.0.33 still exists (rollback preserved)', () => {
    expect(existsSync(V33_INDEX)).toBe(true);
  });
});

describe('v0.0.35 has mission-grouped drilldown', () => {

  it('loadMissionDashboard uses mission-overview API', () => {
    const content = existsSync(V35_INDEX) ? readFileSync(V35_INDEX, 'utf-8') : '';
    expect(content).toContain('mission-overview');
  });

  it('renders mission cards (not flat capability grid)', () => {
    const content = existsSync(V35_INDEX) ? readFileSync(V35_INDEX, 'utf-8') : '';
    // Should iterate over missions, not just capabilities
    expect(content).toMatch(/missions.*forEach|missions.*map|\.missions/);
  });

  it('mission cards are clickable for drill-down', () => {
    const content = existsSync(V35_INDEX) ? readFileSync(V35_INDEX, 'utf-8') : '';
    expect(content).toMatch(/onclick.*mission|click.*mission|showMission/i);
  });

  it('shows capabilities within a mission', () => {
    const content = existsSync(V35_INDEX) ? readFileSync(V35_INDEX, 'utf-8') : '';
    expect(content).toMatch(/capabilities.*forEach|capabilities.*map|\.capabilities/);
  });

  it('shows task progress per capability', () => {
    const content = existsSync(V35_INDEX) ? readFileSync(V35_INDEX, 'utf-8') : '';
    expect(content).toMatch(/task_count|complete_count|progress/i);
  });
});

describe('Version identifier', () => {

  it('v0.0.35 index.html contains version marker', () => {
    const content = existsSync(V35_INDEX) ? readFileSync(V35_INDEX, 'utf-8') : '';
    expect(content).toMatch(/0\.0\.35|v0\.0\.35/);
  });
});
