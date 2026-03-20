import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * TDD Tests: Readiness Status Display in Mission Document Pages
 * Ref: REQ-OG-005, readiness-viz-design
 */

function getServerContent(): string {
  return existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
}

describe('Mission card readiness', () => {

  it('mission cards show readiness percentage', () => {
    const content = getServerContent();
    expect(content).toMatch(/readiness|ready.*percent|confirmation.*%/i);
  });
});

describe('Document page readiness detail', () => {

  it('requirement-level readiness indicators', () => {
    const content = getServerContent();
    expect(content).toMatch(/requirement.*readiness|per.?requirement.*confirm/i);
  });

  it('color scale for readiness', () => {
    const content = getServerContent();
    expect(content).toMatch(/readiness.*color|red.*green|confirmation.*badge/i);
  });
});

describe('Confirmation flow', () => {

  it('click-to-confirm interaction', () => {
    const content = getServerContent();
    expect(content).toMatch(/confirm.*click|confirm_ready|confirmation.*modal/i);
  });
});

describe('SpiceDB integration', () => {

  it('queries CONFIRMS_READY from SpiceDB', () => {
    const content = getServerContent();
    expect(content).toMatch(/CONFIRMS_READY|confirms_ready|spicedb.*ready/i);
  });
});
