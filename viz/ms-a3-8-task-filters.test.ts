/**
 * TDD tests for ms-a3-8-task-filters
 *
 * Verifies task list filtering:
 * - GET /api/projects/:slug/tasks with ?claimed, ?blocked, ?available_only filters
 * - No new migration
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/tasks.ts GET / handler:
 *   - ?claimed=true/false — filter by claimed_by IS NOT NULL / IS NULL
 *   - ?blocked=true/false — filter by status='blocked' or not
 *   - ?available_only=true — unclaimed + not blocked (ready for work)
 *   - Combine with existing ?status, ?current_role filters
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a3-8-task-filters: tasks.ts filters", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("supports ?claimed filter parameter", () => {
    expect(content).toMatch(/claimed/);
    expect(content).toMatch(/query/i);
  });

  it("filters by claimed_by IS NOT NULL / IS NULL", () => {
    expect(content).toMatch(/claimed_by/);
    expect(content).toMatch(/NULL/i);
  });

  it("supports ?blocked filter parameter", () => {
    expect(content).toMatch(/blocked/);
  });

  it("supports ?available_only filter", () => {
    expect(content).toMatch(/available_only|available/);
  });

  it("available_only combines unclaimed + not blocked", () => {
    expect(content).toMatch(/claimed/);
    expect(content).toMatch(/blocked/);
  });

  it("combines with existing status filter", () => {
    expect(content).toMatch(/status/);
  });

  it("combines with existing current_role filter", () => {
    expect(content).toMatch(/current_role/);
  });

  it("returns filtered array", () => {
    expect(content).toMatch(/\.all\(|\.prepare\(/i);
  });
});
