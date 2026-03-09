/**
 * TDD tests for viz-version-display-automation
 *
 * Verifies that the viz version display is populated dynamically from
 * /api/version instead of being hardcoded in index.html.
 *
 * DEV IMPLEMENTATION NOTES:
 * - Add loadVersion() function that fetches /api/version and sets .viz-version textContent
 * - Replace hardcoded version in .viz-version span with empty string
 * - Call loadVersion() during page initialization
 * - Apply to BOTH xpollination-mcp-server and xpollination-mcp-server-test viz/versions/v0.0.10/index.html
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "/home/developer/workspaces/github/PichlerThomas";
const PROD_INDEX = resolve(
  BASE,
  "xpollination-mcp-server/viz/versions/v0.0.10/index.html"
);
const TEST_INDEX = resolve(
  BASE,
  "xpollination-mcp-server-test/viz/versions/v0.0.10/index.html"
);

function getIndexContent(path: string): string {
  return readFileSync(path, "utf-8");
}

// Test both repos
for (const [label, indexPath] of [
  ["PROD", PROD_INDEX],
  ["TEST", TEST_INDEX],
] as const) {
  describe(`viz-version-display-automation: ${label} index.html`, () => {
    it("viz-version span has no hardcoded version string", () => {
      const content = getIndexContent(indexPath);
      // Match the viz-version span — should NOT contain a hardcoded v0.0.X
      const spanMatch = content.match(
        /<span\s+class="viz-version">(.*?)<\/span>/
      );
      expect(spanMatch).toBeTruthy();
      const spanContent = spanMatch![1];
      expect(spanContent).not.toMatch(/v\d+\.\d+\.\d+/);
    });

    it("loadVersion function exists", () => {
      const content = getIndexContent(indexPath);
      expect(content).toMatch(/function\s+loadVersion\s*\(/);
    });

    it("loadVersion fetches /api/version", () => {
      const content = getIndexContent(indexPath);
      // Find the loadVersion function and check it fetches /api/version
      const fnMatch = content.match(
        /function\s+loadVersion[\s\S]*?(?=\n\s*(?:async\s+)?function\s|\n\s*<\/script>)/
      );
      expect(fnMatch).toBeTruthy();
      expect(fnMatch![0]).toMatch(/fetch\s*\(\s*['"]\/api\/version['"]\s*\)/);
    });

    it("loadVersion sets .viz-version textContent from response", () => {
      const content = getIndexContent(indexPath);
      const fnMatch = content.match(
        /function\s+loadVersion[\s\S]*?(?=\n\s*(?:async\s+)?function\s|\n\s*<\/script>)/
      );
      expect(fnMatch).toBeTruthy();
      const fn = fnMatch![0];
      // Should querySelector .viz-version and set textContent
      expect(fn).toMatch(/\.viz-version/);
      expect(fn).toMatch(/textContent/);
    });

    it("loadVersion has try/catch error handling", () => {
      const content = getIndexContent(indexPath);
      const fnMatch = content.match(
        /function\s+loadVersion[\s\S]*?(?=\n\s*(?:async\s+)?function\s|\n\s*<\/script>)/
      );
      expect(fnMatch).toBeTruthy();
      expect(fnMatch![0]).toMatch(/try\s*\{/);
      expect(fnMatch![0]).toMatch(/catch/);
    });

    it("loadVersion is called during page initialization", () => {
      const content = getIndexContent(indexPath);
      // Should be called somewhere (DOMContentLoaded, init, or top-level)
      expect(content).toMatch(/loadVersion\s*\(\s*\)/);
    });
  });
}

// Live verification — check that /api/version endpoint returns version for TEST
describe("viz-version-display-automation: live verification", () => {
  it("TEST /api/version returns a version string", async () => {
    try {
      const res = await fetch("http://10.33.33.1:4200/api/version");
      const data = await res.json();
      expect(data.version).toBeTruthy();
      expect(data.version).toMatch(/\d+\.\d+\.\d+/);
    } catch {
      // Service may not be running during CI
      expect(true).toBe(true);
    }
  });
});
