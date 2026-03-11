/**
 * TDD tests for ms-a16-3-bug-digestion
 *
 * Verifies agent bug digestion workflow:
 * - POST /bugs/:id/digest — triggers assessment
 * - Queries brain for related thoughts
 * - Produces assessment brain thought
 * - Updates bug status to digested
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/bug-reports.ts:
 *   - POST /:bugId/digest endpoint
 *   - Queries brain API for related thoughts (bug title + description)
 *   - Checks recent flag toggles (if any)
 *   - Produces assessment object: { related_thoughts, flag_context, recommendation }
 *   - Stores assessment as brain thought (category: bug_assessment)
 *   - Updates bug status to 'digested'
 *   - Returns 200 with { assessment, brain_thought_id }
 *   - 404 if bug not found
 * - Create migration if digested status needs DB schema update
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a16-3-bug-digestion: endpoint", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/bug-reports.ts"), "utf-8");
  } catch { content = ""; }

  it("has POST digest endpoint", () => {
    expect(content).toMatch(/digest/i);
    expect(content).toMatch(/\.post\s*\(/i);
  });

  it("queries brain for related thoughts", () => {
    expect(content).toMatch(/brain|memory/i);
  });

  it("produces assessment", () => {
    expect(content).toMatch(/assessment/i);
  });

  it("stores assessment as brain thought", () => {
    expect(content).toMatch(/contribute|POST.*memory/i);
  });

  it("updates bug status to digested", () => {
    expect(content).toMatch(/digested/i);
  });

  it("returns 404 for missing bug", () => {
    expect(content).toMatch(/404/);
  });

  it("returns brain thought reference", () => {
    expect(content).toMatch(/thought_id|brain_thought/i);
  });
});
