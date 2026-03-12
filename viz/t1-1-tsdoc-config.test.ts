/**
 * TDD tests for t1-1-tsdoc-config
 *
 * Verifies tsdoc.json in project root with 4 traceability tag definitions.
 * Phase 1 bootstrap — no enforcement, just formal tag definitions.
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create tsdoc.json at xpollination-mcp-server/tsdoc.json (project root)
 * - Must be valid JSON with $schema pointing to TSDoc v0 schema
 * - Exactly 4 block tags: @capability, @requirement, @satisfies, @decision
 * - No extra tags beyond these 4
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MCP_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);
const TSDOC_PATH = resolve(MCP_DIR, "tsdoc.json");

describe("t1-1-tsdoc-config", () => {
  // --- Requirement 1: File exists ---
  it("tsdoc.json exists at project root", () => {
    expect(existsSync(TSDOC_PATH)).toBe(true);
  });

  // --- Requirement 2: Valid JSON ---
  it("tsdoc.json is valid JSON", () => {
    const raw = readFileSync(TSDOC_PATH, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  // --- Requirement 3: Schema reference ---
  it("$schema points to TSDoc v0 schema", () => {
    const config = JSON.parse(readFileSync(TSDOC_PATH, "utf-8"));
    expect(config.$schema).toBe(
      "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json"
    );
  });

  // --- Requirement 4: Four tag definitions present ---
  describe("tag definitions", () => {
    const EXPECTED_TAGS = [
      "@capability",
      "@requirement",
      "@satisfies",
      "@decision",
    ];

    it("has tagDefinitions array", () => {
      const config = JSON.parse(readFileSync(TSDOC_PATH, "utf-8"));
      expect(Array.isArray(config.tagDefinitions)).toBe(true);
    });

    for (const tag of EXPECTED_TAGS) {
      it(`defines ${tag} tag`, () => {
        const config = JSON.parse(readFileSync(TSDOC_PATH, "utf-8"));
        const found = config.tagDefinitions.find(
          (t: { tagName: string }) => t.tagName === tag
        );
        expect(found).toBeDefined();
      });
    }
  });

  // --- Requirement 5: All tags have syntaxKind "block" ---
  it("all tags have syntaxKind block", () => {
    const config = JSON.parse(readFileSync(TSDOC_PATH, "utf-8"));
    for (const tag of config.tagDefinitions) {
      expect(tag.syntaxKind).toBe("block");
    }
  });

  // --- Requirement 6: No extra tags ---
  it("has exactly 4 tag definitions (no extras)", () => {
    const config = JSON.parse(readFileSync(TSDOC_PATH, "utf-8"));
    expect(config.tagDefinitions).toHaveLength(4);
  });
});
