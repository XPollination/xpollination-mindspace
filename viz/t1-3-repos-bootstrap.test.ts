/**
 * TDD tests for t1-3-repos-bootstrap
 *
 * Verifies traceability convention bootstrapped across all 3 repos:
 * - xpollination-best-practices: AGENTS.md + CONTRIBUTING.md (new)
 * - HomePage: AGENTS.md + CONTRIBUTING.md (new)
 * - xpollination-mcp-server: CLAUDE.md cross-reference (added)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create AGENTS.md at xpollination-best-practices project root
 * - Create CONTRIBUTING.md at xpollination-best-practices project root
 * - Create AGENTS.md at HomePage project root
 * - Create CONTRIBUTING.md at HomePage project root
 * - Add traceability cross-reference to xpollination-mcp-server CLAUDE.md branching section
 * - Code Traceability Convention section must be IDENTICAL across all repos
 * - 4 TSDoc tags: @capability, @requirement, @satisfies, @decision
 * - SHOULD-level compliance (not MUST)
 * - Commit format: type(scope): [CAP-ID] [REQ-ID] [TASK-ID] description
 * - CONTRIBUTING.md files include Git Protocol section
 * - AGENTS.md headers identify correct project name
 * - No tool-specific references (CLAUDE.md, .cursorrules, SKILL.md)
 * - xpollination-mcp-server AGENTS.md and CONTRIBUTING.md unchanged from T1.2
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "/home/developer/workspaces/github/PichlerThomas";
const BP_DIR = resolve(BASE, "xpollination-best-practices");
const HP_DIR = resolve(BASE, "HomePage");
const MCP_DIR = resolve(BASE, "xpollination-mcp-server");

const BP_AGENTS = resolve(BP_DIR, "AGENTS.md");
const BP_CONTRIBUTING = resolve(BP_DIR, "CONTRIBUTING.md");
const HP_AGENTS = resolve(HP_DIR, "AGENTS.md");
const HP_CONTRIBUTING = resolve(HP_DIR, "CONTRIBUTING.md");
const MCP_CLAUDE = resolve(MCP_DIR, "CLAUDE.md");

// Reference files from T1.2 (should be unchanged)
const MCP_AGENTS = resolve(MCP_DIR, "AGENTS.md");
const MCP_CONTRIBUTING = resolve(MCP_DIR, "CONTRIBUTING.md");

describe("t1-3-repos-bootstrap", () => {
  // --- Requirement 1: AGENTS.md exists at root of xpollination-best-practices ---
  it("AGENTS.md exists at root of xpollination-best-practices", () => {
    expect(existsSync(BP_AGENTS)).toBe(true);
  });

  // --- Requirement 2: CONTRIBUTING.md exists at root of xpollination-best-practices ---
  it("CONTRIBUTING.md exists at root of xpollination-best-practices", () => {
    expect(existsSync(BP_CONTRIBUTING)).toBe(true);
  });

  // --- Requirement 3: AGENTS.md exists at root of HomePage ---
  it("AGENTS.md exists at root of HomePage", () => {
    expect(existsSync(HP_AGENTS)).toBe(true);
  });

  // --- Requirement 4: CONTRIBUTING.md exists at root of HomePage ---
  it("CONTRIBUTING.md exists at root of HomePage", () => {
    expect(existsSync(HP_CONTRIBUTING)).toBe(true);
  });

  // --- Requirement 5: All four new files contain "Code Traceability Convention" ---
  describe("Code Traceability Convention section", () => {
    it("BP AGENTS.md contains Code Traceability Convention", () => {
      const content = readFileSync(BP_AGENTS, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
    });

    it("BP CONTRIBUTING.md contains Code Traceability Convention", () => {
      const content = readFileSync(BP_CONTRIBUTING, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
    });

    it("HP AGENTS.md contains Code Traceability Convention", () => {
      const content = readFileSync(HP_AGENTS, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
    });

    it("HP CONTRIBUTING.md contains Code Traceability Convention", () => {
      const content = readFileSync(HP_CONTRIBUTING, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
    });
  });

  // --- Requirement 6: All four files document the same 4 TSDoc tags ---
  describe("TSDoc tags in all files", () => {
    const TAGS = ["@capability", "@requirement", "@satisfies", "@decision"];
    const files = [
      { name: "BP AGENTS.md", path: BP_AGENTS },
      { name: "BP CONTRIBUTING.md", path: BP_CONTRIBUTING },
      { name: "HP AGENTS.md", path: HP_AGENTS },
      { name: "HP CONTRIBUTING.md", path: HP_CONTRIBUTING },
    ];

    for (const file of files) {
      for (const tag of TAGS) {
        it(`${file.name} documents ${tag}`, () => {
          const content = readFileSync(file.path, "utf-8");
          expect(content).toContain(tag);
        });
      }
    }
  });

  // --- Requirement 7: All tags described as SHOULD (not MUST) ---
  describe("SHOULD-level compliance", () => {
    it("BP AGENTS.md uses SHOULD", () => {
      const content = readFileSync(BP_AGENTS, "utf-8");
      expect(content).toMatch(/SHOULD/);
    });

    it("HP AGENTS.md uses SHOULD", () => {
      const content = readFileSync(HP_AGENTS, "utf-8");
      expect(content).toMatch(/SHOULD/);
    });
  });

  // --- Requirement 8: Commit message format documented in all files ---
  describe("commit format", () => {
    const files = [
      { name: "BP AGENTS.md", path: BP_AGENTS },
      { name: "BP CONTRIBUTING.md", path: BP_CONTRIBUTING },
      { name: "HP AGENTS.md", path: HP_AGENTS },
      { name: "HP CONTRIBUTING.md", path: HP_CONTRIBUTING },
    ];

    for (const file of files) {
      it(`${file.name} documents commit format with CAP-ID, REQ-ID, TASK-ID`, () => {
        const content = readFileSync(file.path, "utf-8");
        expect(content).toMatch(/type\(scope\).*CAP-ID.*REQ-ID.*TASK-ID/s);
      });
    }
  });

  // --- Requirement 9: Code example with all 4 tags in all files ---
  describe("code examples", () => {
    const files = [
      { name: "BP AGENTS.md", path: BP_AGENTS },
      { name: "HP AGENTS.md", path: HP_AGENTS },
    ];

    for (const file of files) {
      it(`${file.name} has example with @capability, @requirement, @satisfies`, () => {
        const content = readFileSync(file.path, "utf-8");
        expect(content).toMatch(/@capability\s+CAP-/);
        expect(content).toMatch(/@requirement\s+REQ-/);
        expect(content).toMatch(/@satisfies\s+A/);
      });
    }
  });

  // --- Requirement 10: SHOULD→MUST A2A note in all files ---
  describe("A2A transition note", () => {
    const files = [
      { name: "BP AGENTS.md", path: BP_AGENTS },
      { name: "BP CONTRIBUTING.md", path: BP_CONTRIBUTING },
      { name: "HP AGENTS.md", path: HP_AGENTS },
      { name: "HP CONTRIBUTING.md", path: HP_CONTRIBUTING },
    ];

    for (const file of files) {
      it(`${file.name} documents SHOULD→MUST transition with A2A`, () => {
        const content = readFileSync(file.path, "utf-8");
        expect(content).toMatch(/SHOULD.*MUST.*A2A|MUST.*A2A.*enforcement/s);
      });
    }
  });

  // --- Requirement 11: Test tagging convention in all files ---
  describe("test tagging convention", () => {
    const files = [
      { name: "BP AGENTS.md", path: BP_AGENTS },
      { name: "HP AGENTS.md", path: HP_AGENTS },
    ];

    for (const file of files) {
      it(`${file.name} documents test tagging convention`, () => {
        const content = readFileSync(file.path, "utf-8");
        expect(content).toMatch(/test.*@requirement|@requirement.*@satisfies.*tag/is);
      });
    }
  });

  // --- Requirement 12: AGENTS.md headers identify correct project name ---
  describe("project-specific headers", () => {
    it("BP AGENTS.md identifies xpollination-best-practices", () => {
      const content = readFileSync(BP_AGENTS, "utf-8");
      expect(content).toMatch(/xpollination-best-practices/);
    });

    it("HP AGENTS.md identifies HomePage", () => {
      const content = readFileSync(HP_AGENTS, "utf-8");
      expect(content).toMatch(/HomePage/);
    });
  });

  // --- Requirement 13: CONTRIBUTING.md files include git protocol ---
  describe("git protocol in CONTRIBUTING.md", () => {
    it("BP CONTRIBUTING.md includes git protocol", () => {
      const content = readFileSync(BP_CONTRIBUTING, "utf-8");
      expect(content).toMatch(/[Gg]it [Pp]rotocol/);
    });

    it("HP CONTRIBUTING.md includes git protocol", () => {
      const content = readFileSync(HP_CONTRIBUTING, "utf-8");
      expect(content).toMatch(/[Gg]it [Pp]rotocol/);
    });
  });

  // --- Requirement 14: No tool-specific references in any file ---
  describe("agent-agnostic (no tool-specific refs)", () => {
    const files = [
      { name: "BP AGENTS.md", path: BP_AGENTS },
      { name: "BP CONTRIBUTING.md", path: BP_CONTRIBUTING },
      { name: "HP AGENTS.md", path: HP_AGENTS },
      { name: "HP CONTRIBUTING.md", path: HP_CONTRIBUTING },
    ];

    for (const file of files) {
      it(`${file.name} does not reference tool-specific files`, () => {
        const content = readFileSync(file.path, "utf-8");
        expect(content).not.toMatch(/CLAUDE\.md|\.cursorrules|SKILL\.md/);
      });
    }
  });

  // --- Requirement 15: CLAUDE.md branching section references AGENTS.md/CONTRIBUTING.md ---
  describe("CLAUDE.md cross-reference", () => {
    it("xpollination-mcp-server CLAUDE.md references traceability in branching section", () => {
      const content = readFileSync(MCP_CLAUDE, "utf-8");
      // Should have traceability reference near branching rules
      expect(content).toMatch(/[Tt]raceability.*AGENTS\.md|AGENTS\.md.*CONTRIBUTING\.md.*convention/s);
    });
  });

  // --- Requirement 16: Traceability convention text is identical across all repos ---
  describe("identical convention text across repos", () => {
    it("convention section is identical in all AGENTS.md files", () => {
      const mcp = readFileSync(MCP_AGENTS, "utf-8");
      const bp = readFileSync(BP_AGENTS, "utf-8");
      const hp = readFileSync(HP_AGENTS, "utf-8");

      // Extract the convention section from each
      const extractConvention = (text: string) => {
        const match = text.match(/## Code Traceability Convention[\s\S]*?(?=\n## |\n# |$)/);
        return match ? match[0].trim() : "";
      };

      const mcp_conv = extractConvention(mcp);
      const bp_conv = extractConvention(bp);
      const hp_conv = extractConvention(hp);

      expect(mcp_conv).toBeTruthy();
      expect(bp_conv).toBeTruthy();
      expect(hp_conv).toBeTruthy();
      expect(bp_conv).toBe(mcp_conv);
      expect(hp_conv).toBe(mcp_conv);
    });
  });

  // --- Requirement 17: xpollination-mcp-server AGENTS.md and CONTRIBUTING.md unchanged ---
  describe("mcp-server files unchanged from T1.2", () => {
    it("MCP AGENTS.md still exists and has traceability convention", () => {
      const content = readFileSync(MCP_AGENTS, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
      expect(content).toMatch(/cross-agent|Cross-agent/i);
    });

    it("MCP CONTRIBUTING.md still exists and has traceability convention", () => {
      const content = readFileSync(MCP_CONTRIBUTING, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
      expect(content).toMatch(/[Gg]it [Pp]rotocol/);
    });
  });
});
