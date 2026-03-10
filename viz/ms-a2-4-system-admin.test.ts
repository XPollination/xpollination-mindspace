/**
 * TDD tests for ms-a2-4-system-admin
 *
 * Verifies system admin bypass in access middleware:
 * - Migration: is_system_admin column on users table (default 0)
 * - System admin bypasses project_access checks
 * - System admin still gets 404 for non-existent projects
 * - req.projectAccess includes is_system_admin flag
 * - Non-admin behavior unchanged
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/011-system-admin.sql:
 *   - ALTER TABLE users ADD COLUMN is_system_admin INTEGER NOT NULL DEFAULT 0
 * - Update api/middleware/require-project-access.ts:
 *   - After project existence check, before project_access lookup:
 *     query users.is_system_admin for req.user.id
 *   - If is_system_admin = 1: set req.projectAccess = { role: 'admin', level: 2, is_system_admin: true }
 *   - Call next() — skip project_access check
 *   - Non-admin users: fall through to existing logic (unchanged)
 *   - Admin still gets 404 for non-existent projects
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a2-4-system-admin: migration", () => {
  it("011-system-admin.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/011-system-admin.sql"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/011-system-admin.sql"), "utf-8");
  } catch { content = ""; }

  it("adds is_system_admin column to users table", () => {
    expect(content).toMatch(/ALTER\s+TABLE\s+users/i);
    expect(content).toMatch(/is_system_admin/);
  });

  it("defaults to 0 (not admin)", () => {
    expect(content).toMatch(/DEFAULT\s+0/i);
  });
});

// --- Middleware update ---
describe("ms-a2-4-system-admin: require-project-access.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/require-project-access.ts"), "utf-8");
  } catch { content = ""; }

  it("queries is_system_admin from users table", () => {
    expect(content).toMatch(/is_system_admin/);
    expect(content).toMatch(/users/);
  });

  it("system admin bypasses project_access lookup", () => {
    // Admin check must come before or instead of project_access query
    expect(content).toMatch(/is_system_admin/);
    expect(content).toMatch(/next\(\)/);
  });

  it("sets role to admin for system admins", () => {
    expect(content).toMatch(/admin/);
  });

  it("sets is_system_admin flag in req.projectAccess", () => {
    expect(content).toMatch(/is_system_admin.*true|is_system_admin:\s*true/);
  });

  it("admin still gets 404 for non-existent project", () => {
    // 404 check must come before admin bypass
    expect(content).toMatch(/404/);
  });

  it("non-admin users fall through to existing logic", () => {
    // project_access table still queried for non-admins
    expect(content).toMatch(/project_access/);
  });

  it("returns 403 for non-admin without access (unchanged)", () => {
    expect(content).toMatch(/403/);
  });

  it("returns 401 for unauthenticated (unchanged)", () => {
    expect(content).toMatch(/401/);
  });
});
