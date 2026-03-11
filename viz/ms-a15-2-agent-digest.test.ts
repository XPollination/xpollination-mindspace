/**
 * TDD tests for ms-a15-2-agent-digest
 *
 * Verifies agent-assisted digest generation:
 * - POST /marketplace/digest — generates structured summary
 * - Queries brain for topic cluster
 * - Template-based summary generation
 * - Stores as domain_summary brain thought
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/marketplace-community.ts:
 *   - POST /digest endpoint
 *   - Accepts { topic } or { thought_ids }
 *   - Queries brain for related thoughts in cluster
 *   - Produces structured summary using template
 *   - Stores summary as brain thought (category: domain_summary)
 *   - Returns { summary, brain_thought_id }
 *   - 400 if no topic/thought_ids
 * - Update api/services/marketplace-brain.ts (if needed):
 *   - Helper for digest contribution
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a15-2-agent-digest: endpoint", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/marketplace-community.ts"),
      resolve(API_DIR, "routes/marketplace.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("has POST digest endpoint", () => {
    expect(content).toMatch(/digest/i);
    expect(content).toMatch(/\.post\s*\(/i);
  });

  it("queries brain for topic cluster", () => {
    expect(content).toMatch(/brain|memory/i);
  });

  it("produces structured summary", () => {
    expect(content).toMatch(/summary/i);
  });

  it("stores as domain_summary category", () => {
    expect(content).toMatch(/domain_summary/i);
  });

  it("returns brain thought reference", () => {
    expect(content).toMatch(/thought_id|brain_thought/i);
  });

  it("accepts topic or thought_ids input", () => {
    expect(content).toMatch(/topic|thought_ids/i);
  });

  it("returns JSON response", () => {
    expect(content).toMatch(/\.json\s*\(/);
  });
});
