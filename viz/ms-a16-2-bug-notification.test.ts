/**
 * TDD tests for ms-a16-2-bug-notification
 *
 * Verifies bug report SSE notification:
 * - Service: broadcastBugReported function
 * - Event format: { type: 'BUG_REPORTED', bug_id, project_slug, title, severity }
 * - Integration with bug reports route
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/bug-broadcast.ts:
 *   - Export broadcastBugReported(bugId, projectSlug, title, severity)
 *   - Creates SSE event with type 'BUG_REPORTED'
 *   - Sends to ALL connected agents on the project (no role filter)
 *   - Best-effort (no failure on SSE down)
 * - Update api/routes/bug-reports.ts:
 *   - After POST bug creation, call broadcastBugReported
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a16-2-bug-notification: broadcast service", () => {
  it("bug-broadcast service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/bug-broadcast.ts"),
      resolve(API_DIR, "services/bugBroadcast.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/bug-broadcast.ts"),
      resolve(API_DIR, "services/bugBroadcast.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports broadcastBugReported function", () => {
    expect(content).toMatch(/export.*broadcastBugReported|exports.*broadcastBugReported/);
  });

  it("includes BUG_REPORTED event type", () => {
    expect(content).toMatch(/BUG_REPORTED/);
  });

  it("includes severity in event", () => {
    expect(content).toMatch(/severity/);
  });

  it("includes project_slug in event", () => {
    expect(content).toMatch(/project_slug|projectSlug/);
  });
});

describe("ms-a16-2-bug-notification: route integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/bug-reports.ts"), "utf-8");
  } catch { content = ""; }

  it("bug-reports route references broadcast", () => {
    expect(content).toMatch(/broadcast|BUG_REPORTED/i);
  });
});
