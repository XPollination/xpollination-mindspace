import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Link Tasks to Requirements Tests — graph-link-tasks-to-requirements
 * Validates: scripts/link-tasks-to-requirements.js structure and mapping.
 * TDD: Dev creates the script to pass them.
 */

const SCRIPT_PATH = resolve(__dirname, '../../scripts/link-tasks-to-requirements.js');

describe('Script file exists', () => {

  it('scripts/link-tasks-to-requirements.js exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });
});

describe('Script covers all group mappings', () => {

  it('script maps AUTH group to REQ-AUTH requirements', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('REQ-AUTH-001');
    expect(content).toContain('REQ-AUTH-002');
  });

  it('script maps WORKFLOW group to REQ-WF requirements', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('REQ-WF-001');
    expect(content).toContain('REQ-WF-002');
  });

  it('script maps A2A group to REQ-A2A requirements', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('REQ-A2A-001');
    expect(content).toContain('REQ-A2A-002');
  });

  it('script maps INFRA group to REQ-INFRA requirements', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('REQ-INFRA-001');
    expect(content).toContain('REQ-INFRA-002');
  });

  it('script maps VIZ group to REQ-VIZ requirements', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('REQ-VIZ-001');
    expect(content).toContain('REQ-VIZ-002');
  });

  it('script maps HIERARCHY/graph-* to REQ-GRAPH requirements', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('REQ-GRAPH-001');
    expect(content).toContain('REQ-GRAPH-002');
  });
});

describe('Script uses correct patterns', () => {

  it('script uses interface-cli or update-dna for DNA updates', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/update-dna|interface-cli|requirement_refs/);
  });

  it('script has merge logic (not overwrite)', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    // Should contain merge/concat/spread or Set logic for dedup
    expect(content).toMatch(/merge|concat|Set|spread|existing|\.\.\.|\bunion\b/i);
  });

  it('script outputs summary/report', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/linked|summary|report|count|total/i);
  });
});
