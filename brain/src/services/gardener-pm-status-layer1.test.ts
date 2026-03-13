/**
 * Gardener PM Status Layer 1 Tests (gardener-pm-status-layer1 task)
 *
 * Tests that the PM status skill includes brain health gardening phase.
 *
 * Acceptance criteria:
 * AC1: PM status includes Brain Health section showing contribution counts, noise, and domains
 * AC2: Toggleable via config flag layer1_enabled
 * AC3: Runs shallow depth only — no mutations, count/categorize/flag only
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Skills live in best-practices/.claude/skills/ (git-tracked source)
// __dirname = api/src/services → 3 levels up = best-practices
const PROJECT_ROOT = resolve(__dirname, "../../..");
const PM_STATUS_SKILL_PATH = resolve(
  PROJECT_ROOT,
  ".claude/skills/xpo.claude.mindspace.pm.status/SKILL.md"
);
const GARDENER_SKILL_PATH = resolve(
  PROJECT_ROOT,
  ".claude/skills/xpo.claude.mindspace.garden/SKILL.md"
);

// --- Pre-check: skill files exist ---

describe("Prerequisites", () => {
  it("PM status skill exists", () => {
    expect(existsSync(PM_STATUS_SKILL_PATH)).toBe(true);
  });

  it("gardener engine skill exists (dependency)", () => {
    expect(existsSync(GARDENER_SKILL_PATH)).toBe(true);
  });
});

// --- AC1: Brain Health section in PM status ---

describe("AC1: Brain Health section in PM status output", () => {
  it("PM status skill contains Brain Health section", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/brain.?health/);
  });

  it("Brain Health section mentions contribution counts", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    // Should reference counting/count of thoughts/contributions
    expect(content).toMatch(/count|contribution|thought.*\d|new.*thought/);
  });

  it("Brain Health section mentions noise detection", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/noise|duplicate|flag/);
  });

  it("Brain Health section mentions active domains", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/domain|categor|topic/);
  });

  it("Brain Health is presented BEFORE task drill-down (Study before Act)", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8");
    const brainHealthIdx = content.toLowerCase().indexOf("brain health");
    const drillDownIdx = content.toLowerCase().indexOf("drill-down");
    // Brain Health must appear before the drill-down phase
    expect(brainHealthIdx).toBeGreaterThan(-1);
    expect(drillDownIdx).toBeGreaterThan(-1);
    expect(brainHealthIdx).toBeLessThan(drillDownIdx);
  });
});

// --- AC2: Toggleable via layer1_enabled ---

describe("AC2: layer1_enabled config toggle", () => {
  it("skill contains layer1_enabled configuration", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/layer1.?enabled/);
  });

  it("layer1_enabled defaults to true", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    // Should document that default is true/enabled
    expect(content).toMatch(/layer1.?enabled.*true|default.*true.*layer1|enabled.*default/);
  });

  it("skill documents how to skip brain health when disabled", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    // Should mention skipping/disabling the brain health step
    expect(content).toMatch(/skip|disable|false.*skip|layer1.*false/);
  });
});

// --- AC3: Shallow depth only, no mutations ---

describe("AC3: Shallow depth only — no mutations", () => {
  it("calls gardener with scope=recent depth=shallow", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/recent.*shallow|garden.*recent.*shallow/);
  });

  it("does NOT call micro or deep depth", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8");
    // Find the gardener invocation section and verify it uses shallow
    const gardenCallMatch = content.match(/garden[^\n]*(?:recent|shallow)[^\n]*/i);
    expect(gardenCallMatch).not.toBeNull();
    if (gardenCallMatch) {
      const callLine = gardenCallMatch[0].toLowerCase();
      expect(callLine).not.toContain("micro");
      expect(callLine).not.toContain("deep");
    }
  });

  it("gardener call is read-only (no refine/consolidate/supersede in Layer 1)", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    // The Brain Health section should mention it's read-only/no mutations
    // Find the brain health section
    const bhStart = content.indexOf("brain health");
    if (bhStart > -1) {
      // Get ~500 chars after "brain health" for the section
      const section = content.substring(bhStart, bhStart + 500);
      // Should mention read-only, no mutations, or shallow (which is inherently read-only)
      expect(section).toMatch(/shallow|read.?only|no.*mutat|report|diagnostic/);
    }
  });
});

// --- Integration: gardener invocation ---

describe("Gardener integration", () => {
  it("invokes gardener engine skill (not raw curl)", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    // Should reference the gardener skill, not raw brain API calls for gardening
    expect(content).toMatch(/xpo\.claude\.mindspace\.garden|garden.*skill|\/.*garden/);
  });

  it("presents gardener output in summary format", () => {
    const content = readFileSync(PM_STATUS_SKILL_PATH, "utf-8").toLowerCase();
    // Should format gardener output for PM status display
    expect(content).toMatch(/brain.?health|summary|report|status/);
  });
});
