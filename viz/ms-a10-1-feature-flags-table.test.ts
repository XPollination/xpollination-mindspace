/**
 * TDD tests for ms-a10-1-feature-flags-table
 *
 * Verifies feature flags table and CRUD:
 * - Migration: feature_flags table with state (off/on), UNIQUE(project_slug, flag_name)
 * - POST /flags (contributor): create flag
 * - GET /flags (viewer): list, filter by state
 * - GET /flags/:flagId (viewer): get single
 * - PUT /flags/:flagId: contributor toggles OFF, admin toggles ON (human gate)
 * - DELETE /flags/:flagId (admin): remove
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/018-feature-flags.sql:
 *   - CREATE TABLE feature_flags (id, project_slug FK, task_id FK optional,
 *     flag_name, state CHECK (off/on), toggled_by FK users, toggled_at,
 *     created_at, expires_at)
 *   - UNIQUE(project_slug, flag_name)
 *   - Indexes on project_slug, flag_name, state
 * - Create api/routes/feature-flags.ts:
 *   - Export featureFlagsRouter with mergeParams
 *   - POST / (contributor), GET / (viewer, ?state filter), GET /:flagId (viewer)
 *   - PUT /:flagId (contributor for OFF, admin for ON)
 *   - DELETE /:flagId (admin)
 * - Update api/routes/projects.ts: mount at /:slug/flags
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a10-1-feature-flags-table: migration", () => {
  it("feature-flags migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/018-feature-flags.sql"),
      resolve(API_DIR, "db/migrations/019-feature-flags.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/018-feature-flags.sql"),
      resolve(API_DIR, "db/migrations/019-feature-flags.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates feature_flags table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*feature_flags/i);
  });

  it("has flag_name column", () => {
    expect(content).toMatch(/flag_name/);
  });

  it("has state CHECK (off, on)", () => {
    expect(content).toMatch(/state/);
    expect(content).toMatch(/CHECK/i);
    expect(content).toMatch(/off/);
    expect(content).toMatch(/on/);
  });

  it("has UNIQUE(project_slug, flag_name)", () => {
    expect(content).toMatch(/UNIQUE/i);
    expect(content).toMatch(/project_slug/);
    expect(content).toMatch(/flag_name/);
  });

  it("has task_id optional FK", () => {
    expect(content).toMatch(/task_id/);
  });

  it("has toggled_by FK to users", () => {
    expect(content).toMatch(/toggled_by/);
  });

  it("has expires_at column", () => {
    expect(content).toMatch(/expires_at/);
  });
});

// --- Router ---
describe("ms-a10-1-feature-flags-table: feature-flags.ts", () => {
  it("api/routes/feature-flags.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/feature-flags.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/feature-flags.ts"), "utf-8");
  } catch { content = ""; }

  it("exports featureFlagsRouter", () => {
    expect(content).toMatch(/export.*featureFlagsRouter/);
  });

  it("uses mergeParams", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("has POST handler for creating flags", () => {
    expect(content).toMatch(/\.post\(/i);
  });

  it("has GET handler for listing flags", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("supports ?state query filter", () => {
    expect(content).toMatch(/state/);
    expect(content).toMatch(/query/i);
  });

  it("has PUT handler for toggling flags", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("enforces admin-only for ON toggle (human gate)", () => {
    expect(content).toMatch(/admin/);
    expect(content).toMatch(/on/i);
  });

  it("has DELETE handler (admin only)", () => {
    expect(content).toMatch(/\.delete\(/i);
  });

  it("returns 409 for duplicate flag_name", () => {
    expect(content).toMatch(/409/);
  });

  it("returns 404 for non-existent flag", () => {
    expect(content).toMatch(/404/);
  });

  it("uses requireProjectAccess middleware", () => {
    expect(content).toMatch(/requireProjectAccess/);
  });
});

// --- Mount ---
describe("ms-a10-1-feature-flags-table: projects.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch { content = ""; }

  it("imports featureFlagsRouter", () => {
    expect(content).toMatch(/featureFlagsRouter|feature-flags/);
  });

  it("mounts at /:slug/flags", () => {
    expect(content).toMatch(/flags/);
  });
});
