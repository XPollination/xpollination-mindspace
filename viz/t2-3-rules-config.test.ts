/**
 * TDD tests for t2-3-rules-config
 *
 * Verifies attestation rules configuration per project/capability:
 * - Migration: attestation_rules table
 * - CRUD for rules per project+capability
 * - rules_version tracking
 * - Validator reads config, falls back to defaults
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create migration: attestation_rules table
 *   - id, project_slug, capability_id (nullable), rules (JSON), rules_version
 *   - created_at, updated_at
 * - Create api/services/rules-config.ts (or routes):
 *   - GET /rules — list rules for project
 *   - POST /rules — create/update rules
 *   - getRulesForCapability(project, capability) — returns rules or defaults
 *   - rules_version increments on update
 * - Update api/services/attestation-rules.ts:
 *   - validateAttestation reads rules from config (not hardcoded)
 *   - Falls back to default rules if no config
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("t2-3-rules-config: migration", () => {
  let migrationContent: string;
  try {
    const migrationDir = resolve(API_DIR, "db/migrations");
    const files = require("node:fs").readdirSync(migrationDir);
    const rulesFile = files.find((f: string) => f.match(/rules.*config|attestation.*rules.*config/i));
    migrationContent = rulesFile ? readFileSync(resolve(migrationDir, rulesFile), "utf-8") : "";
  } catch { migrationContent = ""; }

  it("has rules config migration", () => {
    expect(migrationContent.length).toBeGreaterThan(0);
  });

  it("creates attestation_rules table", () => {
    expect(migrationContent).toMatch(/attestation_rules|rules_config/i);
    expect(migrationContent).toMatch(/CREATE TABLE/i);
  });

  it("has project_slug column", () => {
    expect(migrationContent).toMatch(/project_slug/);
  });

  it("has rules_version column", () => {
    expect(migrationContent).toMatch(/rules_version/);
  });

  it("has rules JSON column", () => {
    expect(migrationContent).toMatch(/rules/);
  });
});

describe("t2-3-rules-config: service", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/rules-config.ts"),
      resolve(API_DIR, "routes/rules-config.ts"),
      resolve(API_DIR, "services/attestation-rules-config.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("rules config service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/rules-config.ts"),
      resolve(API_DIR, "routes/rules-config.ts"),
      resolve(API_DIR, "services/attestation-rules-config.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  it("has getRulesForCapability or similar function", () => {
    expect(content).toMatch(/getRules|getConfig|rules.*capability/i);
  });

  it("supports per-project configuration", () => {
    expect(content).toMatch(/project_slug|project/i);
  });

  it("supports per-capability configuration", () => {
    expect(content).toMatch(/capability_id|capability/i);
  });

  it("has default fallback rules", () => {
    expect(content).toMatch(/default|fallback/i);
  });

  it("tracks rules_version", () => {
    expect(content).toMatch(/rules_version|version/i);
  });
});

describe("t2-3-rules-config: attestation-rules integration", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/attestation-rules.ts"),
      resolve(API_DIR, "services/attestationRules.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("attestation-rules reads from config", () => {
    expect(content).toMatch(/config|getRules|rules_config/i);
  });
});
