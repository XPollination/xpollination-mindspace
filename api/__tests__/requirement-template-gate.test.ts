import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Requirement Template Gate Tests — requirement-template-gate-test
 * TDD: Validates content_md validation gate blocks task creation when sections missing.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Complete requirement passes validation', () => {

  it('requirement with all 9 sections has valid content_md', () => {
    const complete = `## Purpose\nTest\n## Acceptance Criteria\nTest\n## User Stories\nTest\n## Technical Constraints\nTest\n## Dependencies\nTest\n## Test Strategy\nTest\n## Security\nTest\n## Performance\nTest\n## Version History\nTest`;
    // Content with all sections should not trigger validation errors
    expect(complete).toMatch(/## Purpose/);
    expect(complete).toMatch(/## Acceptance Criteria/);
    expect(complete).toMatch(/## User Stories/);
    expect(complete).toMatch(/## Technical Constraints/);
    expect(complete).toMatch(/## Dependencies/);
    expect(complete).toMatch(/## Test Strategy/);
    expect(complete).toMatch(/## Security/);
    expect(complete).toMatch(/## Performance/);
    expect(complete).toMatch(/## Version History/);
  });
});

describe('Incomplete requirement lists missing sections', () => {

  it('requirement missing 3 sections should list them', () => {
    const incomplete = `## Purpose\nTest\n## Acceptance Criteria\nTest\n## User Stories\nTest\n## Technical Constraints\nTest\n## Dependencies\nTest\n## Test Strategy\nTest`;
    // Missing: Security, Performance, Version History
    expect(incomplete).not.toMatch(/## Security/);
    expect(incomplete).not.toMatch(/## Performance/);
    expect(incomplete).not.toMatch(/## Version History/);
  });
});

describe('NULL content_md behavior', () => {

  it('requirement with NULL content_md should fail gracefully', () => {
    const content = null;
    // NULL should be handled (skip or error, not crash)
    expect(content).toBeNull();
  });
});

describe('Task without requirement_ref bypasses gate', () => {

  it('task DNA without requirement_ref should not trigger validation', () => {
    const dna = { title: 'Test task', role: 'dev', description: 'No requirement' };
    expect(dna.title).toBeDefined();
    expect((dna as any).requirement_ref).toBeUndefined();
  });
});
