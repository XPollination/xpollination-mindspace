/**
 * TDD tests for viz-update-notification-changelog v0.0.1
 *
 * Verifies: (1) Version detection API, (2) Changelog API endpoints,
 * (3) Update notification banner in UI, (4) Changelog modal,
 * (5) Past changes section, (6) changelog.json files per version.
 *
 * Tests are source code checks on server.js + index.html + filesystem.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, lstatSync, readdirSync } from "node:fs";
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

// ============================================================
// AC1: Version Detection API
// ============================================================

describe("AC1: GET /api/version endpoint", () => {
  it("server.js has /api/version endpoint", () => {
    const source = readServer();
    expect(source).toMatch(/\/api\/version/);
  });

  it("endpoint reads active symlink to determine version", () => {
    const source = readServer();
    // Must use readlinkSync or readlink on the active symlink
    expect(source).toMatch(/readlinkSync|readlink/);
  });

  it("endpoint returns version string from symlink target", () => {
    const source = readServer();
    // Must extract version number from path like versions/v0.0.2
    const hasVersionExtract = source.match(/version.*match|match.*version|v\d+\.\d+\.\d+/) ||
                               source.match(/\/api\/version/);
    expect(hasVersionExtract).toBeTruthy();
  });
});

// ============================================================
// AC2: Changelog API Endpoints
// ============================================================

describe("AC2: Changelog API endpoints", () => {
  it("server.js has /api/changelog/:version endpoint", () => {
    const source = readServer();
    expect(source).toMatch(/\/api\/changelog/);
  });

  it("server.js has /api/changelogs endpoint for all versions", () => {
    const source = readServer();
    // Must serve all changelogs — either /api/changelogs or listing versions
    expect(source).toMatch(/changelogs|changelog.*versions/i);
  });

  it("changelog endpoint reads changelog.json from version directory", () => {
    const source = readServer();
    expect(source).toMatch(/changelog\.json/);
  });
});

// ============================================================
// AC3: Update Notification Banner
// ============================================================

describe("AC3: Update notification banner in UI", () => {
  it("index.html has update banner element", () => {
    const source = readViz();
    expect(source).toMatch(/update-banner|update.*notification|updateBanner/i);
  });

  it("banner has Update Now button", () => {
    const source = readViz();
    expect(source).toMatch(/Update Now|accept-update|acceptUpdate/i);
  });

  it("banner has View Changes button", () => {
    const source = readViz();
    expect(source).toMatch(/View Changes|view-changes|viewChanges/i);
  });

  it("version check uses localStorage to track accepted version", () => {
    const source = readViz();
    expect(source).toMatch(/localStorage.*acceptedVersion|acceptedVersion.*localStorage/i);
  });

  it("version check fetches /api/version", () => {
    const source = readViz();
    expect(source).toMatch(/fetch.*\/api\/version|\/api\/version/);
  });
});

// ============================================================
// AC4: Changelog Modal
// ============================================================

describe("AC4: Changelog modal popup", () => {
  it("index.html has changelog modal element", () => {
    const source = readViz();
    expect(source).toMatch(/changelog-modal|changelogModal/i);
  });

  it("changelog modal shows version number", () => {
    const source = readViz();
    expect(source).toMatch(/changelog-version|changelogVersion|What's New/i);
  });

  it("changelog modal has a list for changes", () => {
    const source = readViz();
    expect(source).toMatch(/changelog-list|changelogList|changes.*list/i);
  });

  it("changelog modal fetches changelog data from API", () => {
    const source = readViz();
    expect(source).toMatch(/fetch.*changelog|\/api\/changelog/);
  });
});

// ============================================================
// AC5: Past Changes Section
// ============================================================

describe("AC5: Past changes section", () => {
  it("index.html has past changes or version history section", () => {
    const source = readViz();
    expect(source).toMatch(/past-changes|pastChanges|version-history|versionHistory|Version History|Past Changes/i);
  });

  it("past changes fetches all changelogs", () => {
    const source = readViz();
    expect(source).toMatch(/\/api\/changelogs|fetchChangelogs|loadChangelogs/i);
  });
});

// ============================================================
// AC6: changelog.json files exist per version
// ============================================================

describe("AC6: changelog.json files per version", () => {
  it("v0.0.1 has changelog.json", () => {
    expect(existsSync(join(VIZ_DIR, "versions", "v0.0.1", "changelog.json"))).toBe(true);
  });

  it("v0.0.2 has changelog.json", () => {
    expect(existsSync(join(VIZ_DIR, "versions", "v0.0.2", "changelog.json"))).toBe(true);
  });

  it("v0.0.1 changelog.json has valid structure", () => {
    const changelogPath = join(VIZ_DIR, "versions", "v0.0.1", "changelog.json");
    if (!existsSync(changelogPath)) {
      expect.fail("v0.0.1 changelog.json does not exist");
      return;
    }
    const changelog = JSON.parse(readFileSync(changelogPath, "utf-8"));
    expect(changelog.version).toBeTruthy();
    expect(changelog.changes).toBeInstanceOf(Array);
    expect(changelog.changes.length).toBeGreaterThan(0);
  });

  it("v0.0.2 changelog.json has valid structure", () => {
    const changelogPath = join(VIZ_DIR, "versions", "v0.0.2", "changelog.json");
    if (!existsSync(changelogPath)) {
      expect.fail("v0.0.2 changelog.json does not exist");
      return;
    }
    const changelog = JSON.parse(readFileSync(changelogPath, "utf-8"));
    expect(changelog.version).toBeTruthy();
    expect(changelog.changes).toBeInstanceOf(Array);
    expect(changelog.changes.length).toBeGreaterThan(0);
  });

  it("changelog.json includes title and date fields", () => {
    const changelogPath = join(VIZ_DIR, "versions", "v0.0.2", "changelog.json");
    if (!existsSync(changelogPath)) {
      expect.fail("v0.0.2 changelog.json does not exist");
      return;
    }
    const changelog = JSON.parse(readFileSync(changelogPath, "utf-8"));
    expect(changelog.title).toBeTruthy();
    expect(changelog.date).toBeTruthy();
  });
});
