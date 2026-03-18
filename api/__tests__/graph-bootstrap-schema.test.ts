import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Bootstrap Seed Tests — graph-bootstrap-schema
 * Validates: Migration 046 seeds system user + mindscape project for FK deps.
 * TDD: These tests define the spec. Dev creates 046-bootstrap-seed.sql to pass them.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 046: Bootstrap seed data', () => {

  it('system user exists in users table', () => {
    const user = db.prepare("SELECT * FROM users WHERE id = 'system'").get() as any;
    expect(user).toBeDefined();
    expect(user.id).toBe('system');
    expect(user.email).toBe('system@mindspace.local');
    expect(user.name).toBe('System');
    expect(user.password_hash).toBe('nologin');
  });

  it('mindspace project exists in projects table', () => {
    const project = db.prepare("SELECT * FROM projects WHERE slug = 'mindspace'").get() as any;
    expect(project).toBeDefined();
    expect(project.id).toBe('proj-mindspace');
    expect(project.slug).toBe('mindspace');
    expect(project.name).toBe('Mindspace');
    expect(project.created_by).toBe('system');
  });

  it('mindspace project FK references system user', () => {
    const project = db.prepare("SELECT p.*, u.name as user_name FROM projects p JOIN users u ON p.created_by = u.id WHERE p.slug = 'mindspace'").get() as any;
    expect(project).toBeDefined();
    expect(project.user_name).toBe('System');
  });
});

describe('FK constraints satisfied for hierarchy inserts', () => {

  it('can insert a requirement referencing mindspace project and system user', () => {
    const fn = () => db.prepare(
      "INSERT INTO requirements (id, project_slug, req_id_human, title, created_by) VALUES ('req-test-bootstrap', 'mindspace', 'REQ-BOOT-TEST', 'Bootstrap test requirement', 'system')"
    ).run();
    expect(fn).not.toThrow();

    const req = db.prepare("SELECT * FROM requirements WHERE id = 'req-test-bootstrap'").get() as any;
    expect(req.project_slug).toBe('mindspace');
    expect(req.created_by).toBe('system');
  });
});

describe('Idempotency', () => {

  it('re-inserting system user with INSERT OR IGNORE does not error', () => {
    const fn = () => db.prepare(
      "INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('system', 'system@mindspace.local', 'nologin', 'System')"
    ).run();
    expect(fn).not.toThrow();
  });

  it('re-inserting mindspace project with INSERT OR IGNORE does not error', () => {
    const fn = () => db.prepare(
      "INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES ('proj-mindspace', 'mindspace', 'Mindspace', 'XPollination Mindspace platform', 'system')"
    ).run();
    expect(fn).not.toThrow();
  });

  it('user count stays at 1 for system after duplicate insert', () => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('system', 'system@mindspace.local', 'nologin', 'System')").run();
    const count = db.prepare("SELECT COUNT(*) as c FROM users WHERE id = 'system'").get() as any;
    expect(count.c).toBe(1);
  });

  it('project count stays at 1 for mindspace after duplicate insert', () => {
    db.prepare("INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES ('proj-mindspace', 'mindspace', 'Mindspace', 'XPollination Mindspace platform', 'system')").run();
    const count = db.prepare("SELECT COUNT(*) as c FROM projects WHERE slug = 'mindspace'").get() as any;
    expect(count.c).toBe(1);
  });
});

describe('Migration file exists', () => {

  it('046-bootstrap-seed.sql is present in migrations directory', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    expect(files).toContain('046-bootstrap-seed.sql');
  });
});
