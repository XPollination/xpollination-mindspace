/**
 * TDD tests for t3-2-suspect-link-table
 *
 * Verifies suspect link table + CRUD:
 * - Migration: suspect_links table with source, target, reason, status
 * - CRUD endpoints: GET/POST/PUT
 * - Status lifecycle: suspect→cleared/accepted-risk
 * - Stats endpoint
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create migration: suspect_links table
 *   - id, source_type (requirement/code/test/decision), source_ref
 *   - target_type, target_ref, reason, status (suspect/cleared/accepted_risk)
 *   - created_at, updated_at, cleared_by, cleared_at
 * - Create api/routes/suspect-links.ts (or services/suspect-links.ts):
 *   - GET / — list with filters (status, source_type)
 *   - POST / — create suspect link
 *   - PUT /:id — update status (clear/accept-risk)
 *   - GET /stats — counts by status
 * - Update interface-cli.js with suspect-link commands
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("t3-2-suspect-link-table: migration", () => {
  let migrationContent: string;
  try {
    const migrationDir = resolve(API_DIR, "db/migrations");
    const files = require("node:fs").readdirSync(migrationDir);
    const suspectFile = files.find((f: string) => f.match(/suspect/i));
    migrationContent = suspectFile ? readFileSync(resolve(migrationDir, suspectFile), "utf-8") : "";
  } catch { migrationContent = ""; }

  it("has suspect_links migration file", () => {
    expect(migrationContent.length).toBeGreaterThan(0);
  });

  it("creates suspect_links table", () => {
    expect(migrationContent).toMatch(/suspect_links/i);
    expect(migrationContent).toMatch(/CREATE TABLE/i);
  });

  it("has source_type column", () => {
    expect(migrationContent).toMatch(/source_type/);
  });

  it("has target_type column", () => {
    expect(migrationContent).toMatch(/target_type/);
  });

  it("has reason column", () => {
    expect(migrationContent).toMatch(/reason/);
  });

  it("has status column with valid values", () => {
    expect(migrationContent).toMatch(/status/);
    expect(migrationContent).toMatch(/suspect|cleared|accepted/i);
  });
});

describe("t3-2-suspect-link-table: routes/service", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/suspect-links.ts"),
      resolve(API_DIR, "services/suspect-links.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("suspect links service/route file exists", () => {
    const paths = [
      resolve(API_DIR, "routes/suspect-links.ts"),
      resolve(API_DIR, "services/suspect-links.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  it("has GET list endpoint", () => {
    expect(content).toMatch(/\.get\s*\(/i);
  });

  it("has POST create endpoint", () => {
    expect(content).toMatch(/\.post\s*\(/i);
  });

  it("has PUT update endpoint", () => {
    expect(content).toMatch(/\.put\s*\(/i);
  });

  it("supports status filter", () => {
    expect(content).toMatch(/status/);
  });

  it("has stats or counts endpoint", () => {
    expect(content).toMatch(/stats|count/i);
  });

  it("supports clearing a suspect link", () => {
    expect(content).toMatch(/cleared|clear/i);
  });

  it("supports accepted-risk status", () => {
    expect(content).toMatch(/accepted.*risk|accepted_risk/i);
  });
});
