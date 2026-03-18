import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Populate Requirements Tests — graph-populate-requirements
 * Validates: Migration 049 seeds 15 requirements across 9 capabilities.
 * TDD: Dev creates 049-populate-requirements.sql to pass them.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 049: 15 requirements from PLATFORM-001', () => {

  it('exactly 15 new requirements exist', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE project_slug = 'mindspace' AND created_by = 'system'").get() as any;
    expect(count.c).toBe(15);
  });

  const REQS = [
    { id: 'req-auth-001', human: 'REQ-AUTH-001', cap: 'cap-auth', priority: 'high' },
    { id: 'req-auth-002', human: 'REQ-AUTH-002', cap: 'cap-auth', priority: 'medium' },
    { id: 'req-wf-001', human: 'REQ-WF-001', cap: 'cap-task-engine', priority: 'critical' },
    { id: 'req-wf-002', human: 'REQ-WF-002', cap: 'cap-task-engine', priority: 'high' },
    { id: 'req-a2a-001', human: 'REQ-A2A-001', cap: 'cap-agent-protocol', priority: 'critical' },
    { id: 'req-a2a-002', human: 'REQ-A2A-002', cap: 'cap-agent-protocol', priority: 'high' },
    { id: 'req-infra-001', human: 'REQ-INFRA-001', cap: 'cap-foundation', priority: 'critical' },
    { id: 'req-infra-002', human: 'REQ-INFRA-002', cap: 'cap-foundation', priority: 'medium' },
    { id: 'req-qa-001', human: 'REQ-QA-001', cap: 'cap-quality', priority: 'high' },
    { id: 'req-graph-001', human: 'REQ-GRAPH-001', cap: 'cap-graph', priority: 'high' },
    { id: 'req-graph-002', human: 'REQ-GRAPH-002', cap: 'cap-graph', priority: 'high' },
    { id: 'req-viz-001', human: 'REQ-VIZ-001', cap: 'cap-viz', priority: 'high' },
    { id: 'req-viz-002', human: 'REQ-VIZ-002', cap: 'cap-viz', priority: 'high' },
    { id: 'req-prov-001', human: 'REQ-PROV-001', cap: 'cap-provenance', priority: 'medium' },
    { id: 'req-token-001', human: 'REQ-TOKEN-001', cap: 'cap-token', priority: 'low' },
  ];

  for (const req of REQS) {
    it(`${req.human} exists with correct capability and priority`, () => {
      const row = db.prepare("SELECT * FROM requirements WHERE id = ?").get(req.id) as any;
      expect(row).toBeDefined();
      expect(row.req_id_human).toBe(req.human);
      expect(row.capability_id).toBe(req.cap);
      expect(row.priority).toBe(req.priority);
      expect(row.project_slug).toBe('mindspace');
      expect(row.created_by).toBe('system');
      expect(row.status).toBe('active');
      expect(row.description).toBeTruthy();
    });
  }
});

describe('Capability coverage', () => {

  const CAPS = [
    'cap-auth', 'cap-task-engine', 'cap-agent-protocol', 'cap-foundation',
    'cap-quality', 'cap-graph', 'cap-viz', 'cap-provenance', 'cap-token'
  ];

  for (const cap of CAPS) {
    it(`${cap} has at least 1 requirement`, () => {
      const count = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE capability_id = ?").get(cap) as any;
      expect(count.c).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('FK integrity', () => {

  it('all requirements reference existing project mindspace', () => {
    const proj = db.prepare("SELECT * FROM projects WHERE slug = 'mindspace'").get() as any;
    expect(proj).toBeDefined();
  });

  it('all requirements reference existing user system', () => {
    const user = db.prepare("SELECT * FROM users WHERE id = 'system'").get() as any;
    expect(user).toBeDefined();
  });
});

describe('Idempotency', () => {

  it('re-inserting requirements with INSERT OR IGNORE does not error', () => {
    const fn = () => db.prepare(
      "INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id) VALUES ('req-auth-001', 'mindspace', 'REQ-AUTH-001', 'User Login', 'test', 'active', 'high', 'system', 'cap-auth')"
    ).run();
    expect(fn).not.toThrow();
  });

  it('count stays at 15 after duplicate insert', () => {
    db.prepare("INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id) VALUES ('req-auth-001', 'mindspace', 'REQ-AUTH-001', 'User Login', 'test', 'active', 'high', 'system', 'cap-auth')").run();
    const count = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE project_slug = 'mindspace' AND created_by = 'system'").get() as any;
    expect(count.c).toBe(15);
  });
});

describe('Migration file exists', () => {

  it('049-populate-requirements.sql is present in migrations directory', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    expect(files).toContain('049-populate-requirements.sql');
  });
});
