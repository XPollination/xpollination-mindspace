/**
 * TDD tests for ms-a0-7-migrations
 *
 * Verifies SQL file-based database migration framework:
 * - api/db/migrate.ts migration runner
 * - api/db/migrations/ directory for .sql files
 * - Numeric prefix ordering
 * - SHA-256 checksum tracking in migrations table
 * - Transaction per migration
 * - npm run api:migrate script
 * - Checksum mismatch detection for modified migrations
 * - Does NOT auto-run on server start
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrate.ts with runMigrations export
 * - Create api/db/migrations/ directory (initially empty or with 001_init.sql)
 * - Migration runner: reads .sql files, sorts by numeric prefix, applies in order
 * - Track in migrations table: name, checksum (SHA-256), applied_at
 * - Transaction per migration (BEGIN/COMMIT per file)
 * - Detect modified migrations: compare stored checksum vs file checksum
 * - Add "api:migrate" script to package.json
 * - Do NOT call runMigrations in api/server.ts (explicit only via npm script)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a0-7-migrations: file structure", () => {
  it("api/db/migrate.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrate.ts"))).toBe(true);
  });

  it("api/db/migrations/ directory exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations"))).toBe(true);
  });
});

// --- Migration runner ---
describe("ms-a0-7-migrations: migrate.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrate.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports runMigrations function", () => {
    expect(content).toMatch(/export\s+(async\s+)?function\s+runMigrations|export\s+(const|let)\s+runMigrations/);
  });

  it("reads .sql files from migrations directory", () => {
    expect(content).toMatch(/\.sql/);
    expect(content).toMatch(/readdir|readdirSync|glob/);
  });

  it("sorts migrations by numeric prefix", () => {
    expect(content).toMatch(/sort/);
  });

  it("uses SHA-256 for checksum", () => {
    expect(content).toMatch(/sha256|SHA-256|sha-256/i);
  });

  it("creates migrations tracking table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*migrations/i);
  });

  it("tracks migration name in table", () => {
    expect(content).toMatch(/name|filename/i);
  });

  it("tracks checksum in migrations table", () => {
    expect(content).toMatch(/checksum/i);
  });

  it("tracks applied_at timestamp", () => {
    expect(content).toMatch(/applied_at|applied/i);
  });

  it("uses transactions per migration", () => {
    expect(content).toMatch(/BEGIN|transaction/i);
  });

  it("detects checksum mismatch for modified migrations", () => {
    // Should error or warn when a previously applied migration has a different checksum
    expect(content).toMatch(/mismatch|modified|changed|tampered/i);
  });

  it("reads SQL file content for execution", () => {
    expect(content).toMatch(/readFile|readFileSync/);
  });

  it("executes SQL content against database", () => {
    expect(content).toMatch(/exec|run|prepare/);
  });
});

// --- Package.json script ---
describe("ms-a0-7-migrations: package.json", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }

  it("has api:migrate script", () => {
    expect(pkg.scripts?.["api:migrate"]).toBeDefined();
  });

  it("api:migrate references migrate", () => {
    expect(pkg.scripts?.["api:migrate"]).toMatch(/migrate/);
  });
});

// --- Server integration (negative test) ---
describe("ms-a0-7-migrations: server does NOT auto-run migrations", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("server.ts does NOT import runMigrations", () => {
    expect(content).not.toMatch(/import.*runMigrations.*from/);
  });

  it("server.ts does NOT call runMigrations", () => {
    expect(content).not.toMatch(/runMigrations\s*\(/);
  });
});
