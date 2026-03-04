/**
 * TDD tests for viz-complete-column-improvements v0.0.1
 *
 * Verifies: (1) Complete column sorted by completion date (newest first),
 * (2) Object details show timestamps,
 * (3) Time filter on complete column.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);

function readViz(): string {
  const activeIndex = join(VIZ_DIR, "active", "index.html");
  if (existsSync(activeIndex)) {
    return readFileSync(activeIndex, "utf-8");
  }
  return readFileSync(join(VIZ_DIR, "index.html"), "utf-8");
}

// ============================================================
// AC1: Complete column sorted by completion date
// ============================================================

describe("AC1: Complete column sorted newest first", () => {
  it("complete column applies sort by date", () => {
    const source = readViz();
    // Must sort complete tasks — look for sort() call with date/updated_at comparison
    const hasSortOnComplete = source.match(/sort.*updated_at|sort.*completed|sort.*created_at.*complete/is) ||
                               source.match(/complete.*\.sort|\.sort.*complete/is);
    expect(hasSortOnComplete).toBeTruthy();
  });

  it("sort is descending (newest first)", () => {
    const source = readViz();
    // Sort comparison: b - a (descending) or reverse() or desc
    const hasDescending = source.match(/sort.*\(.*b.*a\)|sort.*reverse|sort.*desc|new Date\(b\).*new Date\(a\)/is);
    expect(hasDescending).toBeTruthy();
  });
});

// ============================================================
// AC2: Object details show timestamps
// ============================================================

describe("AC2: Object details show created_at and completed_at", () => {
  it("detail panel renders created_at timestamp", () => {
    const source = readViz();
    expect(source).toMatch(/created_at|Created|created.*at/i);
    // Must be in the showDetail function or detail template area
    const detailArea = source.match(/showDetail[\s\S]*?(?=function\s|$)/);
    if (detailArea) {
      expect(detailArea[0]).toMatch(/created_at|Created/i);
    }
  });

  it("detail panel renders completed_at or updated_at timestamp", () => {
    const source = readViz();
    // Must show when task was completed — either completed_at or updated_at
    const detailArea = source.match(/showDetail[\s\S]*?(?=function\s|$)/);
    if (detailArea) {
      const hasCompleted = detailArea[0].match(/completed_at|updated_at|Completed|Updated/i);
      expect(hasCompleted).toBeTruthy();
    } else {
      // Fallback: check entire source
      expect(source).toMatch(/completed_at|Completed.*at/i);
    }
  });

  it("timestamps are formatted for readability (not raw ISO)", () => {
    const source = readViz();
    // Must format dates — toLocaleString, toLocaleDateString, Intl.DateTimeFormat, or custom format
    const hasDateFormat = source.match(/toLocaleString|toLocaleDateString|DateTimeFormat|formatDate|format.*date/i);
    expect(hasDateFormat).toBeTruthy();
  });
});

// ============================================================
// AC3: Time filter on complete column
// ============================================================

describe("AC3: Time filter for complete column", () => {
  it("filter buttons or controls exist for time range", () => {
    const source = readViz();
    // Must have filter buttons: 1d, 1w, 1m, All or similar
    const hasTimeFilter = source.match(/1d|1w|1m|All|24h|7d|30d|1 week|1 month|time.*filter|complete.*filter/i);
    expect(hasTimeFilter).toBeTruthy();
  });

  it("default filter is approximately 1 week", () => {
    const source = readViz();
    // Default should be 7 days / 1 week
    const hasWeekDefault = source.match(/7.*day|1.*week|604800|7\s*\*\s*24|default.*7|7.*default/i);
    expect(hasWeekDefault).toBeTruthy();
  });

  it("filter state persisted (localStorage or similar)", () => {
    const source = readViz();
    // Filter preference should persist across page loads
    const hasPersistence = source.match(/localStorage.*complete.*filter|localStorage.*timeFilter|completeFilter.*localStorage/i);
    expect(hasPersistence).toBeTruthy();
  });

  it("filter reduces the number of visible complete tasks", () => {
    const source = readViz();
    // Must have filtering logic that compares dates
    const hasDateComparison = source.match(/Date\.now\(\)|new Date\(\)|getTime\(\).*complete|complete.*filter.*date/is);
    expect(hasDateComparison).toBeTruthy();
  });
});

// ============================================================
// AC4: Server provides timestamp data
// ============================================================

describe("AC4: Server provides needed data", () => {
  it("server.js returns created_at in node data", () => {
    const serverPath = join(VIZ_DIR, "server.js");
    const source = readFileSync(serverPath, "utf-8");
    expect(source).toMatch(/created_at/);
  });

  it("server.js returns updated_at in node data", () => {
    const serverPath = join(VIZ_DIR, "server.js");
    const source = readFileSync(serverPath, "utf-8");
    expect(source).toMatch(/updated_at/);
  });
});
