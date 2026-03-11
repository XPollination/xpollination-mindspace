/**
 * TDD tests for ms-a11-6-task-available
 *
 * Verifies TASK_AVAILABLE broadcast on state change:
 * - Service: broadcastTaskAvailable function
 * - Integration: task-transitions, task-claiming, blocked-status hook into broadcast
 * - Event format: { type: 'TASK_AVAILABLE', task_id, project_slug, role, title }
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/task-broadcast.ts:
 *   - Export broadcastTaskAvailable(taskId, projectSlug, role)
 *   - Interfaces with SSE infra to push events
 *   - Event format: { type: 'TASK_AVAILABLE', task_id, project_slug, role, title }
 * - Update api/routes/task-transitions.ts:
 *   - After successful transition to ready/unclaimed, call broadcastTaskAvailable
 * - Update api/routes/task-claiming.ts:
 *   - On DELETE (unclaim), call broadcastTaskAvailable
 * - Update api/routes/blocked-status.ts (or equivalent):
 *   - After auto-unblock, call broadcastTaskAvailable
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a11-6-task-available: broadcast service", () => {
  it("task-broadcast service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/task-broadcast.ts"),
      resolve(API_DIR, "services/taskBroadcast.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/task-broadcast.ts"),
      resolve(API_DIR, "services/taskBroadcast.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports broadcastTaskAvailable function", () => {
    expect(content).toMatch(/export.*broadcastTaskAvailable|exports.*broadcastTaskAvailable/);
  });

  it("includes TASK_AVAILABLE event type", () => {
    expect(content).toMatch(/TASK_AVAILABLE/);
  });

  it("event includes project_slug", () => {
    expect(content).toMatch(/project_slug|projectSlug/);
  });

  it("event includes role for filtering", () => {
    expect(content).toMatch(/role/);
  });
});

describe("ms-a11-6-task-available: integration hooks", () => {
  let transitionsContent: string;
  try {
    transitionsContent = readFileSync(resolve(API_DIR, "routes/task-transitions.ts"), "utf-8");
  } catch { transitionsContent = ""; }

  let claimingContent: string;
  try {
    claimingContent = readFileSync(resolve(API_DIR, "routes/task-claiming.ts"), "utf-8");
  } catch { claimingContent = ""; }

  it("task-transitions.ts references broadcast", () => {
    expect(transitionsContent).toMatch(/broadcast|TASK_AVAILABLE/i);
  });

  it("task-claiming.ts references broadcast on unclaim", () => {
    expect(claimingContent).toMatch(/broadcast|TASK_AVAILABLE/i);
  });
});
