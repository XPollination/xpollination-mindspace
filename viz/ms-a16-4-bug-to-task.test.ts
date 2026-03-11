/**
 * TDD tests for ms-a16-4-bug-to-task
 *
 * Verifies bug → task creation endpoint:
 * - POST /:bugId/create-task converts bug to task
 * - Pre-fills title/description from bug data
 * - Links bug_id, updates bug status to triaged
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/bug-reports.ts:
 *   - POST /:bugId/create-task (admin only)
 *   - Pre-fill title: "Bug: [bug title]"
 *   - Pre-fill description: bug description + steps_to_reproduce
 *   - Task status='pending', role='pdsa'
 *   - Link bug_id in task (may need ALTER TABLE tasks ADD COLUMN bug_id)
 *   - Update bug status to 'triaged'
 *   - Return 201 with { task, bug_id }
 *   - 404 if bug not found
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a16-4-bug-to-task: endpoint", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/bug-reports.ts"), "utf-8");
  } catch { content = ""; }

  it("has POST create-task endpoint", () => {
    expect(content).toMatch(/create-task|createTask/);
    expect(content).toMatch(/\.post\(/i);
  });

  it("pre-fills task title from bug", () => {
    expect(content).toMatch(/Bug:|title/i);
  });

  it("includes bug description in task", () => {
    expect(content).toMatch(/description/);
  });

  it("sets task status to pending", () => {
    expect(content).toMatch(/pending/);
  });

  it("sets task role to pdsa", () => {
    expect(content).toMatch(/pdsa/);
  });

  it("links bug_id to task", () => {
    expect(content).toMatch(/bug_id|bugId/);
  });

  it("updates bug status to triaged", () => {
    expect(content).toMatch(/triaged/);
  });

  it("returns 404 for non-existent bug", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 201 on successful creation", () => {
    expect(content).toMatch(/201/);
  });
});
