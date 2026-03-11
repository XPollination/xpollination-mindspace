/**
 * TDD tests for t3-3-topdown-propagation
 * Top-down suspect propagation: requirement change → code/test impact.
 *
 * Tests written BEFORE implementation — these should FAIL until dev implements.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;

  // Seed: user, project, agent, task, requirement, attestation
  db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT OR IGNORE INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT OR IGNORE INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'Test Agent', 'active')").run();
  db.prepare("INSERT OR IGNORE INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-1', 'test-proj', 'Test Task', 'active', 'dev', 'user-1')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('propagateRequirementChange()', () => {
  it('invalidates attestations referencing a changed requirement', async () => {
    const { propagateRequirementChange } = await import('../services/topdown-propagation.js');

    // Create a valid attestation referencing req-1
    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid)
       VALUES ('att-td-1', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1)`
    ).run();
    // Link attestation to requirement (via task_slug or req reference — design says by requirement ref)
    db.prepare("UPDATE attestations SET task_slug = 'task-1' WHERE id = 'att-td-1'").run();

    await propagateRequirementChange({
      requirement_ref: 'REQ-001',
      project_slug: 'test-proj',
      new_version: 2,
      affected_attestation_ids: ['att-td-1']
    });

    // Attestation should be invalidated
    const att = db.prepare("SELECT valid FROM attestations WHERE id = 'att-td-1'").get() as any;
    expect(att.valid).toBe(0);
  });

  it('creates suspect links for each invalidated attestation', async () => {
    const { propagateRequirementChange } = await import('../services/topdown-propagation.js');

    // Create another attestation
    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid)
       VALUES ('att-td-2', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1)`
    ).run();

    await propagateRequirementChange({
      requirement_ref: 'REQ-002',
      project_slug: 'test-proj',
      new_version: 2,
      affected_attestation_ids: ['att-td-2']
    });

    // Should create a suspect link
    const links = db.prepare(
      "SELECT * FROM suspect_links WHERE source_type = 'requirement' AND source_ref = 'REQ-002' AND project_slug = 'test-proj'"
    ).all() as any[];

    expect(links.length).toBeGreaterThan(0);
    expect(links[0].status).toBe('suspect');
    expect(links[0].target_type).toBe('test'); // or 'code' depending on scope
  });

  it('does not affect attestations from other projects', async () => {
    const { propagateRequirementChange } = await import('../services/topdown-propagation.js');

    // Create attestation in different project
    db.prepare("INSERT OR IGNORE INTO projects (id, slug, name, created_by) VALUES ('proj-2', 'other-proj', 'Other', 'user-1')").run();
    db.prepare("INSERT OR IGNORE INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-other', 'other-proj', 'Other Task', 'active', 'dev', 'user-1')").run();
    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid)
       VALUES ('att-td-other', 'task-other', 'other-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1)`
    ).run();

    await propagateRequirementChange({
      requirement_ref: 'REQ-003',
      project_slug: 'test-proj',
      new_version: 2,
      affected_attestation_ids: [] // no attestations in test-proj
    });

    // Other project's attestation should remain valid
    const att = db.prepare("SELECT valid FROM attestations WHERE id = 'att-td-other'").get() as any;
    expect(att.valid).toBe(1);
  });

  it('returns summary of invalidated attestations and created suspect links', async () => {
    const { propagateRequirementChange } = await import('../services/topdown-propagation.js');

    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid)
       VALUES ('att-td-3', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1)`
    ).run();

    const result = await propagateRequirementChange({
      requirement_ref: 'REQ-004',
      project_slug: 'test-proj',
      new_version: 3,
      affected_attestation_ids: ['att-td-3']
    });

    expect(result).toHaveProperty('invalidated_count');
    expect(result).toHaveProperty('suspect_links_created');
    expect(result.invalidated_count).toBe(1);
    expect(result.suspect_links_created).toBeGreaterThan(0);
  });
});
