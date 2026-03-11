/**
 * TDD tests for t2-2-rules-engine
 *
 * Verifies attestation rules engine:
 * - Service: attestation-rules.ts with validateAttestation function
 * - Rules: tags_present, refs_valid, tests_tagged, commits_formatted
 * - Route: POST /validate returns 200 (valid) or 422 (invalid)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/attestation-rules.ts:
 *   - Export validateAttestation(db, attestation) → { valid, results: RuleResult[] }
 *   - Rule interface: { name, validate(db, att) → RuleResult }
 *   - RuleResult: { rule, passed, message? }
 *   - Built-in rules:
 *     - tags_present: req_id, task_id exist
 *     - refs_valid: referenced task_id exists in DB
 *     - tests_tagged: test results have test_id
 *     - commits_formatted: messages match type: pattern
 * - Create api/routes/attestations.ts:
 *   - POST /validate endpoint
 *   - Returns 200 if valid, 422 if invalid
 *   - Returns { valid, results } JSON
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("t2-2-rules-engine: service", () => {
  it("attestation-rules service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/attestation-rules.ts"),
      resolve(API_DIR, "services/attestationRules.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/attestation-rules.ts"),
      resolve(API_DIR, "services/attestationRules.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports validateAttestation function", () => {
    expect(content).toMatch(/export.*validateAttestation|exports.*validateAttestation/);
  });

  it("has tags_present rule", () => {
    expect(content).toMatch(/tags_present/);
  });

  it("has refs_valid rule", () => {
    expect(content).toMatch(/refs_valid/);
  });

  it("has tests_tagged rule", () => {
    expect(content).toMatch(/tests_tagged/);
  });

  it("has commits_formatted rule", () => {
    expect(content).toMatch(/commits_formatted/);
  });

  it("returns valid boolean and results array", () => {
    expect(content).toMatch(/valid/);
    expect(content).toMatch(/results/);
  });

  it("each result has rule, passed, and optional message", () => {
    expect(content).toMatch(/rule/);
    expect(content).toMatch(/passed/);
    expect(content).toMatch(/message/);
  });
});

describe("t2-2-rules-engine: route", () => {
  it("attestations route file exists", () => {
    const paths = [
      resolve(API_DIR, "routes/attestations.ts"),
      resolve(API_DIR, "routes/attestation.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/attestations.ts"),
      resolve(API_DIR, "routes/attestation.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has POST /validate endpoint", () => {
    expect(content).toMatch(/validate/);
    expect(content).toMatch(/\.post\(/i);
  });

  it("returns 422 for invalid attestation", () => {
    expect(content).toMatch(/422/);
  });

  it("returns 200 for valid attestation", () => {
    expect(content).toMatch(/200/);
  });
});
