/**
 * TDD tests for t2-5-rejection-feedback
 * Attestation rejection feedback: structured failure details with suggestions.
 *
 * Tests written BEFORE implementation — these should FAIL until dev implements.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;

  // Seed test data: user, project, agent, task
  db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT OR IGNORE INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT OR IGNORE INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'Test Agent', 'active')").run();
  db.prepare("INSERT OR IGNORE INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-1', 'test-proj', 'Test Task', 'active', 'dev', 'user-1')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('rejectWithFeedback()', () => {
  it('stores structured JSON rejection_reason when attestation is rejected', async () => {
    const { rejectWithFeedback, requestAttestation } = await import('../lib/attestation.js');

    // Create a pending attestation
    const att = requestAttestation({
      task_id: 'task-1',
      project_slug: 'test-proj',
      agent_id: 'agent-1',
      from_status: 'active',
      to_status: 'review',
      required_checks: ['tags_present', 'refs_valid']
    });

    // Simulate failed validation results
    const validationResults = [
      { rule: 'tags_present', passed: false, message: 'Missing req_id' },
      { rule: 'refs_valid', passed: true, message: undefined }
    ];

    const result = rejectWithFeedback(att.id, validationResults);

    expect(result.status).toBe('rejected');

    // rejection_reason should be structured JSON
    const parsed = JSON.parse(result.rejection_reason);
    expect(parsed).toHaveProperty('checks_failed');
    expect(parsed).toHaveProperty('summary');
    expect(parsed.checks_failed).toHaveLength(1); // only failed checks
    expect(parsed.checks_failed[0].rule).toBe('tags_present');
    expect(parsed.checks_failed[0].passed).toBe(false);
    expect(parsed.checks_failed[0]).toHaveProperty('suggestion');
  });

  it('includes suggestions from the suggestion map for each failed rule', async () => {
    const { rejectWithFeedback, requestAttestation } = await import('../lib/attestation.js');

    const att = requestAttestation({
      task_id: 'task-1',
      project_slug: 'test-proj',
      agent_id: 'agent-1',
      from_status: 'active',
      to_status: 'review',
      required_checks: ['tags_present', 'tests_tagged', 'commits_formatted']
    });

    const validationResults = [
      { rule: 'tags_present', passed: false, message: 'Missing req_id' },
      { rule: 'tests_tagged', passed: false, message: 'Some test results missing test_id' },
      { rule: 'commits_formatted', passed: false, message: 'Bad format' },
      { rule: 'refs_valid', passed: true }
    ];

    const result = rejectWithFeedback(att.id, validationResults);
    const parsed = JSON.parse(result.rejection_reason);

    // All 3 failed checks should have suggestions
    expect(parsed.checks_failed).toHaveLength(3);
    for (const check of parsed.checks_failed) {
      expect(check.suggestion).toBeTruthy();
      expect(typeof check.suggestion).toBe('string');
    }

    expect(parsed.summary).toContain('3');
    expect(parsed.summary).toContain('4');
  });

  it('generates correct summary string', async () => {
    const { rejectWithFeedback, requestAttestation } = await import('../lib/attestation.js');

    const att = requestAttestation({
      task_id: 'task-1',
      project_slug: 'test-proj',
      agent_id: 'agent-1',
      from_status: 'active',
      to_status: 'review',
      required_checks: ['tags_present']
    });

    const validationResults = [
      { rule: 'tags_present', passed: false, message: 'Missing req_id' },
      { rule: 'refs_valid', passed: true },
      { rule: 'tests_tagged', passed: true },
      { rule: 'commits_formatted', passed: true }
    ];

    const result = rejectWithFeedback(att.id, validationResults);
    const parsed = JSON.parse(result.rejection_reason);

    expect(parsed.summary).toBe('1 of 4 checks failed');
  });
});

describe('ATTESTATION_REJECTED SSE event', () => {
  it('emits ATTESTATION_REJECTED SSE event on rejection', async () => {
    const sseManager = await import('../lib/sse-manager.js');
    const sendSpy = vi.spyOn(sseManager, 'sendToAgent');

    const { rejectWithFeedback, requestAttestation } = await import('../lib/attestation.js');

    const att = requestAttestation({
      task_id: 'task-1',
      project_slug: 'test-proj',
      agent_id: 'agent-1',
      from_status: 'active',
      to_status: 'review',
      required_checks: ['tags_present']
    });

    const validationResults = [
      { rule: 'tags_present', passed: false, message: 'Missing req_id' }
    ];

    rejectWithFeedback(att.id, validationResults);

    // Should have emitted ATTESTATION_REJECTED (in addition to initial ATTESTATION_REQUIRED)
    const rejectedCall = sendSpy.mock.calls.find(
      call => call[1] === 'attestation' && call[2]?.type === 'ATTESTATION_REJECTED'
    );
    expect(rejectedCall).toBeDefined();

    const eventData = rejectedCall![2];
    expect(eventData.attestation_id).toBe(att.id);
    expect(eventData.task_id).toBe('task-1');
    expect(eventData).toHaveProperty('checks_failed');
    expect(eventData).toHaveProperty('summary');

    sendSpy.mockRestore();
  });
});

describe('Suggestion map', () => {
  it('exports suggestion map covering all 4 rules', async () => {
    const { SUGGESTION_MAP } = await import('../services/attestation-rules.js');

    expect(SUGGESTION_MAP).toBeDefined();
    expect(SUGGESTION_MAP).toHaveProperty('tags_present');
    expect(SUGGESTION_MAP).toHaveProperty('refs_valid');
    expect(SUGGESTION_MAP).toHaveProperty('tests_tagged');
    expect(SUGGESTION_MAP).toHaveProperty('commits_formatted');

    // Each suggestion should be a non-empty string
    for (const [, suggestion] of Object.entries(SUGGESTION_MAP)) {
      expect(typeof suggestion).toBe('string');
      expect((suggestion as string).length).toBeGreaterThan(0);
    }
  });
});

describe('Enhanced gate feedback', () => {
  it('returns structured rejection reason when attestation is rejected', async () => {
    const { checkAttestationGate } = await import('../services/attestation-gate.js');
    const { rejectWithFeedback, requestAttestation } = await import('../lib/attestation.js');

    // Configure attestation rule for this transition
    db.prepare(
      "INSERT OR IGNORE INTO attestation_rules (id, project_slug, from_status, to_status, rules) VALUES ('rule-1', 'test-proj', 'active', 'review', '[\"tags_present\"]')"
    ).run();

    // Create and reject an attestation
    const att = requestAttestation({
      task_id: 'task-1',
      project_slug: 'test-proj',
      agent_id: 'agent-1',
      from_status: 'active',
      to_status: 'review',
      required_checks: ['tags_present']
    });

    // Set task_slug on attestation (gate queries by task_slug)
    db.prepare("UPDATE attestations SET task_slug = 'task-1' WHERE id = ?").run(att.id);

    const validationResults = [
      { rule: 'tags_present', passed: false, message: 'Missing req_id' }
    ];

    rejectWithFeedback(att.id, validationResults);

    // Gate check should include structured reason
    const gate = checkAttestationGate('task-1', 'test-proj', 'active', 'review');
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('rejected');
    // Should include the structured details, not just generic message
    expect(gate.reason).toContain('tags_present');
  });
});
