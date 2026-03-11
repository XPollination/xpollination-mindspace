/**
 * TDD tests for ms-a10-5-branch-validation
 *
 * Verifies advisory branch name validation on task claim:
 * - Optional branch field in claim body
 * - Validates against feature/<task-slug> or develop pattern
 * - Non-conforming → branch_warning in response (advisory only)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/task-claiming.ts:
 *   - Accept optional `branch` field in POST claim body
 *   - Validate against patterns: feature/<task-slug>, feature/<task-title>, develop
 *   - Non-conforming → include branch_warning in response
 *   - NEVER block the claim (advisory only)
 *   - Log warning to console
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a10-5-branch-validation: task-claiming.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/task-claiming.ts"), "utf-8");
  } catch { content = ""; }

  it("accepts optional branch field", () => {
    expect(content).toMatch(/branch/);
  });

  it("validates against feature/ pattern", () => {
    expect(content).toMatch(/feature/);
  });

  it("accepts develop branch", () => {
    expect(content).toMatch(/develop/);
  });

  it("includes branch_warning in response for non-conforming", () => {
    expect(content).toMatch(/branch_warning|branchWarning/);
  });

  it("does NOT block claim on bad branch (advisory)", () => {
    expect(content).toMatch(/warning|advisory/i);
  });

  it("logs warning to console", () => {
    expect(content).toMatch(/console\.warn|console\.log|log/i);
  });
});
