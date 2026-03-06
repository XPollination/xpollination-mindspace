/**
 * TDD tests for d2-3-interim-branching-docs
 *
 * Change A: Branching Rules section in xpo.claude.monitor SKILL.md
 * Change B: Full branching rules in project CLAUDE.md files
 * Change C: Brain contribution (verified by content, not API call)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Add "Branching Rules (Interim)" section to monitor SKILL.md after Git Protocol
 * - Add full branching rules block to CLAUDE.md in: xpollination-mcp-server, xpollination-best-practices, HomePage
 * - Contribute rules to brain as operational_learning
 * - Rules must include: never main, develop default, feature/cap-*, test URL 10.33.33.1:4200
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const BP_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices"
);
const MCP_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);
const HP_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/HomePage"
);

const SKILL_PATH = resolve(
  BP_DIR, ".claude/skills/xpo.claude.monitor/SKILL.md"
);

describe("d2-3-interim-branching-docs", () => {
  // --- Change A: Monitor SKILL.md ---
  describe("Change A: SKILL.md branching rules", () => {
    it("SKILL.md contains 'Branching Rules' section", () => {
      const content = readFileSync(SKILL_PATH, "utf-8");
      expect(content).toMatch(/Branching Rules/i);
    });

    it("SKILL.md says never commit to main", () => {
      const content = readFileSync(SKILL_PATH, "utf-8");
      expect(content).toMatch(/never.*commit.*main|NEVER.*main/i);
    });

    it("SKILL.md mentions develop as default branch", () => {
      const content = readFileSync(SKILL_PATH, "utf-8");
      expect(content).toMatch(/develop/);
    });

    it("SKILL.md mentions feature/cap-* branch pattern", () => {
      const content = readFileSync(SKILL_PATH, "utf-8");
      expect(content).toMatch(/feature\/cap-/);
    });

    it("SKILL.md mentions test system URL 10.33.33.1:4200", () => {
      const content = readFileSync(SKILL_PATH, "utf-8");
      expect(content).toMatch(/10\.33\.33\.1:4200/);
    });
  });

  // --- Change B: CLAUDE.md files ---
  describe("Change B: CLAUDE.md branching rules", () => {
    it("xpollination-mcp-server CLAUDE.md contains branching rules", () => {
      const claudePath = resolve(MCP_DIR, "CLAUDE.md");
      const content = readFileSync(claudePath, "utf-8");
      expect(content).toMatch(/Branching Rules/i);
    });

    it("xpollination-mcp-server CLAUDE.md has full rules (not just pointer)", () => {
      const claudePath = resolve(MCP_DIR, "CLAUDE.md");
      const content = readFileSync(claudePath, "utf-8");
      // Must contain actual rules, not just "see SKILL.md"
      expect(content).toMatch(/never.*commit.*main|NEVER.*main/i);
      expect(content).toMatch(/develop/);
      expect(content).toMatch(/feature\/cap-/);
    });

    it("xpollination-best-practices CLAUDE.md contains branching rules (if exists)", () => {
      const claudePath = resolve(BP_DIR, "CLAUDE.md");
      if (existsSync(claudePath)) {
        const content = readFileSync(claudePath, "utf-8");
        expect(content).toMatch(/Branching Rules/i);
        expect(content).toMatch(/never.*commit.*main|NEVER.*main/i);
      }
    });

    it("HomePage CLAUDE.md contains branching rules (if exists)", () => {
      const claudePath = resolve(HP_DIR, "CLAUDE.md");
      if (existsSync(claudePath)) {
        const content = readFileSync(claudePath, "utf-8");
        expect(content).toMatch(/Branching Rules/i);
        expect(content).toMatch(/never.*commit.*main|NEVER.*main/i);
      }
    });
  });

  // --- Consistency: rules match across files ---
  describe("consistency", () => {
    it("SKILL.md and MCP CLAUDE.md both mention same branch table", () => {
      const skill = readFileSync(SKILL_PATH, "utf-8");
      const claude = readFileSync(resolve(MCP_DIR, "CLAUDE.md"), "utf-8");
      // Both should have the branch table with main, develop, feature/cap-*
      expect(skill).toMatch(/main.*Production/s);
      expect(claude).toMatch(/main.*Production/s);
      expect(skill).toMatch(/develop.*Integration/s);
      expect(claude).toMatch(/develop.*Integration/s);
    });
  });
});
