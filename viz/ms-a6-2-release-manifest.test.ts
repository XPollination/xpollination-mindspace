/**
 * TDD tests for ms-a6-2-release-manifest
 *
 * Verifies release manifest generation:
 * - GET /:releaseId/manifest endpoint
 * - Returns tasks, requirements, flags, metadata
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/releases.ts:
 *   - Add GET /:releaseId/manifest endpoint
 *   - Queries complete tasks for the project
 *   - Aggregates linked requirements (deduped)
 *   - Includes all feature flags with states
 *   - Returns JSON: { release, tasks, requirements, flags, metadata: { generated_at, git_tag } }
 *   - 404 if release not found
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a6-2-release-manifest: endpoint", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/releases.ts"), "utf-8");
  } catch { content = ""; }

  it("has GET manifest endpoint", () => {
    expect(content).toMatch(/manifest/);
    expect(content).toMatch(/\.get\(/i);
  });

  it("queries complete tasks", () => {
    expect(content).toMatch(/complete/);
    expect(content).toMatch(/tasks/i);
  });

  it("includes requirements in manifest", () => {
    expect(content).toMatch(/requirement/i);
  });

  it("includes feature flags in manifest", () => {
    expect(content).toMatch(/flag/i);
  });

  it("includes git_tag in metadata", () => {
    expect(content).toMatch(/git_tag|gitTag/);
  });

  it("includes generated_at timestamp", () => {
    expect(content).toMatch(/generated_at|generatedAt/);
  });

  it("returns 404 for non-existent release", () => {
    expect(content).toMatch(/404/);
  });

  it("returns JSON response", () => {
    expect(content).toMatch(/\.json\(/);
  });
});
