/**
 * TDD tests for ms-a0-2-sqlite-setup
 *
 * Verifies SQLite database setup + connection pool:
 * - api/db/connection.ts exists with getDb() and closeDb()
 * - Singleton pattern: getDb() returns same instance
 * - Re-initialization: closeDb() + getDb() creates new instance
 * - WAL mode enabled
 * - Foreign keys enabled
 * - migrations table created with correct schema
 * - Health endpoint returns database status
 * - Graceful shutdown handlers registered
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/connection.ts with getDb() and closeDb() exports
 * - better-sqlite3 singleton, DATABASE_PATH env (default ./data/mindspace.db)
 * - Enable WAL mode and foreign_keys ON
 * - Create migrations table: id, name (UNIQUE), executed_at, checksum
 * - Modify api/server.ts: import getDb/closeDb, init on startup, SIGTERM/SIGINT handlers
 * - Modify api/routes/health.ts: add database connectivity check, return database field
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Test 1: connection.ts file exists ---
describe("ms-a0-2-sqlite-setup: file structure", () => {
  it("api/db/connection.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "db/connection.ts"))).toBe(true);
  });
});

// --- Test 2-9: connection.ts source code verification ---
describe("ms-a0-2-sqlite-setup: connection module", () => {
  let content: string;

  try {
    content = readFileSync(resolve(API_DIR, "db/connection.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports getDb function", () => {
    expect(content).toMatch(/export\s+(function\s+getDb|{[^}]*getDb)/);
  });

  it("exports closeDb function", () => {
    expect(content).toMatch(/export\s+(function\s+closeDb|{[^}]*closeDb)/);
  });

  it("uses better-sqlite3", () => {
    expect(content).toMatch(/['"]better-sqlite3['"]/);
  });

  it("enables WAL mode", () => {
    expect(content).toMatch(/pragma.*journal_mode.*=.*WAL/i);
  });

  it("enables foreign keys", () => {
    expect(content).toMatch(/pragma.*foreign_keys.*=.*ON/i);
  });

  it("reads DATABASE_PATH from env with default", () => {
    expect(content).toMatch(/DATABASE_PATH/);
    expect(content).toMatch(/mindspace\.db/);
  });

  it("implements singleton pattern (checks for existing instance)", () => {
    expect(content).toMatch(/if\s*\(\s*db\s*\)/);
  });

  it("creates migrations table with correct columns", () => {
    expect(content).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+migrations/i);
    expect(content).toMatch(/name\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
    expect(content).toMatch(/executed_at\s+TEXT/i);
    expect(content).toMatch(/checksum\s+TEXT/i);
  });

  it("closeDb sets instance to null for re-initialization", () => {
    expect(content).toMatch(/db\s*=\s*null/);
  });
});

// --- Test 10: server.ts integrates database ---
describe("ms-a0-2-sqlite-setup: server integration", () => {
  let content: string;

  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports getDb and closeDb from connection module", () => {
    expect(content).toMatch(/import.*getDb.*from/);
    expect(content).toMatch(/import.*closeDb.*from/);
  });

  it("calls getDb() on startup", () => {
    expect(content).toMatch(/getDb\(\)/);
  });

  it("registers SIGTERM handler", () => {
    expect(content).toMatch(/process\.on\s*\(\s*['"]SIGTERM['"]/);
  });

  it("registers SIGINT handler", () => {
    expect(content).toMatch(/process\.on\s*\(\s*['"]SIGINT['"]/);
  });

  it("calls closeDb() in shutdown handlers", () => {
    expect(content).toMatch(/closeDb\(\)/);
  });
});

// --- Test 11: health.ts includes database status ---
describe("ms-a0-2-sqlite-setup: health endpoint", () => {
  let content: string;

  try {
    content = readFileSync(resolve(API_DIR, "routes/health.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports getDb from connection module", () => {
    expect(content).toMatch(/import.*getDb.*from/);
  });

  it("includes database field in response", () => {
    expect(content).toMatch(/database/);
  });

  it("returns degraded status when database is unhealthy", () => {
    expect(content).toMatch(/degraded/);
  });

  it("uses SELECT 1 or similar for DB health check", () => {
    expect(content).toMatch(/SELECT\s+1/i);
  });
});
