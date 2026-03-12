/**
 * TDD tests for t1-2-traceability-convention
 *
 * Verifies AGENTS.md and CONTRIBUTING.md with traceability convention.
 * Agent-agnostic, platform-agnostic files documenting TSDoc tag usage.
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create AGENTS.md at xpollination-mcp-server project root
 * - Create CONTRIBUTING.md at xpollination-mcp-server project root
 * - Both contain verbatim "Code Traceability Convention" section
 * - 4 TSDoc tags: @capability, @requirement, @satisfies, @decision
 * - SHOULD-level compliance (not MUST yet)
 * - Commit format: type(scope): [CAP-ID] [REQ-ID] [TASK-ID] description
 * - No Claude-specific or Cursor-specific references
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MCP_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);
const AGENTS_PATH = resolve(MCP_DIR, "AGENTS.md");
const CONTRIBUTING_PATH = resolve(MCP_DIR, "CONTRIBUTING.md");

describe("t1-2-traceability-convention", () => {
  // --- Requirement 1: AGENTS.md exists ---
  it("AGENTS.md exists at project root", () => {
    expect(existsSync(AGENTS_PATH)).toBe(true);
  });

  // --- Requirement 2: CONTRIBUTING.md exists ---
  it("CONTRIBUTING.md exists at project root", () => {
    expect(existsSync(CONTRIBUTING_PATH)).toBe(true);
  });

  // --- Requirement 3: Both contain traceability section ---
  describe("traceability convention section", () => {
    it("AGENTS.md contains Code Traceability Convention", () => {
      const content = readFileSync(AGENTS_PATH, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
    });

    it("CONTRIBUTING.md contains Code Traceability Convention", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf-8");
      expect(content).toMatch(/Code Traceability Convention/);
    });
  });

  // --- Requirement 4: Four TSDoc tags documented ---
  describe("TSDoc tags", () => {
    const TAGS = ["@capability", "@requirement", "@satisfies", "@decision"];

    for (const tag of TAGS) {
      it(`AGENTS.md documents ${tag}`, () => {
        const content = readFileSync(AGENTS_PATH, "utf-8");
        expect(content).toContain(tag);
      });

      it(`CONTRIBUTING.md documents ${tag}`, () => {
        const content = readFileSync(CONTRIBUTING_PATH, "utf-8");
        expect(content).toContain(tag);
      });
    }
  });

  // --- Requirement 5: SHOULD-level compliance ---
  describe("compliance level", () => {
    it("AGENTS.md uses SHOULD (not MUST for convention)", () => {
      const content = readFileSync(AGENTS_PATH, "utf-8");
      expect(content).toMatch(/SHOULD/);
    });

    it("CONTRIBUTING.md uses SHOULD (not MUST for convention)", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf-8");
      expect(content).toMatch(/SHOULD/);
    });
  });

  // --- Requirement 6: Commit message format ---
  describe("commit format", () => {
    it("AGENTS.md documents commit format with CAP-ID, REQ-ID, TASK-ID", () => {
      const content = readFileSync(AGENTS_PATH, "utf-8");
      expect(content).toMatch(/type\(scope\).*CAP-ID.*REQ-ID.*TASK-ID/s);
    });
  });

  // --- Requirement 7: Example code block with all 4 tags ---
  describe("examples", () => {
    it("AGENTS.md has example with @capability, @requirement, @satisfies", () => {
      const content = readFileSync(AGENTS_PATH, "utf-8");
      expect(content).toMatch(/@capability\s+CAP-/);
      expect(content).toMatch(/@requirement\s+REQ-/);
      expect(content).toMatch(/@satisfies\s+A/);
    });
  });

  // --- Requirement 8: Example commit message ---
  it("has example commit message", () => {
    const content = readFileSync(AGENTS_PATH, "utf-8");
    expect(content).toMatch(/feat\(.*\).*\[CAP-/);
  });

  // --- Requirement 9: SHOULD→MUST transition note ---
  it("documents SHOULD→MUST transition with A2A", () => {
    const content = readFileSync(AGENTS_PATH, "utf-8");
    expect(content).toMatch(/SHOULD.*MUST.*A2A|MUST.*A2A.*enforcement/s);
  });

  // --- Requirement 10: Test tagging convention ---
  it("documents test tagging convention", () => {
    const content = readFileSync(AGENTS_PATH, "utf-8");
    expect(content).toMatch(/test.*@requirement|@requirement.*@satisfies.*tag/is);
  });

  // --- Requirement 11: AGENTS.md cross-agent header ---
  it("AGENTS.md identifies as cross-agent standard", () => {
    const content = readFileSync(AGENTS_PATH, "utf-8");
    expect(content).toMatch(/cross-agent|Cross-agent/i);
  });

  // --- Requirement 12: CONTRIBUTING.md includes git protocol ---
  it("CONTRIBUTING.md includes git protocol", () => {
    const content = readFileSync(CONTRIBUTING_PATH, "utf-8");
    expect(content).toMatch(/git protocol|Git Protocol/i);
  });

  // --- Requirement 13: No tool-specific references ---
  describe("agent-agnostic", () => {
    it("AGENTS.md does not reference Claude-specific tooling", () => {
      const content = readFileSync(AGENTS_PATH, "utf-8");
      expect(content).not.toMatch(/CLAUDE\.md|\.cursorrules|SKILL\.md/);
    });

    it("CONTRIBUTING.md does not reference Claude-specific tooling", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf-8");
      expect(content).not.toMatch(/CLAUDE\.md|\.cursorrules|SKILL\.md/);
    });
  });
});
