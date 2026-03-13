/**
 * Gardener Transition Layer 3 Tests (gardener-transition-layer3 task)
 *
 * Tests that the monitor skill includes micro-gardening hook on task completion.
 *
 * Acceptance criteria:
 * AC1: On task completion with Layer 3 enabled, consolidation thought created
 * AC2: Intermediate entries archived for that task
 * AC3: Toggleable via config flag layer3_enabled
 * AC4: Does not run when toggle is off
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Monitor skill lives in best-practices/.claude/skills/
// __dirname = api/src/services → 3 levels up = best-practices
const PROJECT_ROOT = resolve(__dirname, "../../..");
const MONITOR_SKILL_PATH = resolve(
  PROJECT_ROOT,
  ".claude/skills/xpo.claude.monitor/SKILL.md"
);
const GARDENER_SKILL_PATH = resolve(
  PROJECT_ROOT,
  ".claude/skills/xpo.claude.mindspace.garden/SKILL.md"
);

// --- Prerequisites ---

describe("Prerequisites", () => {
  it("monitor skill exists", () => {
    expect(existsSync(MONITOR_SKILL_PATH)).toBe(true);
  });

  it("gardener engine skill exists (dependency)", () => {
    expect(existsSync(GARDENER_SKILL_PATH)).toBe(true);
  });
});

// --- AC1: Consolidation on task completion ---

describe("AC1: Micro-gardening on task completion", () => {
  it("monitor skill contains micro-gardening step", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/micro.?garden|layer.?3|post.?completion/);
  });

  it("micro-gardening calls gardener with task scope and micro depth", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/task:.*micro|scope.*task.*depth.*micro|garden.*task.*micro/);
  });

  it("micro-gardening triggers only on complete transitions", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    // Should mention complete/completion as the trigger condition
    expect(content).toMatch(/complet.*transition|transition.*complet|next.?state.*complet/);
  });

  it("micro-gardening invokes gardener engine skill", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/xpo\.claude\.mindspace\.garden|garden.*skill|\/.*garden/);
  });
});

// --- AC2: Intermediate entries archived ---

describe("AC2: Intermediate entries archived", () => {
  it("skill mentions archiving intermediate/transitional thoughts", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/archiv|intermediate|transition.*marker/);
  });

  it("consolidation creates summary thought for the task", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/consolidat|summary.*thought|learning/);
  });
});

// --- AC3: layer3_enabled toggle ---

describe("AC3: layer3_enabled config toggle", () => {
  it("monitor skill contains layer3_enabled configuration", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/layer3.?enabled/);
  });

  it("layer3_enabled defaults to true", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/layer3.?enabled.*true|default.*true.*layer3/);
  });
});

// --- AC4: Does not run when toggle is off ---

describe("AC4: Skip when disabled", () => {
  it("skill documents skipping gardening when layer3_enabled is false", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/skip|disable|false.*skip|layer3.*false/);
  });
});

// --- Resilience: gardener failure does not block completion ---

describe("Resilience", () => {
  it("gardener failure does not block task completion", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/fail.*block|error.*continu|optional|best.?effort|does not block/);
  });

  it("micro-gardening step appears AFTER the transition (7b), not before", () => {
    const content = readFileSync(MONITOR_SKILL_PATH, "utf-8");
    const transitionIdx = content.indexOf("7b");
    const gardenIdx = content.toLowerCase().indexOf("micro-garden");
    if (gardenIdx > -1 && transitionIdx > -1) {
      // Micro-gardening should come after the transition marker (7b)
      expect(gardenIdx).toBeGreaterThan(transitionIdx);
    } else {
      // If not found, test will be caught by other tests
      expect(gardenIdx).toBeGreaterThan(-1);
    }
  });
});
