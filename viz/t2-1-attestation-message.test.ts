/**
 * TDD tests for t2-1-attestation-message
 *
 * Verifies ATTESTATION_REQUIRED message type:
 * - Migration: attestations table
 * - Helper: attestation.ts (requestAttestation, resolveAttestation, etc.)
 * - Handler: ATTESTATION_SUBMITTED in a2a-message.ts
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/017-attestations.sql:
 *   - attestations: id, task_id, project_slug, agent_id, from_status, to_status,
 *     rules_version, required_checks (JSON), submitted_checks (JSON),
 *     status (pending|submitted|accepted|rejected), rejection_reason, timestamps
 * - Create api/lib/attestation.ts:
 *   - requestAttestation(), getAttestation(), resolveAttestation(), getPendingAttestations()
 * - Update api/routes/a2a-message.ts: add ATTESTATION_SUBMITTED handler
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("t2-1-attestation-message: migration", () => {
  it("017-attestations.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/017-attestations.sql"))).toBe(true);
  });

  let content: string;
  try { content = readFileSync(resolve(API_DIR, "db/migrations/017-attestations.sql"), "utf-8"); } catch { content = ""; }

  it("creates attestations table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*attestations/i);
  });

  it("has required_checks and submitted_checks columns", () => {
    expect(content).toMatch(/required_checks/);
    expect(content).toMatch(/submitted_checks/);
  });

  it("has status CHECK (pending|submitted|accepted|rejected)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/CHECK/i);
    expect(content).toMatch(/pending/);
    expect(content).toMatch(/submitted/);
    expect(content).toMatch(/accepted/);
    expect(content).toMatch(/rejected/);
  });

  it("has from_status and to_status for transition context", () => {
    expect(content).toMatch(/from_status/);
    expect(content).toMatch(/to_status/);
  });

  it("has indexes on task_id, agent_id, status", () => {
    expect(content).toMatch(/CREATE\s+INDEX|idx_/i);
  });
});

describe("t2-1-attestation-message: attestation.ts helpers", () => {
  it("api/lib/attestation.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "lib/attestation.ts"))).toBe(true);
  });

  let content: string;
  try { content = readFileSync(resolve(API_DIR, "lib/attestation.ts"), "utf-8"); } catch { content = ""; }

  it("exports requestAttestation function", () => {
    expect(content).toMatch(/requestAttestation/);
  });

  it("exports resolveAttestation function", () => {
    expect(content).toMatch(/resolveAttestation/);
  });

  it("exports getAttestation function", () => {
    expect(content).toMatch(/getAttestation/);
  });

  it("exports getPendingAttestations function", () => {
    expect(content).toMatch(/getPendingAttestations/);
  });

  it("pushes via SSE on request", () => {
    expect(content).toMatch(/SSE|sse|push|send/i);
  });
});

describe("t2-1-attestation-message: a2a-message.ts handler", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/a2a-message.ts"), "utf-8"); } catch { content = ""; }

  it("has ATTESTATION_SUBMITTED handler", () => {
    expect(content).toMatch(/ATTESTATION_SUBMITTED/);
  });

  it("validates attestation_id is present (400)", () => {
    expect(content).toMatch(/attestation_id/);
    expect(content).toMatch(/400/);
  });

  it("validates submitted_checks is present (400)", () => {
    expect(content).toMatch(/submitted_checks/);
  });

  it("checks attestation belongs to agent (403)", () => {
    expect(content).toMatch(/403/);
  });

  it("checks attestation is pending (409)", () => {
    expect(content).toMatch(/409/);
    expect(content).toMatch(/pending/i);
  });
});
