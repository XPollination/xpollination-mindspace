/**
 * TDD tests for ms-a11-7-lease-notifications
 * LEASE_WARNING + LEASE_EXPIRED SSE notifications.
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

  // Seed: user, project, agent, task
  db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT OR IGNORE INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT OR IGNORE INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'Test Agent', 'active')").run();
  db.prepare("INSERT OR IGNORE INTO tasks (id, project_slug, title, status, current_role, claimed_by, created_by) VALUES ('task-1', 'test-proj', 'Test Task', 'active', 'dev', 'agent-1', 'user-1')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('LEASE_WARNING notification', () => {
  it('sends LEASE_WARNING SSE 30min before expiry', async () => {
    const sseManager = await import('../lib/sse-manager.js');
    const sendSpy = vi.spyOn(sseManager, 'sendToAgent');

    const { checkExpiredLeases } = await import('../services/lease-expiry.js');

    // Create a lease expiring in 25 minutes (within 30-min warning window)
    db.prepare(
      "INSERT INTO leases (id, task_id, user_id, expires_at, status) VALUES ('lease-warn', 'task-1', 'user-1', datetime('now', '+25 minutes'), 'active')"
    ).run();

    checkExpiredLeases();

    // Should have sent LEASE_WARNING
    const warningCall = sendSpy.mock.calls.find(
      call => call[2]?.type === 'LEASE_WARNING'
    );
    expect(warningCall).toBeDefined();
    expect(warningCall![2].task_id).toBe('task-1');

    sendSpy.mockRestore();
  });

  it('does not send duplicate LEASE_WARNING (warning_sent flag)', async () => {
    const sseManager = await import('../lib/sse-manager.js');
    const sendSpy = vi.spyOn(sseManager, 'sendToAgent');

    const { checkExpiredLeases } = await import('../services/lease-expiry.js');

    // Create lease with warning_sent already set
    db.prepare(
      "INSERT INTO leases (id, task_id, user_id, expires_at, status, warning_sent) VALUES ('lease-nowarn', 'task-1', 'user-1', datetime('now', '+20 minutes'), 'active', 1)"
    ).run();

    checkExpiredLeases();

    // Should NOT send another warning for this lease
    const warningCalls = sendSpy.mock.calls.filter(
      call => call[2]?.type === 'LEASE_WARNING' && call[2]?.lease_id === 'lease-nowarn'
    );
    expect(warningCalls.length).toBe(0);

    sendSpy.mockRestore();
  });
});

describe('LEASE_EXPIRED notification', () => {
  it('sends LEASE_EXPIRED SSE when lease expires', async () => {
    const sseManager = await import('../lib/sse-manager.js');
    const sendSpy = vi.spyOn(sseManager, 'sendToAgent');

    const { checkExpiredLeases } = await import('../services/lease-expiry.js');

    // Create an already-expired lease
    db.prepare(
      "INSERT INTO leases (id, task_id, user_id, expires_at, status) VALUES ('lease-exp-notify', 'task-1', 'user-1', datetime('now', '-5 minutes'), 'active')"
    ).run();

    checkExpiredLeases();

    // Should have sent LEASE_EXPIRED
    const expiredCall = sendSpy.mock.calls.find(
      call => call[2]?.type === 'LEASE_EXPIRED'
    );
    expect(expiredCall).toBeDefined();
    expect(expiredCall![2].task_id).toBe('task-1');

    sendSpy.mockRestore();
  });
});

describe('Heartbeat resets warning_sent', () => {
  it('clears warning_sent flag when lease is renewed via heartbeat', async () => {
    const { renewLease } = await import('../services/lease-service.js');

    // Create lease with warning_sent=1
    db.prepare(
      "INSERT INTO leases (id, task_id, user_id, expires_at, status, warning_sent) VALUES ('lease-reset', 'task-1', 'user-1', datetime('now', '+1 hour'), 'active', 1)"
    ).run();

    renewLease(db, 'lease-reset', 4);

    const lease = db.prepare("SELECT warning_sent FROM leases WHERE id = 'lease-reset'").get() as any;
    expect(lease.warning_sent).toBe(0);
  });
});
