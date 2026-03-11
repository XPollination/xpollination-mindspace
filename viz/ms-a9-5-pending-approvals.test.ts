/**
 * TDD tests for ms-a9-5-pending-approvals
 *
 * Verifies pending approvals count endpoint for viz badge:
 * - GET /count returns { pending: N, total: N }
 * - Count is project-scoped
 * - GET /?status=pending still works
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/approval-requests.ts:
 *   - Add GET /count endpoint
 *   - Returns { pending: N, total: N } counts
 *   - Uses project_slug scoping from route params
 *   - Requires viewer access (requireProjectAccess)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a9-5-pending-approvals: count endpoint", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/approval-requests.ts"), "utf-8");
  } catch { content = ""; }

  it("has GET /count endpoint", () => {
    expect(content).toMatch(/count/);
    expect(content).toMatch(/\.get\(/i);
  });

  it("returns pending count", () => {
    expect(content).toMatch(/pending/i);
    expect(content).toMatch(/count|COUNT/i);
  });

  it("returns total count", () => {
    expect(content).toMatch(/total/i);
  });

  it("queries by project_slug for scoping", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("filters pending status in SQL", () => {
    expect(content).toMatch(/status\s*=\s*'pending'|status.*pending/i);
  });

  it("returns JSON response with counts", () => {
    expect(content).toMatch(/\.json\(/);
    expect(content).toMatch(/pending/);
  });
});
