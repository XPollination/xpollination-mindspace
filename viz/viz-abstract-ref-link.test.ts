/**
 * TDD tests for viz-abstract-ref-link — Display abstract_ref in detail panel.
 *
 * From PDSA viz-abstract-ref-link v0.0.2 (2026-03-02):
 * AC-VAL1: abstract_ref appears in detail panel when present in DNA
 * AC-VAL2: Renders as clickable GitHub link when starts with https://
 * AC-VAL3: Does NOT appear when abstract_ref is absent from DNA
 * AC-VAL4: Label says "Abstract"
 * AC-VAL5: Display name strips .abstract.md extension
 *
 * Tests are source code checks on viz/index.html since the viz is a
 * single-file HTML app with inline JS template literals.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIZ_PATH = resolve(__dirname, "index.html");

function readViz(): string {
  return readFileSync(VIZ_PATH, "utf-8");
}

// --- AC-VAL1: abstract_ref appears in detail panel when present in DNA ---

describe("AC-VAL1: abstract_ref appears in detail panel when present in DNA", () => {
  it("viz/index.html contains dna.abstract_ref conditional block", () => {
    const source = readViz();
    // Must have a conditional check for abstract_ref presence
    expect(source).toMatch(/dna\.abstract_ref\s*\?/);
  });

  it("abstract_ref block is inside the detail panel template (after pdsa_ref)", () => {
    const source = readViz();
    const pdsaRefIndex = source.indexOf("dna.pdsa_ref");
    const abstractRefIndex = source.indexOf("dna.abstract_ref");
    const idFieldIndex = source.indexOf('<label>ID</label>');

    // abstract_ref must exist
    expect(abstractRefIndex).toBeGreaterThan(-1);
    // abstract_ref must come AFTER pdsa_ref
    expect(abstractRefIndex).toBeGreaterThan(pdsaRefIndex);
    // abstract_ref must come BEFORE the ID field
    expect(abstractRefIndex).toBeLessThan(idFieldIndex);
  });
});

// --- AC-VAL2: Renders as clickable GitHub link when starts with https:// ---

describe("AC-VAL2: Renders as clickable GitHub link when starts with https://", () => {
  it("abstract_ref block checks for https:// prefix", () => {
    const source = readViz();
    // Find the abstract_ref section and check it has https:// detection
    // The pattern should be: abstract_ref.startsWith('https://')
    expect(source).toMatch(/abstract_ref\.startsWith\s*\(\s*['"]https:\/\/['"]\s*\)/);
  });

  it("abstract_ref block renders <a> tag with target=_blank for https URLs", () => {
    const source = readViz();
    // Extract the abstract_ref section (between dna.abstract_ref ? and the closing '')
    const abstractStart = source.indexOf("dna.abstract_ref ?");
    if (abstractStart === -1) {
      expect(abstractStart).toBeGreaterThan(-1);
      return;
    }
    // Look for an anchor tag with target="_blank" near abstract_ref
    const abstractSection = source.substring(abstractStart, abstractStart + 800);
    expect(abstractSection).toContain('target="_blank"');
    expect(abstractSection).toContain("<a ");
    expect(abstractSection).toContain("abstract_ref");
  });
});

// --- AC-VAL3: Does NOT appear when abstract_ref is absent from DNA ---

describe("AC-VAL3: Does NOT appear when abstract_ref is absent from DNA", () => {
  it("abstract_ref block uses ternary with empty string fallback", () => {
    const source = readViz();
    // The pattern: dna.abstract_ref ? `...` : ''
    // When absent, should render nothing
    expect(source).toMatch(/dna\.abstract_ref\s*\?\s*`[\s\S]*?`\s*:\s*['"]{2}/);
  });
});

// --- AC-VAL4: Label says "Abstract" ---

describe("AC-VAL4: Label says 'Abstract'", () => {
  it("abstract_ref block contains <label>Abstract</label>", () => {
    const source = readViz();
    // Find the abstract_ref conditional and verify label
    const abstractStart = source.indexOf("dna.abstract_ref ?");
    if (abstractStart === -1) {
      expect(abstractStart).toBeGreaterThan(-1);
      return;
    }
    const abstractSection = source.substring(abstractStart, abstractStart + 800);
    expect(abstractSection).toContain("<label>Abstract</label>");
  });
});

// --- AC-VAL5: Display name strips .abstract.md extension ---

describe("AC-VAL5: Display name strips .abstract.md extension", () => {
  it("abstract_ref block uses .replace to strip .abstract.md", () => {
    const source = readViz();
    // Should have: .replace('.abstract.md', '')
    expect(source).toMatch(/\.replace\s*\(\s*['"]\.abstract\.md['"]\s*,\s*['"]{2}\s*\)/);
  });

  it("abstract_ref block extracts filename from path using split('/')", () => {
    const source = readViz();
    // Should have: abstract_ref.split('/').pop()
    expect(source).toMatch(/abstract_ref\.split\s*\(\s*['"]\/['"]\s*\)\s*\.pop\s*\(\s*\)/);
  });
});

// --- Additional structural checks ---

describe("Structural: abstract_ref rendering matches PDSA design", () => {
  it("abstract_ref block uses blue color #60a5fa (distinct from pdsa_ref green)", () => {
    const source = readViz();
    const abstractStart = source.indexOf("dna.abstract_ref ?");
    if (abstractStart === -1) {
      expect(abstractStart).toBeGreaterThan(-1);
      return;
    }
    const abstractSection = source.substring(abstractStart, abstractStart + 800);
    // Blue color for abstract (distinct from #22c55e green for pdsa_ref)
    expect(abstractSection).toContain("#60a5fa");
  });

  it("abstract_ref block uses detail-field class (consistent with other fields)", () => {
    const source = readViz();
    const abstractStart = source.indexOf("dna.abstract_ref ?");
    if (abstractStart === -1) {
      expect(abstractStart).toBeGreaterThan(-1);
      return;
    }
    const abstractSection = source.substring(abstractStart, abstractStart + 800);
    expect(abstractSection).toContain("detail-field");
  });

  it("abstract_ref has fallback display name 'Completion Abstract'", () => {
    const source = readViz();
    const abstractStart = source.indexOf("dna.abstract_ref ?");
    if (abstractStart === -1) {
      expect(abstractStart).toBeGreaterThan(-1);
      return;
    }
    const abstractSection = source.substring(abstractStart, abstractStart + 800);
    expect(abstractSection).toContain("Completion Abstract");
  });
});
