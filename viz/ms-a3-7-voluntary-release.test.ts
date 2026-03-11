/**
 * TDD tests for ms-a3-7-voluntary-release
 *
 * Verifies voluntary release endpoint:
 * - POST /api/tasks/:taskId/release with { reason }
 * - Unclaims task, sets lease status=released
 * - Auto-contributes to brain
 * - Contributions preserved for tokenomics
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/task-release.ts:
 *   - POST /api/tasks/:taskId/release
 *   - Requires { reason } in body
 *   - Validates: task exists, claimed by this user, active lease
 *   - Sets lease status='released'
 *   - Unclaims task (claimed_by=NULL)
 *   - Auto-contribute to brain (reason + context)
 *   - Preserves contributions for tokenomics
 *   - Returns 200 with release confirmation
 *   - 400 if no reason, 404 if task not found, 403 if not claimed by user
 * - Update index.ts to register route
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a3-7-voluntary-release: endpoint", () => {
  it("task-release route file exists", () => {
    const paths = [
      resolve(API_DIR, "routes/task-release.ts"),
      resolve(API_DIR, "routes/taskRelease.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/task-release.ts"),
      resolve(API_DIR, "routes/taskRelease.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has POST release endpoint", () => {
    expect(content).toMatch(/release/i);
    expect(content).toMatch(/\.post\s*\(/i);
  });

  it("requires reason in body", () => {
    expect(content).toMatch(/reason/);
  });

  it("sets lease status to released", () => {
    expect(content).toMatch(/released/);
  });

  it("unclaims task", () => {
    expect(content).toMatch(/claimed_by.*NULL|unclaim/i);
  });

  it("auto-contributes to brain", () => {
    expect(content).toMatch(/brain|memory|contribute/i);
  });

  it("returns 404 for task not found", () => {
    expect(content).toMatch(/404/);
  });

  it("validates user owns the claim", () => {
    expect(content).toMatch(/claimed_by|403|not.*claim/i);
  });
});
