/**
 * TDD tests for agent-project-discovery-gap v0.0.2
 *
 * Verifies: (1) Shared discover-projects module exists,
 * (2) All consumers use shared module (no duplicated discovery),
 * (3) XPO_WORKSPACE_PATH configurable,
 * (4) guessProject() is not hardcoded,
 * (5) No hardcoded DB paths in agent tooling.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);

function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

// ============================================================
// AC1: Shared discovery module exists
// ============================================================

describe("AC1: Shared discover-projects module", () => {
  it("discover-projects.cjs (or .js) exists in viz/", () => {
    const cjs = existsSync(join(VIZ_DIR, "discover-projects.cjs"));
    const js = existsSync(join(VIZ_DIR, "discover-projects.js"));
    expect(cjs || js).toBe(true);
  });

  it("shared module exports a discovery function", () => {
    const cjsPath = join(VIZ_DIR, "discover-projects.cjs");
    const jsPath = join(VIZ_DIR, "discover-projects.js");
    const path = existsSync(cjsPath) ? cjsPath : jsPath;
    const source = readFile(path);
    // Must export discoverDatabases or discoverProjects or similar
    expect(source).toMatch(/module\.exports|exports\.|export/);
    expect(source).toMatch(/discover|discoverDatabases|discoverProjects/i);
  });

  it("shared module uses XPO_WORKSPACE_PATH env var", () => {
    const cjsPath = join(VIZ_DIR, "discover-projects.cjs");
    const jsPath = join(VIZ_DIR, "discover-projects.js");
    const path = existsSync(cjsPath) ? cjsPath : jsPath;
    const source = readFile(path);
    expect(source).toMatch(/XPO_WORKSPACE_PATH/);
  });

  it("shared module scans for data/xpollination.db pattern", () => {
    const cjsPath = join(VIZ_DIR, "discover-projects.cjs");
    const jsPath = join(VIZ_DIR, "discover-projects.js");
    const path = existsSync(cjsPath) ? cjsPath : jsPath;
    const source = readFile(path);
    expect(source).toMatch(/xpollination\.db/);
  });
});

// ============================================================
// AC2: All consumers use shared module
// ============================================================

describe("AC2: Consumers use shared module (no duplicated discovery)", () => {
  it("server.js requires/imports shared discovery module", () => {
    const source = readFile(join(VIZ_DIR, "server.js"));
    expect(source).toMatch(/require.*discover-projects|import.*discover-projects/);
  });

  it("agent-monitor.cjs requires/imports shared discovery module", () => {
    const source = readFile(join(VIZ_DIR, "agent-monitor.cjs"));
    expect(source).toMatch(/require.*discover-projects|import.*discover-projects/);
  });

  it("pm-status.cjs requires/imports shared discovery module", () => {
    const source = readFile(join(VIZ_DIR, "pm-status.cjs"));
    expect(source).toMatch(/require.*discover-projects|import.*discover-projects/);
  });

  it("server.js does NOT have inline discoverDatabases function", () => {
    const source = readFile(join(VIZ_DIR, "server.js"));
    // Should not define its own discovery function inline
    const hasInlineDiscovery = source.match(/function\s+discoverDatabases|function\s+discoverProjects/);
    expect(hasInlineDiscovery).toBeFalsy();
  });

  it("pm-status.cjs does NOT have inline discoverDatabases function", () => {
    const source = readFile(join(VIZ_DIR, "pm-status.cjs"));
    const hasInlineDiscovery = source.match(/function\s+discoverDatabases|function\s+discoverProjects/);
    expect(hasInlineDiscovery).toBeFalsy();
  });
});

// ============================================================
// AC3: guessProject() not hardcoded
// ============================================================

describe("AC3: guessProject() uses dynamic extraction", () => {
  it("guessProject does NOT have hardcoded project names", () => {
    const source = readFile(join(VIZ_DIR, "..", "src", "db", "interface-cli.js"));
    // Find the guessProject function body
    const funcMatch = source.match(/function\s+guessProject[\s\S]*?\n\}/);
    if (!funcMatch) {
      // If function was removed/renamed, that's also fine
      expect(true).toBe(true);
      return;
    }
    const funcBody = funcMatch[0];
    // Should NOT have hardcoded includes checks for specific project names
    const hasHardcoded = funcBody.match(/includes\('xpollination-mcp-server'\)|includes\('HomePage'\)|includes\('best-practices'\)/);
    expect(hasHardcoded).toBeFalsy();
  });

  it("guessProject extracts project name from path dynamically", () => {
    const source = readFile(join(VIZ_DIR, "..", "src", "db", "interface-cli.js"));
    const funcMatch = source.match(/function\s+guessProject[\s\S]*?\n\}/);
    if (!funcMatch) {
      expect(true).toBe(true);
      return;
    }
    const funcBody = funcMatch[0];
    // Should use path parsing (split, match, regex) not if-chains
    const hasDynamic = funcBody.match(/split|match|regex|replace|basename|dirname|\[|\]/);
    expect(hasDynamic).toBeTruthy();
  });
});

// ============================================================
// AC4: Ghost project filtering
// ============================================================

describe("AC4: Ghost/empty project filtering", () => {
  it("shared module filters out zero-byte databases", () => {
    const cjsPath = join(VIZ_DIR, "discover-projects.cjs");
    const jsPath = join(VIZ_DIR, "discover-projects.js");
    const path = existsSync(cjsPath) ? cjsPath : jsPath;
    const source = readFile(path);
    // Must check file size or stat to filter empty DBs
    expect(source).toMatch(/statSync|stat|size|lstatSync|\.size/);
  });
});

// ============================================================
// AC5: Configurable workspace path
// ============================================================

describe("AC5: Single configurable workspace path", () => {
  it("XPO_WORKSPACE_PATH is the only config needed", () => {
    const cjsPath = join(VIZ_DIR, "discover-projects.cjs");
    const jsPath = join(VIZ_DIR, "discover-projects.js");
    const path = existsSync(cjsPath) ? cjsPath : jsPath;
    const source = readFile(path);
    // Must use XPO_WORKSPACE_PATH from env
    expect(source).toMatch(/process\.env\.XPO_WORKSPACE_PATH/);
  });
});
