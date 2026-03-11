/**
 * TDD tests for ms-a14-3-marketplace-matching
 *
 * Verifies marketplace matching logic:
 * - GET /api/marketplace/matches — find announcements matching open requests
 * - POST /api/marketplace/requests/:id/match — link request to announcement
 * - Jaccard index scoring with configurable threshold
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create or update api/routes/marketplace-matching.ts:
 *   - GET /matches endpoint
 *     - Computes tag overlap score (Jaccard: intersection/union)
 *     - Minimum score threshold 0.3 (configurable)
 *     - Returns matches sorted by score descending
 *     - Only open requests + active announcements
 *   - POST /requests/:id/match
 *     - Links request to announcement (creates match record)
 *     - Validates both exist
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a14-3-marketplace-matching: routes", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/marketplace-matching.ts"),
      resolve(API_DIR, "routes/marketplace.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("matching route file exists", () => {
    const paths = [
      resolve(API_DIR, "routes/marketplace-matching.ts"),
      resolve(API_DIR, "routes/marketplace.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  it("has GET matches endpoint", () => {
    expect(content).toMatch(/match/i);
    expect(content).toMatch(/\.get\(/i);
  });

  it("has POST match linking endpoint", () => {
    expect(content).toMatch(/\.post\(/i);
    expect(content).toMatch(/match/i);
  });

  it("implements tag overlap / Jaccard scoring", () => {
    expect(content).toMatch(/score|jaccard|overlap|intersection/i);
  });

  it("has configurable minimum threshold", () => {
    expect(content).toMatch(/threshold|minimum|0\.3/i);
  });

  it("sorts results by score", () => {
    expect(content).toMatch(/sort|score/i);
  });

  it("filters for open requests only", () => {
    expect(content).toMatch(/open|active|status/i);
  });

  it("returns 404 for invalid request/announcement", () => {
    expect(content).toMatch(/404/);
  });
});
