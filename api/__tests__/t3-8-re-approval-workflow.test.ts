/**
 * TDD tests for t3-8-re-approval-workflow
 * Re-approval workflow: suspect link creation triggers re-approval request,
 * approval clears suspect link.
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

  // Seed: user, project, agent
  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'Test Agent', 'active')").run();

  // Suspect link
  db.prepare("INSERT INTO suspect_links (id, project_slug, source_type, source_ref, target_type, target_ref, reason, status) VALUES ('sl-1', 'test-proj', 'test', 'test-1', 'requirement', 'req-1', 'test changed', 'suspect')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('Re-approval request creation', () => {
  it('createReApprovalRequest() creates an approval_request linked to suspect', async () => {
    const { createReApprovalRequest } = await import('../services/re-approval.js');

    const approval = createReApprovalRequest(db, {
      project_slug: 'test-proj',
      suspect_link_id: 'sl-1',
      reason: 'test changed invalidating requirement verification',
      requested_by: 'user-1'
    });

    expect(approval).toBeDefined();
    expect(approval.id).toBeDefined();
    expect(approval.suspect_link_id).toBe('sl-1');
    expect(approval.type).toBe('re_approval');
  });

  it('emits RE_APPROVAL_NEEDED SSE event', async () => {
    const sseManager = await import('../lib/sse-manager.js');
    const sendSpy = vi.spyOn(sseManager, 'broadcast');

    const { createReApprovalRequest } = await import('../services/re-approval.js');

    createReApprovalRequest(db, {
      project_slug: 'test-proj',
      suspect_link_id: 'sl-1',
      reason: 'test change',
      requested_by: 'user-1'
    });

    const sseCall = sendSpy.mock.calls.find(
      call => call[0]?.type === 'RE_APPROVAL_NEEDED'
    );
    expect(sseCall).toBeDefined();

    sendSpy.mockRestore();
  });
});

describe('Approval clears suspect link', () => {
  it('approving a re-approval request resolves the linked suspect link', async () => {
    const { approveReApproval } = await import('../services/re-approval.js');

    // Create a fresh suspect + approval
    db.prepare("INSERT INTO suspect_links (id, project_slug, source_type, source_ref, target_type, target_ref, reason, status) VALUES ('sl-approve', 'test-proj', 'test', 'test-2', 'requirement', 'req-2', 'test changed', 'suspect')").run();

    const { createReApprovalRequest } = await import('../services/re-approval.js');
    const approval = createReApprovalRequest(db, {
      project_slug: 'test-proj',
      suspect_link_id: 'sl-approve',
      reason: 'test change',
      requested_by: 'user-1'
    });

    approveReApproval(db, approval.id, 'user-1');

    const suspect = db.prepare("SELECT status FROM suspect_links WHERE id = 'sl-approve'").get() as any;
    expect(suspect.status).toBe('cleared');
  });
});
