/**
 * TDD tests for t3-4-bottomup-propagation
 * Bottom-up suspect propagation: test change → requirement re-approval.
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

  // Seed: user, project, agent, task
  db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT OR IGNORE INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT OR IGNORE INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'Test Agent', 'active')").run();
  db.prepare("INSERT OR IGNORE INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-1', 'test-proj', 'Test Task', 'active', 'dev', 'user-1')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('propagateTestChange()', () => {
  it('invalidates attestations that reference a changed test file', async () => {
    const { propagateTestChange } = await import('../services/bottomup-propagation.js');

    // Create a valid attestation with test reference
    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, submitted_checks, status, valid)
       VALUES ('att-bu-1', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '["tests_tagged"]', '["test-file-1.ts"]', 'accepted', 1)`
    ).run();

    await propagateTestChange({
      test_file: 'test-file-1.ts',
      project_slug: 'test-proj',
      affected_attestation_ids: ['att-bu-1']
    });

    // Attestation should be invalidated
    const att = db.prepare("SELECT valid FROM attestations WHERE id = 'att-bu-1'").get() as any;
    expect(att.valid).toBe(0);
  });

  it('creates suspect links from test → requirement', async () => {
    const { propagateTestChange } = await import('../services/bottomup-propagation.js');

    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid)
       VALUES ('att-bu-2', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1)`
    ).run();

    await propagateTestChange({
      test_file: 'test-file-2.ts',
      project_slug: 'test-proj',
      affected_attestation_ids: ['att-bu-2'],
      requirement_refs: ['REQ-001']
    });

    // Should create suspect link: test → requirement
    const links = db.prepare(
      "SELECT * FROM suspect_links WHERE source_type = 'test' AND project_slug = 'test-proj'"
    ).all() as any[];

    expect(links.length).toBeGreaterThan(0);
    expect(links[0].target_type).toBe('requirement');
    expect(links[0].status).toBe('suspect');
  });

  it('creates approval requests for re-approval', async () => {
    const { propagateTestChange } = await import('../services/bottomup-propagation.js');

    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid)
       VALUES ('att-bu-3', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1)`
    ).run();

    await propagateTestChange({
      test_file: 'test-file-3.ts',
      project_slug: 'test-proj',
      affected_attestation_ids: ['att-bu-3'],
      requirement_refs: ['REQ-002']
    });

    // Should create an approval request for re-approval
    const requests = db.prepare(
      "SELECT * FROM approval_requests WHERE project_slug = 'test-proj' AND status = 'pending'"
    ).all() as any[];

    expect(requests.length).toBeGreaterThan(0);
  });

  it('returns summary of propagation results', async () => {
    const { propagateTestChange } = await import('../services/bottomup-propagation.js');

    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid)
       VALUES ('att-bu-4', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1)`
    ).run();

    const result = await propagateTestChange({
      test_file: 'test-file-4.ts',
      project_slug: 'test-proj',
      affected_attestation_ids: ['att-bu-4']
    });

    expect(result).toHaveProperty('invalidated_count');
    expect(result).toHaveProperty('suspect_links_created');
    expect(result.invalidated_count).toBe(1);
  });
});
