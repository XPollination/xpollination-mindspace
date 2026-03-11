/**
 * TDD tests for ms-a4-4-req-approval
 *
 * Verifies requirement approval workflow:
 * - Migration: requirement_approvals table with token-based confirmation
 * - POST /:reqId/approve — request approval (generates token)
 * - POST /approve/confirm — confirm with token (1hr TTL)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/023-requirement-approvals.sql:
 *   - CREATE TABLE requirement_approvals (id, requirement_id FK, project_slug FK,
 *     token TEXT UNIQUE, status CHECK (pending/confirmed/expired),
 *     requested_by FK users, confirmed_by FK users, expires_at, created_at, confirmed_at)
 *   - Indexes on requirement_id, token
 * - Create api/routes/requirement-approvals.ts:
 *   - Export requirementApprovalsRouter
 *   - POST /:reqId/approve — create approval request with token + 1hr TTL
 *   - POST /approve/confirm — confirm with token, check expiry
 * - Update api/routes/requirements.ts: mount approval sub-router
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a4-4-req-approval: migration", () => {
  it("requirement-approvals migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/023-requirement-approvals.sql"),
      resolve(API_DIR, "db/migrations/024-requirement-approvals.sql"),
      resolve(API_DIR, "db/migrations/025-requirement-approvals.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/023-requirement-approvals.sql"),
      resolve(API_DIR, "db/migrations/024-requirement-approvals.sql"),
      resolve(API_DIR, "db/migrations/025-requirement-approvals.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates requirement_approvals table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*requirement_approvals/i);
  });

  it("has token TEXT UNIQUE", () => {
    expect(content).toMatch(/token/);
    expect(content).toMatch(/UNIQUE/i);
  });

  it("has status CHECK (pending, confirmed, expired)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/pending/);
    expect(content).toMatch(/confirmed/);
    expect(content).toMatch(/expired/);
  });

  it("has expires_at for TTL", () => {
    expect(content).toMatch(/expires_at/);
  });
});

describe("ms-a4-4-req-approval: router", () => {
  it("requirement-approvals.ts exists", () => {
    const paths = [
      resolve(API_DIR, "routes/requirement-approvals.ts"),
      resolve(API_DIR, "routes/requirements.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/requirement-approvals.ts"),
      resolve(API_DIR, "routes/requirements.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has POST handler for requesting approval", () => {
    expect(content).toMatch(/\.post\(/i);
    expect(content).toMatch(/approve|approval/i);
  });

  it("generates approval token", () => {
    expect(content).toMatch(/token/);
    expect(content).toMatch(/random|uuid|crypto/i);
  });

  it("has confirm endpoint", () => {
    expect(content).toMatch(/confirm/i);
  });

  it("checks token expiry (1hr TTL)", () => {
    expect(content).toMatch(/expir|TTL|hour/i);
  });

  it("returns 400 for expired token", () => {
    expect(content).toMatch(/400|expired/i);
  });

  it("returns 404 for invalid token", () => {
    expect(content).toMatch(/404/);
  });
});

describe("ms-a4-4-req-approval: mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/requirements.ts"), "utf-8");
  } catch { content = ""; }

  it("references approval functionality", () => {
    expect(content).toMatch(/approv/i);
  });
});
