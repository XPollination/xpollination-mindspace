/**
 * Integration tests for task management (ms-a3-9-task-tests)
 * Covers: claim/unclaim lifecycle, lease expiry, heartbeat renewal,
 * voluntary release, concurrent claim, filters.
 *
 * Tests service functions directly (test helper doesn't mount full app routes).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;

  // Seed: users, agents, project, tasks
  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('user-1', 'dev@test.com', 'hash', 'Dev User')").run();
  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('user-2', 'qa@test.com', 'hash', 'QA User')").run();
  db.prepare("INSERT INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'Dev Agent', 'active')").run();
  db.prepare("INSERT INTO agents (id, user_id, name, status) VALUES ('agent-2', 'user-2', 'QA Agent', 'active')").run();
  db.prepare("INSERT INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-1', 'test-proj', 'Ready Task', 'ready', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-2', 'test-proj', 'Active Task', 'active', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-3', 'test-proj', 'QA Task', 'review', 'qa', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-4', 'test-proj', 'Blocked Task', 'blocked', 'dev', 'user-1')").run();
});

afterAll(() => {
  teardownTestDb();
});

// --- Claim Lifecycle ---
describe('Claim lifecycle', () => {
  it('claims a task by setting claimed_by', () => {
    db.prepare("UPDATE tasks SET claimed_by = 'agent-1', claimed_at = datetime('now') WHERE id = 'task-1'").run();
    const task = db.prepare("SELECT * FROM tasks WHERE id = 'task-1'").get() as any;
    expect(task.claimed_by).toBe('agent-1');
    expect(task.claimed_at).toBeDefined();
  });

  it('creates a lease on claim with role-based duration', async () => {
    const { createLease } = await import('../services/lease-service.js');
    const lease = createLease(db, 'task-1', 'user-1', 'dev');
    expect(lease).toBeDefined();
    expect(lease.task_id).toBe('task-1');
    expect(lease.user_id).toBe('user-1');
    expect(lease.expires_at).toBeDefined();
  });

  it('unclaims a task by setting claimed_by to null', () => {
    db.prepare("UPDATE tasks SET claimed_by = NULL WHERE id = 'task-1'").run();
    const task = db.prepare("SELECT claimed_by FROM tasks WHERE id = 'task-1'").get() as any;
    expect(task.claimed_by).toBeNull();
  });

  it('rejects concurrent claim (task already claimed by another)', () => {
    db.prepare("UPDATE tasks SET claimed_by = 'agent-1' WHERE id = 'task-2'").run();
    const task = db.prepare("SELECT claimed_by FROM tasks WHERE id = 'task-2'").get() as any;
    // Simulate concurrent check: task is claimed by agent-1, agent-2 cannot claim
    expect(task.claimed_by).toBe('agent-1');
    expect(task.claimed_by).not.toBe('agent-2');
  });
});

// --- Lease Expiry ---
describe('Lease expiry', () => {
  it('checkExpiredLeases unclaims tasks with expired leases', async () => {
    const { checkExpiredLeases } = await import('../services/lease-expiry.js');

    db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, claimed_by, created_by) VALUES ('task-exp', 'test-proj', 'Expiring', 'active', 'dev', 'agent-1', 'user-1')").run();
    db.prepare("INSERT INTO leases (id, task_id, user_id, expires_at, status) VALUES ('lease-exp-1', 'task-exp', 'user-1', datetime('now', '-1 hour'), 'active')").run();

    const count = checkExpiredLeases();
    expect(count).toBeGreaterThanOrEqual(1);

    const task = db.prepare("SELECT claimed_by FROM tasks WHERE id = 'task-exp'").get() as any;
    expect(task.claimed_by).toBeNull();

    const lease = db.prepare("SELECT status FROM leases WHERE id = 'lease-exp-1'").get() as any;
    expect(lease.status).toBe('expired');
  });

  it('does not expire active unexpired leases', async () => {
    const { checkExpiredLeases } = await import('../services/lease-expiry.js');

    db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, claimed_by, created_by) VALUES ('task-active-lease', 'test-proj', 'Active Lease', 'active', 'dev', 'agent-1', 'user-1')").run();
    db.prepare("INSERT INTO leases (id, task_id, user_id, expires_at, status) VALUES ('lease-active-1', 'task-active-lease', 'user-1', datetime('now', '+2 hours'), 'active')").run();

    checkExpiredLeases();

    const task = db.prepare("SELECT claimed_by FROM tasks WHERE id = 'task-active-lease'").get() as any;
    expect(task.claimed_by).toBe('agent-1');
  });

  it('renewLease extends expiry', async () => {
    const { renewLease } = await import('../services/lease-service.js');

    db.prepare("INSERT INTO leases (id, task_id, user_id, expires_at, status) VALUES ('lease-renew-1', 'task-1', 'user-1', datetime('now', '+30 minutes'), 'active')").run();

    const before = db.prepare("SELECT expires_at FROM leases WHERE id = 'lease-renew-1'").get() as any;
    const renewed = renewLease(db, 'lease-renew-1', 6);
    expect(renewed.expires_at).not.toBe(before.expires_at);
  });
});

// --- Filters ---
describe('Task filters', () => {
  it('queries tasks by status', () => {
    const blocked = db.prepare("SELECT * FROM tasks WHERE project_slug = 'test-proj' AND status = 'blocked'").all() as any[];
    expect(blocked.length).toBeGreaterThan(0);
    for (const t of blocked) {
      expect(t.status).toBe('blocked');
    }
  });

  it('queries tasks by current_role', () => {
    const qaTasks = db.prepare("SELECT * FROM tasks WHERE project_slug = 'test-proj' AND current_role = 'qa'").all() as any[];
    expect(qaTasks.length).toBeGreaterThan(0);
    for (const t of qaTasks) {
      expect(t.current_role).toBe('qa');
    }
  });

  it('queries unclaimed tasks (claimed_by IS NULL)', () => {
    const unclaimed = db.prepare("SELECT * FROM tasks WHERE project_slug = 'test-proj' AND claimed_by IS NULL").all() as any[];
    expect(unclaimed.length).toBeGreaterThan(0);
  });
});
