/**
 * TDD tests for hook-multiuser-hardcoded-paths — Replace hardcoded /home/developer
 * paths with $HOME-relative or env-var-driven paths for multi-user support.
 *
 * From PDSA hook-multiuser-hardcoded-paths v0.0.1 (2026-03-03):
 *
 * AC-HOOK1: All 3 hook scripts use $HOME/.brain-api-key instead of /home/developer/.brain-api-key
 * AC-HOOK2: precompact-save.sh project base path is configurable via env var
 * AC-SESSION: claude-session.sh uses no hardcoded /home/developer paths
 * AC-SETTINGS: sync-settings.js substitutes user-specific paths when generating settings.json
 * AC-PROVISION: provision-user.sh fallback path uses $HOME not /home/developer
 * AC-ROBIN: Robin can run provision + claude-session.sh on his machine
 * AC-ZERO: Zero grep hits for /home/developer in hook scripts and claude-session.sh (excluding comments)
 *
 * Tests scan actual script files for hardcoded paths.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const WORKSPACE = "/home/developer/workspaces/github/PichlerThomas";
const BEST_PRACTICES = join(WORKSPACE, "xpollination-best-practices");
const HOMEASSISTANT = join(WORKSPACE, "HomeAssistant");

const HOOK_SCRIPTS = [
  join(BEST_PRACTICES, "scripts/xpo.claude.brain-first-hook.sh"),
  join(BEST_PRACTICES, "scripts/xpo.claude.compact-recover.sh"),
  join(BEST_PRACTICES, "scripts/xpo.claude.precompact-save.sh"),
];

const CLAUDE_SESSION = join(
  HOMEASSISTANT,
  "systems/synology-ds218/features/infrastructure/scripts/claude-session.sh"
);

/**
 * Count non-comment lines containing /home/developer in a file.
 * Comment lines (starting with #) are excluded.
 */
function countHardcodedPaths(filePath: string): number {
  if (!existsSync(filePath)) return -1;
  const lines = readFileSync(filePath, "utf-8").split("\n");
  return lines.filter(
    (line) =>
      line.includes("/home/developer") &&
      !line.trimStart().startsWith("#") &&
      !line.trimStart().startsWith("//")
  ).length;
}

// ============================================================
// AC-HOOK1: Hook scripts use $HOME/.brain-api-key
// ============================================================

describe("AC-HOOK1: Hook scripts use $HOME/.brain-api-key", () => {
  for (const scriptPath of HOOK_SCRIPTS) {
    const scriptName = scriptPath.split("/").pop()!;

    it(`${scriptName} uses $HOME/.brain-api-key (not /home/developer/.brain-api-key)`, () => {
      if (!existsSync(scriptPath)) {
        expect(existsSync(scriptPath)).toBe(true);
        return;
      }
      const source = readFileSync(scriptPath, "utf-8");
      // Should use $HOME for brain-api-key path
      expect(source).toMatch(/\$HOME\/\.brain-api-key|\$\{HOME\}\/\.brain-api-key/);
      // Should NOT have hardcoded /home/developer/.brain-api-key (in non-comment lines)
      const lines = source.split("\n");
      const hardcoded = lines.filter(
        (l) =>
          l.includes("/home/developer/.brain-api-key") &&
          !l.trimStart().startsWith("#")
      );
      expect(hardcoded.length).toBe(0);
    });
  }
});

// ============================================================
// AC-HOOK2: precompact-save.sh uses configurable base path
// ============================================================

describe("AC-HOOK2: precompact-save.sh uses configurable project base path", () => {
  it("precompact-save.sh BASE path uses env var or $HOME (not hardcoded /home/developer)", () => {
    const scriptPath = join(BEST_PRACTICES, "scripts/xpo.claude.precompact-save.sh");
    if (!existsSync(scriptPath)) {
      expect(existsSync(scriptPath)).toBe(true);
      return;
    }
    const source = readFileSync(scriptPath, "utf-8");
    // Should use env var (XPO_WORKSPACE or similar) or $HOME for base path
    const hasEnvVar =
      source.match(/XPO_WORKSPACE|XPOLLINATION_WORKSPACE|\$HOME/) !== null;
    expect(hasEnvVar).toBe(true);

    // Non-comment lines should not hardcode /home/developer for BASE
    const lines = source.split("\n");
    const hardcodedBase = lines.filter(
      (l) =>
        l.match(/BASE\s*=.*\/home\/developer/) &&
        !l.trimStart().startsWith("#")
    );
    expect(hardcodedBase.length).toBe(0);
  });
});

// ============================================================
// AC-SESSION: claude-session.sh uses no hardcoded paths
// ============================================================

describe("AC-SESSION: claude-session.sh uses no hardcoded /home/developer", () => {
  it("claude-session.sh has zero non-comment /home/developer references", () => {
    if (!existsSync(CLAUDE_SESSION)) {
      expect(existsSync(CLAUDE_SESSION)).toBe(true);
      return;
    }
    const count = countHardcodedPaths(CLAUDE_SESSION);
    expect(count).toBe(0);
  });
});

// ============================================================
// AC-SETTINGS: sync-settings.js substitutes paths
// ============================================================

describe("AC-SETTINGS: sync-settings.js handles user-specific paths", () => {
  it("sync-settings.js or settings template uses __XPO_WORKSPACE__ placeholder or $HOME", () => {
    // Check for sync-settings.js in best-practices
    const syncSettings = join(BEST_PRACTICES, "scripts/xpo.claude.sync-settings.js");
    const settingsTemplate = join(BEST_PRACTICES, "scripts/xpo.claude.settings.json");

    // At least one of these must exist
    const syncExists = existsSync(syncSettings);
    const templateExists = existsSync(settingsTemplate);
    expect(syncExists || templateExists).toBe(true);

    if (syncExists) {
      const source = readFileSync(syncSettings, "utf-8");
      // Must have path substitution logic: __XPO or HOME or replace
      const hasSubstitution =
        source.match(/__XPO|HOME|\.replace|process\.env/) !== null;
      expect(hasSubstitution).toBe(true);
    }

    if (templateExists) {
      const source = readFileSync(settingsTemplate, "utf-8");
      // Template should use placeholder or $HOME, not /home/developer
      const nonCommentHardcoded = source
        .split("\n")
        .filter(
          (l) =>
            l.includes("/home/developer") &&
            !l.trimStart().startsWith("//") &&
            !l.trimStart().startsWith("#")
        );
      expect(nonCommentHardcoded.length).toBe(0);
    }
  });
});

// ============================================================
// AC-ZERO: Zero hardcoded paths across all hook scripts
// ============================================================

describe("AC-ZERO: Zero /home/developer in hook scripts (excluding comments)", () => {
  for (const scriptPath of HOOK_SCRIPTS) {
    const scriptName = scriptPath.split("/").pop()!;

    it(`${scriptName} has zero non-comment /home/developer references`, () => {
      if (!existsSync(scriptPath)) {
        expect(existsSync(scriptPath)).toBe(true);
        return;
      }
      const count = countHardcodedPaths(scriptPath);
      expect(count).toBe(0);
    });
  }
});
