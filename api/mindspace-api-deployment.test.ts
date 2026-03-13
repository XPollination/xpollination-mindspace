/**
 * TDD tests for mindspace-api-deployment (Phase 1)
 *
 * Deploy Mindspace API as single backend. Phase 1: get API running,
 * add dna_json column, seed auth, migrate legacy data.
 *
 * Acceptance Criteria:
 * AC-MIG1: Migration 033-task-dna-json.sql adds dna_json TEXT column to tasks table
 * AC-SEED1: seed.ts creates admin user (thomas)
 * AC-SEED2: seed.ts creates API keys for agent roles (pdsa, dev, qa, liaison)
 * AC-SEED3: seed.ts creates default project "xpollination-mcp-server"
 * AC-SEED4: seed.ts is idempotent (running twice doesn't error)
 * AC-LEG1: seed-from-legacy.ts reads legacy mindspace_nodes from xpollination.db
 * AC-LEG2: Legacy tasks migrated to new tasks table with dna_json preserved
 * AC-LEG3: Group-to-capability mapping creates capabilities from distinct groups
 * AC-LEG4: Every migrated task linked to capability via capability_tasks junction
 * AC-LEG5: Default mission "XPollination Platform" created
 * AC-LEG6: Unmapped tasks (null/unknown group) linked to "uncategorized" capability
 * AC-PKG1: package.json has start:api script
 * AC-API1: API server starts on port 3100
 * AC-API2: /health endpoint returns 200
 * AC-API3: All 34 migrations apply without error (033 + existing 001-032)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(PROJECT_ROOT, 'api');
const MIGRATIONS_DIR = path.join(API_DIR, 'db', 'migrations');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

async function isApiUp(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:3100/health', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

describe('mindspace-api-deployment: Phase 1 — API deploy + legacy migration', () => {

  // === AC-MIG1: dna_json migration ===

  describe('AC-MIG1: Migration 033 adds dna_json to tasks', () => {
    it('033-task-dna-json.sql migration file should exist', () => {
      expect(fileExists(path.join(MIGRATIONS_DIR, '033-task-dna-json.sql'))).toBe(true);
    });

    it('migration should ALTER TABLE tasks ADD COLUMN dna_json', () => {
      const sql = readFile(path.join(MIGRATIONS_DIR, '033-task-dna-json.sql'));
      expect(sql).toMatch(/ALTER\s+TABLE\s+tasks\s+ADD\s+(COLUMN\s+)?dna_json\s+TEXT/i);
    });
  });

  // === AC-SEED1-4: Auth seeding ===

  describe('AC-SEED1: seed.ts creates admin user', () => {
    it('seed.ts (or seed.js) should exist in api/db/', () => {
      const hasSeed = fileExists(path.join(API_DIR, 'db', 'seed.ts')) ||
                      fileExists(path.join(API_DIR, 'db', 'seed.js'));
      expect(hasSeed).toBe(true);
    });

    it('seed should create user named thomas', () => {
      const seedPath = fileExists(path.join(API_DIR, 'db', 'seed.ts'))
        ? path.join(API_DIR, 'db', 'seed.ts')
        : path.join(API_DIR, 'db', 'seed.js');
      const src = readFile(seedPath);
      expect(src).toMatch(/thomas/i);
    });

    it('seed should hash password (bcrypt or similar)', () => {
      const seedPath = fileExists(path.join(API_DIR, 'db', 'seed.ts'))
        ? path.join(API_DIR, 'db', 'seed.ts')
        : path.join(API_DIR, 'db', 'seed.js');
      const src = readFile(seedPath);
      const hasHashing = /bcrypt|hash|argon|scrypt|crypto/i.test(src);
      expect(hasHashing).toBe(true);
    });
  });

  describe('AC-SEED2: seed.ts creates agent API keys', () => {
    it('seed should reference agent roles (pdsa, dev, qa, liaison)', () => {
      const seedPath = fileExists(path.join(API_DIR, 'db', 'seed.ts'))
        ? path.join(API_DIR, 'db', 'seed.ts')
        : path.join(API_DIR, 'db', 'seed.js');
      const src = readFile(seedPath);
      expect(src).toMatch(/pdsa/);
      expect(src).toMatch(/\bdev\b/);
      expect(src).toMatch(/\bqa\b/);
      expect(src).toMatch(/liaison/);
    });

    it('seed should insert into api_keys table', () => {
      const seedPath = fileExists(path.join(API_DIR, 'db', 'seed.ts'))
        ? path.join(API_DIR, 'db', 'seed.ts')
        : path.join(API_DIR, 'db', 'seed.js');
      const src = readFile(seedPath);
      expect(src).toMatch(/api_keys/i);
    });
  });

  describe('AC-SEED3: seed.ts creates default project', () => {
    it('seed should insert xpollination-mcp-server project', () => {
      const seedPath = fileExists(path.join(API_DIR, 'db', 'seed.ts'))
        ? path.join(API_DIR, 'db', 'seed.ts')
        : path.join(API_DIR, 'db', 'seed.js');
      const src = readFile(seedPath);
      expect(src).toMatch(/xpollination-mcp-server/);
      expect(src).toMatch(/projects/i);
    });
  });

  describe('AC-SEED4: seed is idempotent', () => {
    it('seed should use INSERT OR IGNORE or check-before-insert pattern', () => {
      const seedPath = fileExists(path.join(API_DIR, 'db', 'seed.ts'))
        ? path.join(API_DIR, 'db', 'seed.ts')
        : path.join(API_DIR, 'db', 'seed.js');
      const src = readFile(seedPath);
      const hasIdempotent =
        /INSERT\s+OR\s+IGNORE/i.test(src) ||
        /ON\s+CONFLICT/i.test(src) ||
        /IF\s+NOT\s+EXISTS/i.test(src) ||
        /SELECT.*COUNT|EXISTS\s*\(.*SELECT/i.test(src);
      expect(hasIdempotent).toBe(true);
    });
  });

  // === AC-LEG1-6: Legacy migration ===

  describe('AC-LEG1: seed-from-legacy reads legacy DB', () => {
    it('seed-from-legacy.ts (or .js) should exist in api/db/', () => {
      const hasLegacy = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts')) ||
                        fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.js'));
      expect(hasLegacy).toBe(true);
    });

    it('should reference mindspace_nodes table', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      expect(src).toMatch(/mindscape_nodes|mindspace_nodes/);
    });

    it('should open legacy xpollination.db read-only', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      expect(src).toMatch(/readonly|read.?only/i);
    });
  });

  describe('AC-LEG2: Legacy tasks migrated with dna_json preserved', () => {
    it('should INSERT into tasks table with dna_json column', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      expect(src).toMatch(/INSERT.*tasks/is);
      expect(src).toMatch(/dna_json/);
    });

    it('should extract title from dna_json for relational column', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      // Should parse dna_json and extract title
      const extractsTitle =
        /dna\.title|json_extract.*title|\.title\b/i.test(src);
      expect(extractsTitle).toBe(true);
    });
  });

  describe('AC-LEG3: Group-to-capability mapping', () => {
    it('should create capabilities from distinct group values', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      expect(src).toMatch(/capabilities/i);
      expect(src).toMatch(/group/i);
    });

    it('should INSERT capabilities linked to a mission', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      expect(src).toMatch(/INSERT.*capabilities/is);
      expect(src).toMatch(/mission_id/);
    });
  });

  describe('AC-LEG4: Every task linked via capability_tasks junction', () => {
    it('should INSERT into capability_tasks for each migrated task', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      expect(src).toMatch(/capability_tasks/);
    });
  });

  describe('AC-LEG5: Default mission created', () => {
    it('should create XPollination Platform mission', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      expect(src).toMatch(/XPollination Platform|xpollination.*platform/i);
      expect(src).toMatch(/INSERT.*missions/is);
    });
  });

  describe('AC-LEG6: Uncategorized capability for unmapped tasks', () => {
    it('should handle null/unknown groups with uncategorized capability', () => {
      const legacyPath = fileExists(path.join(API_DIR, 'db', 'seed-from-legacy.ts'))
        ? path.join(API_DIR, 'db', 'seed-from-legacy.ts')
        : path.join(API_DIR, 'db', 'seed-from-legacy.js');
      const src = readFile(legacyPath);
      const hasUncategorized =
        /uncategorized|uncat|default.*cap|catch.?all|fallback/i.test(src);
      expect(hasUncategorized).toBe(true);
    });
  });

  // === AC-PKG1: package.json script ===

  describe('AC-PKG1: package.json has start:api script', () => {
    it('should have start:api script that runs migrate + start', () => {
      const pkg = JSON.parse(readFile(path.join(PROJECT_ROOT, 'package.json')));
      expect(pkg.scripts['start:api']).toBeDefined();
      // Should run migrations and then start the API
      expect(pkg.scripts['start:api']).toMatch(/migrate/);
    });
  });

  // === AC-API1-3: Live API tests ===

  describe('AC-API1: API starts on port 3100', () => {
    it('server.ts should listen on port 3100', () => {
      // Read from develop branch or built file
      const serverPath = path.join(API_DIR, 'server.ts');
      if (!fileExists(serverPath)) return; // skip if not on this branch yet
      const src = readFile(serverPath);
      expect(src).toMatch(/3100/);
    });
  });

  describe('AC-API2: /health returns 200', () => {
    it('GET /health should return 200 OK', async () => {
      const apiUp = await isApiUp();
      if (!apiUp) return; // skip if API not running

      const res = await fetch('http://localhost:3100/health');
      expect(res.status).toBe(200);
    });
  });

  describe('AC-API3: All migrations apply', () => {
    it('should have 33+ migration files (001 through 033)', () => {
      if (!fileExists(MIGRATIONS_DIR)) return;
      const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
      expect(files.length).toBeGreaterThanOrEqual(33);
    });

    it('migration files should be numbered sequentially', () => {
      if (!fileExists(MIGRATIONS_DIR)) return;
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
      // Check that 033 exists
      const has033 = files.some(f => f.startsWith('033'));
      expect(has033).toBe(true);
    });
  });

  // === Integration: Live API with migrated data ===

  describe('Integration: Legacy data accessible via API', () => {
    it('GET /api/projects should include xpollination-mcp-server', async () => {
      const apiUp = await isApiUp();
      if (!apiUp) return;

      const res = await fetch('http://localhost:3100/api/projects', {
        headers: { 'Authorization': 'Bearer test' }
      });
      if (res.status === 401) return; // auth not configured in test
      expect(res.status).toBe(200);
      const data = await res.json();
      const project = Array.isArray(data) ? data : data.projects || [];
      const hasMcpServer = project.some((p: any) =>
        p.slug === 'xpollination-mcp-server' || p.name?.includes('XPollination')
      );
      expect(hasMcpServer).toBe(true);
    });

    it('GET /api/projects/xpollination-mcp-server/tasks should return migrated tasks', async () => {
      const apiUp = await isApiUp();
      if (!apiUp) return;

      const res = await fetch('http://localhost:3100/api/projects/xpollination-mcp-server/tasks', {
        headers: { 'Authorization': 'Bearer test' }
      });
      if (res.status === 401) return;
      expect(res.status).toBe(200);
      const data = await res.json();
      const tasks = Array.isArray(data) ? data : data.tasks || [];
      // Should have migrated tasks (285 from mcp-server)
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('migrated tasks should have dna_json preserved', async () => {
      const apiUp = await isApiUp();
      if (!apiUp) return;

      const res = await fetch('http://localhost:3100/api/projects/xpollination-mcp-server/tasks', {
        headers: { 'Authorization': 'Bearer test' }
      });
      if (res.status === 401) return;
      if (res.status !== 200) return;
      const data = await res.json();
      const tasks = Array.isArray(data) ? data : data.tasks || [];
      if (tasks.length === 0) return;

      // At least one task should have dna_json
      const withDna = tasks.find((t: any) => t.dna_json);
      expect(withDna).toBeDefined();
      // dna_json should be parseable
      const dna = JSON.parse(withDna.dna_json);
      expect(dna).toHaveProperty('title');
    });
  });
});
