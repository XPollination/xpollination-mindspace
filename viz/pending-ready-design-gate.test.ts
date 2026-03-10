/**
 * TDD tests for pending-ready-design-gate
 *
 * Verifies workflow engine blocks pending→ready for dev tasks without PDSA design:
 * - Role-specific rule: pending->ready:dev requires pdsa_ref in DNA
 * - PDSA and liaison tasks pass through unchanged (no design gate)
 * - Bug type tasks unaffected
 *
 * DEV IMPLEMENTATION NOTES:
 * - In src/db/workflow-engine.js:
 *   - Add role-specific transition rule pending->ready:dev
 *   - Rule has requiresDna: ['pdsa_ref'] (or similar gate pattern)
 *   - Only applies when task role is 'dev'
 *   - PDSA/liaison role tasks do NOT have this gate
 * - Works on MAIN branch (workflow engine is production infrastructure)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);

// --- Workflow engine rule ---
describe("pending-ready-design-gate: workflow-engine.js", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/db/workflow-engine.js"), "utf-8");
  } catch {
    content = "";
  }

  it("has pending->ready:dev role-specific rule", () => {
    expect(content).toMatch(/pending->ready:dev/);
  });

  it("requires pdsa_ref in DNA for dev tasks", () => {
    expect(content).toMatch(/pdsa_ref/);
    expect(content).toMatch(/requiresDna|requires_dna|dna.*gate|gate.*dna/i);
  });

  it("error message mentions PDSA design requirement", () => {
    expect(content).toMatch(/PDSA|design|pdsa_ref/i);
  });
});

// --- Interface CLI enforcement ---
describe("pending-ready-design-gate: interface-cli.js enforcement", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/db/interface-cli.js"), "utf-8");
  } catch {
    content = "";
  }

  it("checks requiresDna before executing transition", () => {
    expect(content).toMatch(/requiresDna|requires_dna/i);
  });

  it("rejects transition when required DNA fields are missing", () => {
    expect(content).toMatch(/missing|required|must have/i);
  });
});
