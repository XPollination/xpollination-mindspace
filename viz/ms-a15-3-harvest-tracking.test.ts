/**
 * TDD tests for ms-a15-3-harvest-tracking
 *
 * Verifies harvest status tracking:
 * - Migration: community_needs table
 * - Status lifecycle: unharvested/under_consideration/planned/implemented/declined
 * - CRUD endpoints + stats
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create migration: community_needs table
 *   - id, topic, description, thought_ids (JSON), count
 *   - status: unharvested/under_consideration/planned/implemented/declined
 *   - created_at, updated_at
 * - Update api/routes/marketplace-community.ts:
 *   - GET /community-needs — list with status filter
 *   - PUT /community-needs/:id — update status
 *   - GET /community-needs/stats — counts by status
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a15-3-harvest-tracking: migration", () => {
  let migrationContent: string;
  try {
    const migrationDir = resolve(API_DIR, "db/migrations");
    const files = require("node:fs").readdirSync(migrationDir);
    const needsFile = files.find((f: string) => f.match(/community.*needs|harvest/i));
    migrationContent = needsFile ? readFileSync(resolve(migrationDir, needsFile), "utf-8") : "";
  } catch { migrationContent = ""; }

  it("has community_needs migration", () => {
    expect(migrationContent.length).toBeGreaterThan(0);
  });

  it("creates community_needs table", () => {
    expect(migrationContent).toMatch(/community_needs/i);
    expect(migrationContent).toMatch(/CREATE TABLE/i);
  });

  it("has status column with lifecycle values", () => {
    expect(migrationContent).toMatch(/status/);
  });

  it("includes unharvested status", () => {
    expect(migrationContent).toMatch(/unharvested/i);
  });

  it("includes implemented status", () => {
    expect(migrationContent).toMatch(/implemented/i);
  });

  it("includes declined status", () => {
    expect(migrationContent).toMatch(/declined/i);
  });
});

describe("ms-a15-3-harvest-tracking: endpoints", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/marketplace-community.ts"),
      resolve(API_DIR, "routes/marketplace.ts"),
      resolve(API_DIR, "routes/community-needs.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has PUT status update endpoint", () => {
    expect(content).toMatch(/\.put\s*\(/i);
    expect(content).toMatch(/status/);
  });

  it("has stats or counts endpoint", () => {
    expect(content).toMatch(/stats|count/i);
  });

  it("supports status filter on list", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/\.get\s*\(/i);
  });
});
