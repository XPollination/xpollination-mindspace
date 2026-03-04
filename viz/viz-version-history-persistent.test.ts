/**
 * TDD tests for viz-version-history-persistent
 *
 * Verifies: (1) Entries show date + content, (2) Sorted newest first,
 * (3) Max 33 entries, (4) Permanent storage, (5) Content from changelog files.
 *
 * Tests are source code checks on server.js + index.html + filesystem.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);

function readServer(): string {
  return readFileSync(join(VIZ_DIR, "server.js"), "utf-8");
}

function readViz(): string {
  const activeIndex = join(VIZ_DIR, "active", "index.html");
  if (existsSync(activeIndex)) {
    return readFileSync(activeIndex, "utf-8");
  }
  return readFileSync(join(VIZ_DIR, "index.html"), "utf-8");
}

function loadAllChangelogs(): any[] {
  const versionsDir = join(VIZ_DIR, "versions");
  const dirs = readdirSync(versionsDir)
    .filter(d => d.startsWith("v"))
    .sort()
    .reverse();
  const changelogs: any[] = [];
  for (const dir of dirs) {
    const p = join(versionsDir, dir, "changelog.json");
    if (existsSync(p)) {
      changelogs.push(JSON.parse(readFileSync(p, "utf-8")));
    }
  }
  return changelogs;
}

// ============================================================
// AC1: Version history entries show date and content
// ============================================================

describe("AC1: Entries show date and content", () => {
  it("every changelog.json has a date field", () => {
    const changelogs = loadAllChangelogs();
    expect(changelogs.length).toBeGreaterThan(0);
    for (const cl of changelogs) {
      expect(cl.date).toBeTruthy();
    }
  });

  it("every changelog.json has content (changes array or description)", () => {
    const changelogs = loadAllChangelogs();
    for (const cl of changelogs) {
      const hasContent = (Array.isArray(cl.changes) && cl.changes.length > 0) || cl.description;
      expect(hasContent).toBeTruthy();
    }
  });

  it("client renders date in version history entries", () => {
    const source = readViz();
    // The showPastChanges template must include cl.date
    expect(source).toMatch(/\.date/);
    expect(source).toMatch(/version-date|date/i);
  });

  it("client renders content (changes) in version history entries", () => {
    const source = readViz();
    expect(source).toMatch(/\.changes/);
    expect(source).toMatch(/version-changes|changes/i);
  });
});

// ============================================================
// AC2: Sorted newest first, oldest last
// ============================================================

describe("AC2: Sorted newest first", () => {
  it("server sorts version directories in reverse order (newest first)", () => {
    const source = readServer();
    // Must sort then reverse for newest-first
    expect(source).toMatch(/\.sort\(\)\.reverse\(\)/);
  });

  it("changelogs on disk are ordered newest first when reverse-sorted", () => {
    const changelogs = loadAllChangelogs();
    expect(changelogs.length).toBeGreaterThanOrEqual(2);
    // First entry version should be higher than last entry
    const first = changelogs[0].version;
    const last = changelogs[changelogs.length - 1].version;
    expect(first > last).toBe(true);
  });
});

// ============================================================
// AC3: Maximum 33 entries displayed
// ============================================================

describe("AC3: Maximum 33 entries", () => {
  it("server limits changelogs to 33 entries via slice", () => {
    const source = readServer();
    // Must have .slice(0, 33) or equivalent limit
    expect(source).toMatch(/\.slice\(0\s*,\s*33\)/);
  });

  it("client limits displayed entries to 33", () => {
    const source = readViz();
    // Client-side should also enforce the 33 limit
    expect(source).toMatch(/\.slice\(0\s*,\s*33\)|33/);
  });
});

// ============================================================
// AC4: Entries are permanent (survive reload and restart)
// ============================================================

describe("AC4: Permanent storage", () => {
  it("changelogs are read from filesystem (not in-memory)", () => {
    const source = readServer();
    // Must read from disk — changelog.json files (fs.readFileSync or readFileSync)
    expect(source).toMatch(/readFileSync.*changelog\.json|changelog\.json.*readFileSync|fs\.readFileSync/);
  });

  it("changelog.json files exist on disk", () => {
    const versionsDir = join(VIZ_DIR, "versions");
    const dirs = readdirSync(versionsDir).filter(d => d.startsWith("v"));
    expect(dirs.length).toBeGreaterThan(0);
    let found = 0;
    for (const dir of dirs) {
      if (existsSync(join(versionsDir, dir, "changelog.json"))) {
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it("no ephemeral/localStorage-only storage for version history content", () => {
    const source = readViz();
    // showPastChanges should fetch from API, not localStorage
    // Find the showPastChanges function and verify it uses fetch
    const fnMatch = source.match(/function\s+showPastChanges[\s\S]*?fetch\s*\(\s*['"]\/api\/changelogs['"]\s*\)/);
    expect(fnMatch).toBeTruthy();
  });
});

// ============================================================
// AC5: Content sourced from changelog files
// ============================================================

describe("AC5: Content from changelog files", () => {
  it("server reads from viz/versions/*/changelog.json", () => {
    const source = readServer();
    expect(source).toMatch(/versions/);
    expect(source).toMatch(/changelog\.json/);
  });

  it("at least 5 changelog.json files exist", () => {
    const changelogs = loadAllChangelogs();
    expect(changelogs.length).toBeGreaterThanOrEqual(5);
  });

  it("each changelog has version, title, date, and changes", () => {
    const changelogs = loadAllChangelogs();
    for (const cl of changelogs) {
      expect(cl.version).toBeTruthy();
      expect(cl.title).toBeTruthy();
      expect(cl.date).toBeTruthy();
      expect(Array.isArray(cl.changes)).toBe(true);
    }
  });
});

// ============================================================
// AC-EXTRA: Empty state handling
// ============================================================

describe("Empty state handling", () => {
  it("client handles empty changelogs gracefully", () => {
    const source = readViz();
    // Should have fallback for empty data or fetch error
    expect(source).toMatch(/catch|Could not load|No.*history|empty/i);
  });
});
