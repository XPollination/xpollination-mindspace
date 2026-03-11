/**
 * TDD tests for ms-a3-6-heartbeat
 *
 * Verifies heartbeat endpoint:
 * - POST /api/tasks/:taskId/heartbeat with { brain_thought_id }
 * - Validates: task claimed by user, active lease
 * - Resets lease expires_at by role duration
 * - Best-effort brain thought validation
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/task-heartbeat.ts:
 *   - POST /api/tasks/:taskId/heartbeat
 *   - Requires { brain_thought_id } in body
 *   - Validates: task exists, claimed by this user, active lease exists
 *   - Resets expires_at = now + role_duration (from lease-service)
 *   - Best-effort: validate brain_thought_id exists (non-blocking)
 *   - Returns 200 with updated lease
 *   - 400 if no brain_thought_id, 404 if task/lease not found, 403 if not claimed
 * - Update api/services/lease-service.ts:
 *   - Add renewLease(leaseId, duration) function
 * - Update index.ts to register route
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a3-6-heartbeat: endpoint", () => {
  it("task-heartbeat route file exists", () => {
    const paths = [
      resolve(API_DIR, "routes/task-heartbeat.ts"),
      resolve(API_DIR, "routes/taskHeartbeat.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/task-heartbeat.ts"),
      resolve(API_DIR, "routes/taskHeartbeat.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has POST heartbeat endpoint", () => {
    expect(content).toMatch(/heartbeat/i);
    expect(content).toMatch(/\.post\s*\(/i);
  });

  it("requires brain_thought_id", () => {
    expect(content).toMatch(/brain_thought_id/);
  });

  it("validates task is claimed by user", () => {
    expect(content).toMatch(/claimed_by|claim/i);
  });

  it("validates active lease exists", () => {
    expect(content).toMatch(/lease|active/i);
  });

  it("resets expires_at", () => {
    expect(content).toMatch(/expires_at|renew|reset/i);
  });

  it("returns 404 for missing task or lease", () => {
    expect(content).toMatch(/404/);
  });

  it("best-effort brain thought validation", () => {
    expect(content).toMatch(/brain|thought|validate/i);
  });
});

describe("ms-a3-6-heartbeat: lease-service integration", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/lease-service.ts"),
      resolve(API_DIR, "services/leaseService.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has renewLease function", () => {
    expect(content).toMatch(/renewLease|renew.*lease/i);
  });

  it("updates expires_at", () => {
    expect(content).toMatch(/expires_at/);
  });
});
