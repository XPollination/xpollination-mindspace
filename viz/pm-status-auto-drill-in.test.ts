/**
 * TDD tests for pm-status-auto-drill-in v0.0.1
 *
 * Verifies: LIAISON proceeds directly from summary to drill-down
 * without asking "shall I drill in?" confirmation.
 *
 * Source: xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_PATH = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md"
);

function readSkill(): string {
  if (!existsSync(SKILL_PATH)) {
    throw new Error(`Skill file not found at ${SKILL_PATH}`);
  }
  return readFileSync(SKILL_PATH, "utf-8");
}

// ============================================================
// AC1: Auto-proceed instruction present
// ============================================================

describe("AC1: LIAISON proceeds directly to drill-down after summary", () => {
  it("skill instructs auto-proceed from summary to drill-down", () => {
    const source = readSkill();
    // Must explicitly state to proceed directly from summary to drill-down
    // Context: between Step 2 (Summary) and Step 3 (Drill-Down)
    const step2Idx = source.search(/Step 2|Phase 1.*Summary/i);
    const step3Idx = source.search(/Step 3|Phase 2.*Drill/i);
    expect(step2Idx).toBeGreaterThan(-1);
    expect(step3Idx).toBeGreaterThan(-1);
    // The section between Step 2 and Step 3 (or Step 2 itself) must have auto-proceed instruction
    const betweenSection = source.slice(step2Idx, step3Idx + 200);
    const hasAutoProceed = betweenSection.match(/proceed.*directly.*drill|immediately.*proceed.*Phase 2|automatically.*drill|directly.*drill.*down|proceed.*immediately.*drill|do not.*ask|do not.*wait|no.*confirmation.*needed/i);
    expect(hasAutoProceed).toBeTruthy();
  });

  it("no pause or confirmation step between summary and drill-down", () => {
    const source = readSkill();
    // Must NOT have instructions to ask/confirm/wait between Step 2 and Step 3
    expect(source).not.toMatch(/shall I drill|shall I proceed|want me to drill|confirm.*drill/i);
  });
});

// ============================================================
// AC2: No "shall I drill in" or similar question
// ============================================================

describe("AC2: No drill-in confirmation question", () => {
  it("skill does not contain 'shall I drill in' phrasing", () => {
    const source = readSkill();
    expect(source).not.toMatch(/shall I drill in/i);
  });

  it("skill does not contain 'do you want to drill' phrasing", () => {
    const source = readSkill();
    expect(source).not.toMatch(/do you want to drill/i);
  });

  it("skill does not contain 'ready to drill' confirmation", () => {
    const source = readSkill();
    expect(source).not.toMatch(/ready to drill|ready to review each/i);
  });
});

// ============================================================
// AC3: Summary table still presented before drill-down
// ============================================================

describe("AC3: Summary table preserved", () => {
  it("Step 2 summary table still exists", () => {
    const source = readSkill();
    expect(source).toMatch(/Summary Table|Phase 1.*Summary/i);
  });

  it("summary appears before drill-down in document order", () => {
    const source = readSkill();
    const summaryIdx = source.search(/Phase 1.*Summary|Summary Table/i);
    const drillDownIdx = source.search(/Phase 2.*Drill|Sequential.*Drill/i);
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(drillDownIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeLessThan(drillDownIdx);
  });

  it("DECISIONS NEEDED and REVIEWS PENDING categories preserved", () => {
    const source = readSkill();
    expect(source).toMatch(/DECISIONS NEEDED/);
    expect(source).toMatch(/REVIEWS PENDING/);
  });
});
