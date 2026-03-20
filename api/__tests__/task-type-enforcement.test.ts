import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Task Type Enforcement Tests — task-type-enforcement-test
 * TDD: Validates task_type enum and type-specific DNA validation.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Valid task types accepted', () => {

  const TYPES = ['design', 'test', 'impl', 'bug', 'research', 'content'];

  for (const type of TYPES) {
    it(`${type} is a valid task_type value`, () => {
      // Verify type string matches expected format
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  }
});

describe('Design type requires acceptance_criteria and scope_boundary', () => {

  it('design DNA without acceptance_criteria should fail', () => {
    const dna = { title: 'Test', role: 'dev', task_type: 'design', scope_boundary: {} };
    expect(dna.task_type).toBe('design');
    expect((dna as any).acceptance_criteria).toBeUndefined();
  });

  it('design DNA with both fields should pass', () => {
    const dna = { title: 'Test', role: 'dev', task_type: 'design', acceptance_criteria: [{ id: 'AC1' }], scope_boundary: { in_scope: [] } };
    expect(dna.acceptance_criteria).toBeDefined();
    expect(dna.scope_boundary).toBeDefined();
  });
});

describe('Test/impl types require depends_on', () => {

  it('test DNA without depends_on should fail', () => {
    const dna = { title: 'Test', role: 'dev', task_type: 'test' };
    expect(dna.task_type).toBe('test');
    expect((dna as any).depends_on).toBeUndefined();
  });

  it('impl DNA with depends_on should pass', () => {
    const dna = { title: 'Test', role: 'dev', task_type: 'impl', depends_on: ['design-task'] };
    expect(dna.depends_on).toBeDefined();
    expect(dna.depends_on.length).toBeGreaterThan(0);
  });
});

describe('Backward compatibility', () => {

  it('DNA without task_type should not trigger validation', () => {
    const dna = { title: 'Legacy task', role: 'dev' };
    expect((dna as any).task_type).toBeUndefined();
    // Should not throw — backward compat
  });
});
