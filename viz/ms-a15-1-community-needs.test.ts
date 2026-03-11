/**
 * TDD tests for ms-a15-1-community-needs
 *
 * Verifies community needs aggregation endpoint:
 * - GET /api/marketplace/community-needs
 * - Queries brain for feature request thoughts
 * - Groups by similarity, returns frequency counts
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create or update api/routes/marketplace-community.ts (or marketplace.ts):
 *   - GET /community-needs endpoint
 *   - Queries brain API for feature_request thoughts
 *   - Groups by topic/similarity
 *   - Returns [{need, count, thought_ids}] sorted by count desc
 *   - Optional 5-min TTL cache
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a15-1-community-needs: endpoint", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/marketplace-community.ts"),
      resolve(API_DIR, "routes/marketplace.ts"),
      resolve(API_DIR, "routes/community-needs.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("community needs route file exists", () => {
    const paths = [
      resolve(API_DIR, "routes/marketplace-community.ts"),
      resolve(API_DIR, "routes/marketplace.ts"),
      resolve(API_DIR, "routes/community-needs.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  it("has GET community-needs endpoint", () => {
    expect(content).toMatch(/community.?needs/i);
    expect(content).toMatch(/\.get\(/i);
  });

  it("queries brain API for feature requests", () => {
    expect(content).toMatch(/brain|memory|feature.?request/i);
  });

  it("groups results by similarity or topic", () => {
    expect(content).toMatch(/group|similar|topic/i);
  });

  it("returns count/frequency", () => {
    expect(content).toMatch(/count|frequency/i);
  });

  it("returns JSON array response", () => {
    expect(content).toMatch(/\.json\(/);
  });
});
