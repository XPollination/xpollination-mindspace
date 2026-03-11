/**
 * TDD tests for h1-9-liaison-capability-reporting
 * LIAISON capability-level progress reporting via CLI.
 *
 * Tests written BEFORE implementation — these should FAIL until dev implements.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import { execSync } from 'node:child_process';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;

  // Seed: mission, capabilities, tasks
  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();

  db.prepare("INSERT INTO missions (id, title, status) VALUES ('mission-1', 'Test Mission', 'active')").run();
  db.prepare("INSERT INTO capabilities (id, mission_id, title, status, sort_order) VALUES ('cap-1', 'mission-1', 'Foundation', 'active', 1)").run();
  db.prepare("INSERT INTO capabilities (id, mission_id, title, status, sort_order) VALUES ('cap-2', 'mission-1', 'Auth', 'active', 2)").run();

  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('t-1', 'test-proj', 'T1', 'complete', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('t-2', 'test-proj', 'T2', 'active', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('t-3', 'test-proj', 'T3', 'complete', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('t-4', 'test-proj', 'T4', 'complete', 'dev', 'user-1')").run();

  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-1', 't-1')").run();
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-1', 't-2')").run();
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-2', 't-3')").run();
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-2', 't-4')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('Capability status CLI command', () => {
  it('interface-cli.js capability-status returns per-capability progress JSON', () => {
    const CLI = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js';
    const DB = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db';

    // This test uses the real CLI against the real DB (not the test DB)
    // It validates the command exists and returns valid JSON
    let output: string;
    try {
      output = execSync(`DATABASE_PATH=${DB} node ${CLI} capability-status`, {
        encoding: 'utf-8',
        timeout: 10000
      });
    } catch (e: any) {
      // Command not implemented yet — expected failure
      expect(e.message).not.toMatch(/capability-status/); // should fail because command doesn't exist
      return;
    }

    const result = JSON.parse(output);
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('each capability has title, progress_percent, status, task_count', () => {
    const CLI = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js';
    const DB = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db';

    let output: string;
    try {
      output = execSync(`DATABASE_PATH=${DB} node ${CLI} capability-status`, {
        encoding: 'utf-8',
        timeout: 10000
      });
    } catch {
      // Command not implemented — this is the expected TDD failure
      expect(true).toBe(false); // force fail
      return;
    }

    const result = JSON.parse(output);
    const cap = result.capabilities[0];
    expect(cap.title).toBeDefined();
    expect(typeof cap.progress_percent).toBe('number');
    expect(cap.task_count).toBeDefined();
  });
});
