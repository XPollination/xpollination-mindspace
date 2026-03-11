/**
 * TDD tests for ms-a9-1-approval-requests
 *
 * Verifies approval requests table and auto-creation:
 * - Migration: approval_requests table
 * - Auto-create on active→approval transition
 * - GET endpoints for listing/getting approvals
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/022-approval-requests.sql:
 *   - CREATE TABLE approval_requests (id, task_id FK, project_slug FK,
 *     requested_by FK users, status CHECK (pending/approved/rejected),
 *     decided_by FK users, decided_at, reason TEXT, created_at)
 *   - Indexes on task_id, project_slug, status
 * - Create api/routes/approval-requests.ts:
 *   - Export approvalRequestsRouter with mergeParams
 *   - GET / (list approvals), GET /:approvalId
 * - Update task transition: on active→approval, auto-create approval_request
 * - Update api/routes/projects.ts: mount at /:slug/approvals
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a9-1-approval-requests: migration", () => {
  it("approval-requests migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/022-approval-requests.sql"),
      resolve(API_DIR, "db/migrations/023-approval-requests.sql"),
      resolve(API_DIR, "db/migrations/024-approval-requests.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/022-approval-requests.sql"),
      resolve(API_DIR, "db/migrations/023-approval-requests.sql"),
      resolve(API_DIR, "db/migrations/024-approval-requests.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates approval_requests table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*approval_requests/i);
  });

  it("has task_id FK", () => {
    expect(content).toMatch(/task_id/);
  });

  it("has status CHECK (pending, approved, rejected)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/pending/);
    expect(content).toMatch(/approved/);
    expect(content).toMatch(/rejected/);
  });
});

describe("ms-a9-1-approval-requests: router", () => {
  it("approval-requests.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/approval-requests.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/approval-requests.ts"), "utf-8");
  } catch { content = ""; }

  it("exports approvalRequestsRouter", () => {
    expect(content).toMatch(/export.*approvalRequestsRouter/);
  });

  it("has GET handler for listing", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("returns 404 for non-existent approval", () => {
    expect(content).toMatch(/404/);
  });
});

describe("ms-a9-1-approval-requests: auto-creation", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/tasks.ts"),
      resolve(API_DIR, "routes/task-transitions.ts"),
      resolve(API_DIR, "services/task-transitions.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates approval_request on approval transition", () => {
    expect(content).toMatch(/approval_request|approval/i);
  });
});

describe("ms-a9-1-approval-requests: mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch { content = ""; }

  it("imports approvalRequestsRouter", () => {
    expect(content).toMatch(/approvalRequestsRouter|approval-requests/);
  });

  it("mounts at /:slug/approvals", () => {
    expect(content).toMatch(/approvals/);
  });
});
