/**
 * TDD tests for viz-complete-column-improvements v0.0.2
 *
 * Verifies: Version deployment process fix — DEV must NOT modify the active version.
 * (1) v0.0.5 exists with accumulated changes,
 * (2) v0.0.4 reverted to Thomas-approved state (b809fff),
 * (3) Active symlink stays on v0.0.4,
 * (4) v0.0.5/changelog.json exists.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, lstatSync, readlinkSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);

function readVersion(version: string): string {
  const path = join(VIZ_DIR, "versions", version, "index.html");
  return readFileSync(path, "utf-8");
}

// ============================================================
// AC1: v0.0.5 exists with all accumulated changes
// ============================================================

describe("AC1: v0.0.5 directory exists with accumulated changes", () => {
  it("v0.0.5 directory exists", () => {
    const v5Dir = join(VIZ_DIR, "versions", "v0.0.5");
    expect(existsSync(v5Dir)).toBe(true);
  });

  it("v0.0.5/index.html exists", () => {
    const v5Index = join(VIZ_DIR, "versions", "v0.0.5", "index.html");
    expect(existsSync(v5Index)).toBe(true);
  });

  it("v0.0.5 has complete column sort code", () => {
    const source = readVersion("v0.0.5");
    // Must have sort on complete tasks by date
    const hasSortOnComplete = source.match(/sort.*updated_at|sort.*completed|complete.*\.sort/is);
    expect(hasSortOnComplete).toBeTruthy();
  });

  it("v0.0.5 has time filter buttons", () => {
    const source = readVersion("v0.0.5");
    // Must have time filter: 1d, 1w, 1m, All
    expect(source).toMatch(/1d|1w|1m|All/);
  });

  it("v0.0.5 has timestamp display in detail panel", () => {
    const source = readVersion("v0.0.5");
    // Must show Created/Updated timestamps in showDetail
    const detailArea = source.match(/showDetail[\s\S]*?(?=function\s|$)/);
    if (detailArea) {
      expect(detailArea[0]).toMatch(/created_at|Created/i);
    } else {
      expect(source).toMatch(/formatDate|toLocaleString/);
    }
  });

  it("v0.0.5 has changelog_ref in detail panel", () => {
    const source = readVersion("v0.0.5");
    // changelog_ref should be in v0.0.5 (accumulated from commit 15a5fd1)
    expect(source).toMatch(/changelog_ref/);
  });
});

// ============================================================
// AC2: v0.0.4 reverted to Thomas-approved state
// ============================================================

describe("AC2: v0.0.4 reverted to Thomas-approved state (b809fff)", () => {
  it("v0.0.4/index.html exists", () => {
    const v4Index = join(VIZ_DIR, "versions", "v0.0.4", "index.html");
    expect(existsSync(v4Index)).toBe(true);
  });

  it("v0.0.4 does NOT have complete column sort code", () => {
    const source = readVersion("v0.0.4");
    // Thomas-approved v0.0.4 was light mode CSS only — no sort on complete
    const hasSortOnComplete = source.match(/complete.*\.sort|\.sort\(.*complete/is);
    expect(hasSortOnComplete).toBeFalsy();
  });

  it("v0.0.4 does NOT have time filter buttons (1d/1w/1m/All)", () => {
    const source = readVersion("v0.0.4");
    // No time filter in Thomas-approved v0.0.4
    const hasTimeFilter = source.match(/completeFilter|completeTimeFilter|1d.*1w.*1m/is);
    expect(hasTimeFilter).toBeFalsy();
  });

  it("v0.0.4 does NOT have changelog_ref in detail panel", () => {
    const source = readVersion("v0.0.4");
    // changelog_ref was added in commit 15a5fd1, after b809fff
    expect(source).not.toMatch(/changelog_ref/);
  });
});

// ============================================================
// AC3: Active symlink stays on v0.0.4
// ============================================================

describe("AC3: Active symlink points to v0.0.4", () => {
  it("viz/active is a symlink", () => {
    const activePath = join(VIZ_DIR, "active");
    expect(existsSync(activePath)).toBe(true);
    expect(lstatSync(activePath).isSymbolicLink()).toBe(true);
  });

  it("viz/active points to versions/v0.0.4", () => {
    const activePath = join(VIZ_DIR, "active");
    const target = readlinkSync(activePath);
    expect(target).toMatch(/v0\.0\.4/);
  });

  it("active version does NOT have complete column improvements", () => {
    // The version Thomas sees should NOT have the new features yet
    const activeIndex = join(VIZ_DIR, "active", "index.html");
    const source = readFileSync(activeIndex, "utf-8");
    const hasCompleteSort = source.match(/completeFilter|completeTimeFilter/is);
    expect(hasCompleteSort).toBeFalsy();
  });
});

// ============================================================
// AC4: Changelog exists for v0.0.5
// ============================================================

describe("AC4: v0.0.5 changelog.json exists", () => {
  it("v0.0.5/changelog.json exists", () => {
    const changelogPath = join(VIZ_DIR, "versions", "v0.0.5", "changelog.json");
    expect(existsSync(changelogPath)).toBe(true);
  });

  it("changelog.json has content (not empty)", () => {
    const changelogPath = join(VIZ_DIR, "versions", "v0.0.5", "changelog.json");
    const content = readFileSync(changelogPath, "utf-8");
    expect(content.length).toBeGreaterThan(10);
    // Should be valid JSON
    expect(() => JSON.parse(content)).not.toThrow();
  });
});
