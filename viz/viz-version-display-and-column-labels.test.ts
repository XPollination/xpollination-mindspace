/**
 * TDD tests for viz-version-display-and-column-labels
 *
 * Change A: Version display element in UI
 * Change B: Queue column state sub-labels (grouped by status)
 * Versioning: v0.0.8 created from v0.0.7
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create viz/versions/v0.0.8/ from v0.0.7
 * - Add version label element (class viz-version) in index.html
 * - Add queue group headers (class queue-group-header) in renderKanbanColumns()
 * - Group order: ready → rework → pending
 * - Update changelog.json to v0.0.8
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const VIZ_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/versions"
);

describe("viz-version-display-and-column-labels", () => {
  // --- Versioning: v0.0.8 exists ---
  describe("versioning", () => {
    it("v0.0.8 directory exists", () => {
      expect(existsSync(resolve(VIZ_DIR, "v0.0.8"))).toBe(true);
    });

    it("v0.0.8 has index.html", () => {
      expect(existsSync(resolve(VIZ_DIR, "v0.0.8/index.html"))).toBe(true);
    });

    it("v0.0.8 has server.js", () => {
      expect(existsSync(resolve(VIZ_DIR, "v0.0.8/server.js"))).toBe(true);
    });

    it("v0.0.8 changelog.json says v0.0.8", () => {
      const changelog = JSON.parse(
        readFileSync(resolve(VIZ_DIR, "v0.0.8/changelog.json"), "utf-8")
      );
      expect(changelog.version).toBe("v0.0.8");
    });
  });

  // --- Change A: Version display ---
  describe("Change A: version display", () => {
    it("index.html contains a viz-version element", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      expect(html).toMatch(/class=["'].*viz-version.*["']/);
    });

    it("version element shows v0.0.8", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      expect(html).toMatch(/v0\.0\.8/);
    });

    it("viz-version has CSS styling (small, muted)", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      // Should have CSS for .viz-version with small font
      expect(html).toMatch(/\.viz-version\s*\{[^}]*font-size/);
    });
  });

  // --- Change B: Queue column state sub-labels ---
  describe("Change B: queue column sub-labels", () => {
    it("index.html contains queue-group-header class", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      expect(html).toMatch(/queue-group-header/);
    });

    it("queue-group-header has CSS styling", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      expect(html).toMatch(/\.queue-group-header\s*\{[^}]*font-size/);
    });

    it("groups are ordered: ready, rework, pending", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      // The group order should be defined in JS
      expect(html).toMatch(/['"]ready['"].*['"]rework['"].*['"]pending['"]/s);
    });

    it("rendering logic groups columnNodes by status for queue column", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      // Should have grouping logic (checking for status grouping in queue column)
      expect(html).toMatch(/queue.*group|group.*queue/is);
    });
  });

  // --- Non-regression: v0.0.7 unchanged ---
  describe("non-regression", () => {
    it("v0.0.7 index.html is unchanged (no queue-group-header)", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.7/index.html"), "utf-8");
      expect(html).not.toMatch(/queue-group-header/);
    });
  });
});
