/**
 * TDD tests for viz-dependency-badge-colors
 *
 * Bug fix: dependency status badge colors unreadable in detail panel.
 * Creates v0.0.10 with darkened backgrounds and explicit color:#fff.
 *
 * DEV IMPLEMENTATION NOTES:
 * - Copy v0.0.9 to v0.0.10: cp -r viz/versions/v0.0.9 viz/versions/v0.0.10
 * - Modify badge CSS in v0.0.10/index.html (lines ~551-563)
 * - All 13 badge classes must have explicit color: #fff
 * - Darken backgrounds: green→#166534, teal→#115e59, amber→#92400e, purple→#5b21b6, red→#991b1b
 * - Update changelog.json with v0.0.10 entry
 * - Deploy ONLY to test (4200), NOT production (8080)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIZ_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/versions"
);
const V10_DIR = resolve(VIZ_DIR, "v0.0.10");
const V9_DIR = resolve(VIZ_DIR, "v0.0.9");

// All 13 status badge classes
const STATUS_CLASSES = [
  "status-pending",
  "status-ready",
  "status-active",
  "status-testing",
  "status-review",
  "status-rework",
  "status-complete",
  "status-done",
  "status-completed",
  "status-blocked",
  "status-cancelled",
  "status-approval",
  "status-approved",
];

// PDSA-specified darkened colors (WCAG AA compliant with white text)
const EXPECTED_COLORS: Record<string, string> = {
  "status-pending": "#6b7280",
  "status-ready": "#3b82f6",
  "status-active": "#166534",
  "status-testing": "#065f46",
  "status-review": "#92400e",
  "status-rework": "#991b1b",
  "status-complete": "#115e59",
  "status-done": "#115e59",
  "status-completed": "#115e59",
  "status-blocked": "#991b1b",
  "status-cancelled": "#6b7280",
  "status-approval": "#92400e",
  "status-approved": "#5b21b6",
};

describe("viz-dependency-badge-colors", () => {
  // --- v0.0.10 exists ---
  describe("version directory", () => {
    it("v0.0.10 directory exists", () => {
      expect(existsSync(V10_DIR)).toBe(true);
    });

    it("v0.0.10/index.html exists", () => {
      expect(existsSync(resolve(V10_DIR, "index.html"))).toBe(true);
    });
  });

  // --- Requirement 1: All 13 badge classes have explicit color: #fff ---
  describe("explicit white text color", () => {
    for (const cls of STATUS_CLASSES) {
      it(`${cls} has explicit color: #fff`, () => {
        const html = readFileSync(resolve(V10_DIR, "index.html"), "utf-8");
        // Match .badge.status-X { ... color: #fff ... }
        const regex = new RegExp(
          `\\.badge\\.${cls}\\s*\\{[^}]*color:\\s*#fff[^}]*\\}`
        );
        expect(html).toMatch(regex);
      });
    }
  });

  // --- Requirement 2: Darkened background colors per PDSA ---
  describe("darkened background colors", () => {
    for (const [cls, color] of Object.entries(EXPECTED_COLORS)) {
      it(`${cls} background is ${color}`, () => {
        const html = readFileSync(resolve(V10_DIR, "index.html"), "utf-8");
        const regex = new RegExp(
          `\\.badge\\.${cls}\\s*\\{[^}]*background:\\s*${color.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}`
        );
        expect(html).toMatch(regex);
      });
    }
  });

  // --- Requirement 3: v0.0.9 unchanged ---
  describe("production unchanged", () => {
    it("v0.0.9 still exists", () => {
      expect(existsSync(V9_DIR)).toBe(true);
    });

    it("v0.0.9 badge CSS does NOT have darkened colors", () => {
      const html = readFileSync(resolve(V9_DIR, "index.html"), "utf-8");
      // v0.0.9 should still have the original lighter colors
      expect(html).toMatch(/\.badge\.status-active\s*\{[^}]*background:\s*#22c55e/);
    });
  });

  // --- Changelog ---
  describe("changelog", () => {
    it("v0.0.10 changelog.json exists", () => {
      expect(existsSync(resolve(V10_DIR, "changelog.json"))).toBe(true);
    });

    it("changelog mentions badge color fix", () => {
      const changelog = readFileSync(
        resolve(V10_DIR, "changelog.json"),
        "utf-8"
      );
      expect(changelog).toMatch(/badge.*color|color.*badge|contrast/i);
    });
  });
});
