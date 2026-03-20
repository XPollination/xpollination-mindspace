import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Requirement Content Enrichment Tests — requirement-content-enrichment
 * Validates: Migration 056 populates content_md with 9-section template for all requirements.
 * TDD: Dev creates 056-requirement-content-enrichment.sql.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

const SECTIONS = [
  'Statement', 'Rationale', 'Scope',
  'Acceptance Criteria', 'Behavior',
  'Constraints', 'Dependencies', 'Verification', 'Impact'
];

describe('All 15 requirements have enriched content_md', () => {

  it('all 15 mindspace requirements have non-empty content_md', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE project_slug = 'mindspace' AND content_md IS NOT NULL AND length(content_md) > 100").get() as any;
    expect(count.c).toBe(15);
  });

  it('content_md contains all 9 section headings', () => {
    const reqs = db.prepare("SELECT id, content_md FROM requirements WHERE project_slug = 'mindspace' AND content_md IS NOT NULL").all() as any[];
    for (const req of reqs) {
      for (const section of SECTIONS) {
        expect(req.content_md.toLowerCase(), `${req.id} missing section "${section}"`).toContain(section.toLowerCase());
      }
    }
  });
});

describe('Content version updated', () => {

  it('all requirements have content_version >= 2 after enrichment', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE project_slug = 'mindspace' AND content_version >= 2").get() as any;
    // After seed (v1) + enrichment (v2)
    expect(count.c).toBe(15);
  });
});

describe('Migration file exists', () => {

  it('056-requirement-content-enrichment.sql is present', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    expect(files).toContain('056-requirement-content-enrichment.sql');
  });
});
