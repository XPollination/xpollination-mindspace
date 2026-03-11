/**
 * TDD tests for t2-4-transition-gate
 *
 * Verifies attestation as transition gate:
 * - attestations table for storing attestation records
 * - checkAttestationGate function blocks transitions without valid attestation
 * - Integration with workflow engine
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create migration: attestations table
 *   - id, task_slug, project_slug, attestation_data (JSON)
 *   - rules_version, valid (boolean), created_at, created_by
 * - Create api/services/attestation-gate.ts:
 *   - checkAttestationGate(task, transition) → {allowed, reason}
 *   - Checks if rules configured for this project/capability
 *   - If rules exist, requires valid attestation
 *   - If no rules, allows transition (no gate)
 * - Update workflow-engine.js:
 *   - Before transition, call checkAttestationGate
 *   - Block with 422 if attestation required but missing/invalid
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("t2-4-transition-gate: migration", () => {
  let migrationContent: string;
  try {
    const migrationDir = resolve(API_DIR, "db/migrations");
    const files = require("node:fs").readdirSync(migrationDir);
    const attestFile = files.find((f: string) => f.match(/attestation/i));
    migrationContent = attestFile ? readFileSync(resolve(migrationDir, attestFile), "utf-8") : "";
  } catch { migrationContent = ""; }

  it("has attestations migration", () => {
    expect(migrationContent.length).toBeGreaterThan(0);
  });

  it("creates attestations table", () => {
    expect(migrationContent).toMatch(/attestations/i);
    expect(migrationContent).toMatch(/CREATE TABLE/i);
  });

  it("has task_slug column", () => {
    expect(migrationContent).toMatch(/task_slug/);
  });

  it("has valid column", () => {
    expect(migrationContent).toMatch(/valid/);
  });

  it("has rules_version column", () => {
    expect(migrationContent).toMatch(/rules_version/);
  });
});

describe("t2-4-transition-gate: service", () => {
  it("attestation-gate service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/attestation-gate.ts"),
      resolve(API_DIR, "services/attestationGate.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/attestation-gate.ts"),
      resolve(API_DIR, "services/attestationGate.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports checkAttestationGate function", () => {
    expect(content).toMatch(/export.*checkAttestationGate|exports.*checkAttestationGate/);
  });

  it("returns allowed boolean", () => {
    expect(content).toMatch(/allowed/);
  });

  it("returns reason when blocked", () => {
    expect(content).toMatch(/reason/);
  });

  it("checks for valid attestation", () => {
    expect(content).toMatch(/valid/);
  });

  it("allows transition when no rules configured", () => {
    expect(content).toMatch(/no.*rules|default.*allow|skip/i);
  });
});

describe("t2-4-transition-gate: workflow integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/db/workflow-engine.js"), "utf-8");
  } catch { content = ""; }

  it("workflow engine references attestation gate", () => {
    expect(content).toMatch(/attestation|checkAttestation/i);
  });

  it("returns 422 when attestation required but missing", () => {
    expect(content).toMatch(/422/);
  });
});
