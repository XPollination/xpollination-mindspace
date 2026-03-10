/**
 * TDD tests for ms-a2-5-seed-data
 *
 * Verifies seed data script for initial projects + admin users:
 * - api/db/seed.ts exists and is executable
 * - Seeds users table (Thomas, Robin, Maria as system admins)
 * - Seeds projects table (initial projects)
 * - Seeds project_access table (admin access for seed users)
 * - Seeds api_keys table (initial API keys)
 * - Idempotent via INSERT OR IGNORE
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/seed.ts:
 *   - Export seed() function or runnable script
 *   - INSERT OR IGNORE into users (Thomas, Robin, Maria with is_system_admin=1)
 *   - INSERT OR IGNORE into projects (initial project slugs)
 *   - INSERT OR IGNORE into project_access (admin roles)
 *   - INSERT OR IGNORE into api_keys
 *   - All inserts idempotent (safe to run multiple times)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a2-5-seed-data: file structure", () => {
  it("api/db/seed.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "db/seed.ts"))).toBe(true);
  });
});

// --- Seed script ---
describe("ms-a2-5-seed-data: seed.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/seed.ts"), "utf-8");
  } catch { content = ""; }

  it("exports seed function or is runnable", () => {
    expect(content).toMatch(/export.*seed|async.*seed|function.*seed/i);
  });

  it("uses INSERT OR IGNORE for idempotency", () => {
    expect(content).toMatch(/INSERT\s+OR\s+IGNORE/i);
  });

  it("seeds users table", () => {
    expect(content).toMatch(/users/);
  });

  it("seeds system admin users (Thomas, Robin, Maria)", () => {
    expect(content).toMatch(/thomas|Thomas/i);
    expect(content).toMatch(/robin|Robin/i);
    expect(content).toMatch(/maria|Maria/i);
  });

  it("sets is_system_admin=1 for seed users", () => {
    expect(content).toMatch(/is_system_admin/);
  });

  it("seeds projects table", () => {
    expect(content).toMatch(/projects/);
  });

  it("seeds project_access table with admin roles", () => {
    expect(content).toMatch(/project_access/);
    expect(content).toMatch(/admin/);
  });

  it("seeds api_keys table", () => {
    expect(content).toMatch(/api_keys/);
  });

  it("uses database connection", () => {
    expect(content).toMatch(/db\.|database|better-sqlite3|getDb/i);
  });
});
