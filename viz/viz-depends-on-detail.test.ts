/**
 * TDD tests for viz-depends-on-detail
 *
 * Change A: depends_on section in task detail panel
 * Change B: Queue column filter toggles (All/Ready/Pending/Rework)
 * Versioning: v0.0.9 created from v0.0.8
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create viz/versions/v0.0.9/ from v0.0.8
 * - In showDetail(): add Dependencies section reading dna.depends_on
 * - Show status badge per dependency, clickable if node exists
 * - Add queue-filter-btn buttons at top of Queue column
 * - Store filter state in localStorage
 * - Update changelog.json to v0.0.9
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const VIZ_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/versions"
);

describe("viz-depends-on-detail", () => {
  // --- Versioning: v0.0.9 exists ---
  describe("versioning", () => {
    it("v0.0.9 directory exists", () => {
      expect(existsSync(resolve(VIZ_DIR, "v0.0.9"))).toBe(true);
    });

    it("v0.0.9 has index.html", () => {
      expect(existsSync(resolve(VIZ_DIR, "v0.0.9/index.html"))).toBe(true);
    });

    it("v0.0.9 has server.js", () => {
      expect(existsSync(resolve(VIZ_DIR, "v0.0.9/server.js"))).toBe(true);
    });

    it("v0.0.9 changelog.json says v0.0.9", () => {
      const changelog = JSON.parse(
        readFileSync(resolve(VIZ_DIR, "v0.0.9/changelog.json"), "utf-8")
      );
      expect(changelog.version).toBe("v0.0.9");
    });
  });

  // --- Change A: depends_on in detail panel ---
  describe("Change A: depends_on detail section", () => {
    it("index.html contains depends_on rendering logic", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      expect(html).toMatch(/depends_on/);
    });

    it("shows Dependencies label in detail", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      expect(html).toMatch(/Dependencies/);
    });

    it("renders status badges for dependencies", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      // Should have badge with status class for dependency items
      expect(html).toMatch(/status-.*badge|badge.*status-/s);
    });

    it("handles unknown slugs gracefully (shows unknown status)", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      expect(html).toMatch(/unknown/i);
    });

    it("dependencies are clickable (data-id or onclick)", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      // Clickable dependency items should have data-id or click handler
      expect(html).toMatch(/data-id|onclick.*detail|showDetail/);
    });
  });

  // --- Change B: Queue column filter toggles ---
  describe("Change B: queue filter toggles", () => {
    it("has queue-filter-btn class", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      expect(html).toMatch(/queue-filter-btn/);
    });

    it("has filter buttons for All, Ready, Pending, Rework", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      // All four filter options should be present
      expect(html).toMatch(/data-filter=["']all["']/);
      expect(html).toMatch(/data-filter=["']ready["']/);
      expect(html).toMatch(/data-filter=["']pending["']/);
      expect(html).toMatch(/data-filter=["']rework["']/);
    });

    it("has CSS for queue-filter-btn", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      expect(html).toMatch(/\.queue-filter-btn\s*\{/);
    });

    it("has active-filter class for selected state", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      expect(html).toMatch(/active-filter/);
    });

    it("uses localStorage for filter persistence", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.9/index.html"), "utf-8");
      expect(html).toMatch(/localStorage.*queue.*filter|queue.*filter.*localStorage/is);
    });
  });

  // --- Non-regression: v0.0.8 unchanged ---
  describe("non-regression", () => {
    it("v0.0.8 index.html has no queue-filter-btn", () => {
      const html = readFileSync(resolve(VIZ_DIR, "v0.0.8/index.html"), "utf-8");
      expect(html).not.toMatch(/queue-filter-btn/);
    });
  });
});
