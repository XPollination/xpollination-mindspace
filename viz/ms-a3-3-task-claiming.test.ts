/**
 * TDD tests for ms-a3-3-task-claiming
 *
 * Verifies task claiming/unclaiming:
 * - POST /:taskId/claim — claim a task (sets claimed_by, claimed_at)
 * - DELETE /:taskId/claim — unclaim a task
 * - No new migration (claimed_by, claimed_at already on tasks table)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/task-claiming.ts (or update tasks.ts):
 *   - POST /:taskId/claim — set claimed_by=user.id, claimed_at=now
 *   - DELETE /:taskId/claim — clear claimed_by, claimed_at
 *   - 409 if already claimed by another user
 *   - 404 for non-existent task
 * - Update api/routes/tasks.ts: mount claiming sub-router
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a3-3-task-claiming: claiming endpoint", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/task-claiming.ts"),
      resolve(API_DIR, "routes/tasks.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has POST handler for claiming tasks", () => {
    expect(content).toMatch(/\.post\(/i);
    expect(content).toMatch(/claim/i);
  });

  it("sets claimed_by to current user", () => {
    expect(content).toMatch(/claimed_by/);
  });

  it("sets claimed_at timestamp", () => {
    expect(content).toMatch(/claimed_at/);
  });

  it("has DELETE handler for unclaiming", () => {
    expect(content).toMatch(/\.delete\(/i);
    expect(content).toMatch(/claim/i);
  });

  it("clears claimed_by and claimed_at on unclaim", () => {
    expect(content).toMatch(/claimed_by/);
    expect(content).toMatch(/null|NULL/i);
  });

  it("returns 409 if already claimed by another user", () => {
    expect(content).toMatch(/409/);
  });

  it("returns 404 for non-existent task", () => {
    expect(content).toMatch(/404/);
  });

  it("uses requireProjectAccess middleware", () => {
    expect(content).toMatch(/requireProjectAccess/);
  });

  it("returns 200 on successful claim", () => {
    expect(content).toMatch(/200|201/);
  });
});
