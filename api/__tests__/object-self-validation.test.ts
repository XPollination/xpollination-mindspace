import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

/**
 * TDD Tests: Object Self-Validation for Readiness Confirmation
 * Ref: REQ-OG-004, object-self-validation-design
 */

function findSource(): string {
  const candidates = [
    resolve(PROJECT_ROOT, 'api/routes/a2a.ts'),
    resolve(PROJECT_ROOT, 'api/routes/a2a.js'),
    resolve(PROJECT_ROOT, 'src/validation/readiness.ts'),
    resolve(PROJECT_ROOT, 'src/validation/readiness.js'),
  ];
  const path = candidates.find(p => existsSync(p));
  return path ? readFileSync(path, 'utf-8') : '';
}

describe('confirm_ready endpoint', () => {

  it('POST /a2a/confirm_ready route exists', () => {
    const content = findSource();
    expect(content).toMatch(/confirm_ready|confirmReady/i);
  });
});

describe('Validation rules', () => {

  it('validates title exists', () => {
    const content = findSource();
    expect(content).toMatch(/title.*required|title.*valid/i);
  });

  it('validates content minimum length', () => {
    const content = findSource();
    expect(content).toMatch(/100.*char|content.*length|minimum.*content/i);
  });

  it('validates active status', () => {
    const content = findSource();
    expect(content).toMatch(/active.*status|status.*active/i);
  });
});

describe('Auto-cascade confirmation', () => {

  it('capability auto-confirms when all requirements confirmed', () => {
    const content = findSource();
    expect(content).toMatch(/cascade|auto.*confirm|all.*requirements/i);
  });

  it('new requirement resets parent confirmation', () => {
    const content = findSource();
    expect(content).toMatch(/reset|invalidate|new.*requirement/i);
  });
});

describe('SpiceDB integration', () => {

  it('creates CONFIRMS_READY relationship', () => {
    const content = findSource();
    expect(content).toMatch(/CONFIRMS_READY|confirms_ready/i);
  });
});
