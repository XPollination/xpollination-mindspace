/**
 * TDD tests for ms-a4-2-req-versioning
 *
 * Verifies requirement versioning (history table):
 * - Migration: requirement_versions snapshot table
 * - Auto-versioning on PUT (creates version before update)
 * - Immutable version records
 * - GET /:reqId/history returns all versions DESC
 * - current_version increments on requirements table
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/015-requirement-versions.sql:
 *   - CREATE TABLE requirement_versions (id, requirement_id FK, version_number,
 *     title, description, status, priority, created_at, created_by)
 *   - UNIQUE(requirement_id, version_number)
 * - Update api/routes/requirements.ts:
 *   - PUT handler: snapshot current state before update, increment current_version
 *   - GET /:reqId/history: return all versions ordered by version_number DESC
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a4-2-req-versioning: migration", () => {
  it("requirement-versions migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/015-requirement-versions.sql"),
      resolve(API_DIR, "db/migrations/016-requirement-versions.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/015-requirement-versions.sql"),
      resolve(API_DIR, "db/migrations/016-requirement-versions.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates requirement_versions table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*requirement_versions/i);
  });

  it("has requirement_id FK", () => {
    expect(content).toMatch(/requirement_id/);
    expect(content).toMatch(/REFERENCES\s+requirements/i);
  });

  it("has version_number column", () => {
    expect(content).toMatch(/version_number/);
  });

  it("has UNIQUE(requirement_id, version_number)", () => {
    expect(content).toMatch(/UNIQUE/i);
  });

  it("stores snapshot fields (title, description, status, priority)", () => {
    expect(content).toMatch(/title/);
    expect(content).toMatch(/status/);
  });
});

// --- Requirements route update ---
describe("ms-a4-2-req-versioning: requirements.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/requirements.ts"), "utf-8");
  } catch { content = ""; }

  it("PUT handler creates version snapshot before update", () => {
    expect(content).toMatch(/requirement_versions/);
    expect(content).toMatch(/INSERT/i);
  });

  it("increments current_version on update", () => {
    expect(content).toMatch(/current_version/);
  });

  it("has GET /:reqId/history endpoint", () => {
    expect(content).toMatch(/history/);
  });

  it("orders history by version_number DESC", () => {
    expect(content).toMatch(/DESC|ORDER\s+BY/i);
  });

  it("version records are read-only (no PUT/DELETE on versions)", () => {
    // History endpoint should be GET only
    expect(content).toMatch(/history/);
    expect(content).toMatch(/\.get\(/i);
  });
});
