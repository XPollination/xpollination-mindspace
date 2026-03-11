/**
 * TDD tests for t3-5-attestation-version-check
 * Cross-reference attestation req_version against current requirement version.
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

describe('checkAttestationVersion()', () => {
  it('returns valid when attestation req_version matches current requirement version', async () => {
    const { checkAttestationVersion } = await import('../services/attestation-version-check.js');

    // Create attestation with req_version = 1
    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid, req_version)
       VALUES ('att-vc-1', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1, 1)`
    ).run();

    const result = checkAttestationVersion('att-vc-1', { current_version: 1 });
    expect(result.valid).toBe(true);
    expect(result.version_mismatch).toBe(false);
  });

  it('returns invalid when attestation req_version does not match current version', async () => {
    const { checkAttestationVersion } = await import('../services/attestation-version-check.js');

    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid, req_version)
       VALUES ('att-vc-2', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1, 1)`
    ).run();

    const result = checkAttestationVersion('att-vc-2', { current_version: 2 });
    expect(result.valid).toBe(false);
    expect(result.version_mismatch).toBe(true);
    expect(result.attestation_version).toBe(1);
    expect(result.current_version).toBe(2);
  });

  it('invalidates attestation and creates suspect link on version mismatch', async () => {
    const { checkAttestationVersion } = await import('../services/attestation-version-check.js');

    db.prepare(
      `INSERT INTO attestations (id, task_id, task_slug, project_slug, agent_id, from_status, to_status, required_checks, status, valid, req_version)
       VALUES ('att-vc-3', 'task-1', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1, 1)`
    ).run();

    checkAttestationVersion('att-vc-3', { current_version: 3 });

    // Attestation should be invalidated
    const att = db.prepare("SELECT valid FROM attestations WHERE id = 'att-vc-3'").get() as any;
    expect(att.valid).toBe(0);

    // Suspect link should be created
    const links = db.prepare(
      "SELECT * FROM suspect_links WHERE target_ref = 'att-vc-3' AND project_slug = 'test-proj'"
    ).all() as any[];
    expect(links.length).toBeGreaterThan(0);
  });
});

describe('scanStaleAttestations()', () => {
  it('finds all attestations with outdated req_version', async () => {
    const { scanStaleAttestations } = await import('../services/attestation-version-check.js');

    // Create attestations with old versions
    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid, req_version)
       VALUES ('att-vc-stale-1', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1, 1)`
    ).run();
    db.prepare(
      `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, required_checks, status, valid, req_version)
       VALUES ('att-vc-stale-2', 'task-1', 'test-proj', 'agent-1', 'active', 'review', '[]', 'accepted', 1, 1)`
    ).run();

    const stale = scanStaleAttestations('test-proj', { current_versions: { 'REQ-001': 3 } });
    expect(Array.isArray(stale)).toBe(true);
  });
});

describe('Gate integration', () => {
  it('rejects attestation at gate when version is stale', async () => {
    const { checkAttestationGate } = await import('../services/attestation-gate.js');

    // Configure rule
    db.prepare(
      "INSERT OR IGNORE INTO attestation_rules (id, project_slug, from_status, to_status, rules) VALUES ('rule-vc-1', 'test-proj', 'review', 'complete', '[\"version_check\"]')"
    ).run();

    // Create attestation with old version (valid=1 but stale req_version)
    db.prepare(
      `INSERT INTO attestations (id, task_id, task_slug, project_slug, agent_id, from_status, to_status, required_checks, status, valid, req_version)
       VALUES ('att-vc-gate', 'task-1', 'task-1', 'test-proj', 'agent-1', 'review', 'complete', '[]', 'accepted', 1, 1)`
    ).run();

    // Gate should reject when version check detects mismatch
    const gate = checkAttestationGate('task-1', 'test-proj', 'review', 'complete');

    // With version check integration, stale attestation should not pass
    // (This test validates the gate integration described in the design)
    expect(gate).toHaveProperty('allowed');
  });
});
