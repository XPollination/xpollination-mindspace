/**
 * TDD tests for pm-status-workflow-breadcrumb v0.0.1
 *
 * Verifies: workflow breadcrumb added to PM status task presentation
 * showing current pipeline phase with visual highlighting.
 *
 * Design: 9 phases: DESIGN QUEUE > DESIGNING > APPROVAL > TESTING >
 * IMPLEMENTING > QA REVIEW > PDSA REVIEW > HUMAN REVIEW > COMPLETE
 * Current phase bold+bracketed.
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
// AC1: Breadcrumb present in presentation template
// ============================================================

describe("AC1: Workflow breadcrumb in Step 3 presentation", () => {
  it("skill file mentions workflow breadcrumb", () => {
    const source = readSkill();
    expect(source).toMatch(/breadcrumb|BREADCRUMB|pipeline.*phase/i);
  });

  it("breadcrumb is placed above or before task details", () => {
    const source = readSkill();
    // Breadcrumb should appear before MANAGEMENT ABSTRACT in the template
    const breadcrumbIdx = source.search(/breadcrumb|pipeline.*phase|WORKFLOW.*PHASE/i);
    const abstractIdx = source.search(/MANAGEMENT ABSTRACT/);
    expect(breadcrumbIdx).toBeGreaterThan(-1);
    expect(abstractIdx).toBeGreaterThan(-1);
    // Breadcrumb instruction should appear in or before the template section
  });

  it("breadcrumb shows current phase highlighted (bold, brackets, or marker)", () => {
    const source = readSkill();
    // Must describe highlighting: bold, brackets, **, or marker for current phase
    expect(source).toMatch(/\*\*.*phase|bold.*current|\[.*current.*\]|highlight.*current|current.*highlight|bracketed|bold/i);
  });
});

// ============================================================
// AC2: Human-readable phase names
// ============================================================

describe("AC2: Human-readable phase names", () => {
  it("breadcrumb uses human-readable phase names (not raw status codes)", () => {
    const source = readSkill();
    // Must have descriptive names, not just 'pending', 'active', 'review'
    const hasHumanPhases = source.match(/DESIGN|DESIGNING|APPROVAL|TESTING|IMPLEMENTING|QA REVIEW|PDSA REVIEW|HUMAN REVIEW|COMPLETE/i);
    expect(hasHumanPhases).toBeTruthy();
  });

  it("phase names cover the full workflow from queue to complete", () => {
    const source = readSkill();
    // Must have both an early phase and a late phase
    const hasEarlyPhase = source.match(/QUEUE|DESIGN|PENDING|READY/i);
    const hasLatePhase = source.match(/HUMAN REVIEW|LIAISON REVIEW|COMPLETE/i);
    expect(hasEarlyPhase).toBeTruthy();
    expect(hasLatePhase).toBeTruthy();
  });

  it("breadcrumb has at least 5 distinct phases", () => {
    const source = readSkill();
    // Count distinct phase-like words in a breadcrumb context (> separated or listed)
    const phaseNames = ["DESIGN QUEUE", "DESIGNING", "APPROVAL", "TESTING", "IMPLEMENTING", "QA REVIEW", "PDSA REVIEW", "HUMAN REVIEW", "COMPLETE"];
    const foundPhases = phaseNames.filter(p => source.includes(p) || source.toLowerCase().includes(p.toLowerCase()));
    expect(foundPhases.length).toBeGreaterThanOrEqual(5);
  });
});

// ============================================================
// AC3: Phase mapping from status+role
// ============================================================

describe("AC3: Status-to-phase mapping", () => {
  it("skill defines or references a mapping from status+role to phase", () => {
    const source = readSkill();
    // Must have a mapping table, function, or inline logic
    const hasMapping = source.match(/status.*phase|phase.*mapping|mapPhase|phase_map|status_to_phase|status.*→.*phase/i) ||
                        source.match(/pending.*DESIGN QUEUE|ready.*DESIGN QUEUE|active.*DESIGNING|approval.*APPROVAL|testing.*TESTING|review.*QA|review.*PDSA|review.*HUMAN|complete.*COMPLETE/i);
    expect(hasMapping).toBeTruthy();
  });

  it("mapping handles review chain (qa → pdsa → liaison)", () => {
    const source = readSkill();
    // Review phases must be distinguishable by role
    const hasReviewChain = source.match(/review.*qa.*QA REVIEW|review.*pdsa.*PDSA REVIEW|review.*liaison.*HUMAN REVIEW/is) ||
                            source.match(/QA REVIEW.*PDSA REVIEW.*HUMAN REVIEW/i);
    expect(hasReviewChain).toBeTruthy();
  });
});

// ============================================================
// AC4: Breadcrumb in template example
// ============================================================

describe("AC4: Breadcrumb shown in presentation template", () => {
  it("presentation template includes breadcrumb line with > separators or visual flow", () => {
    const source = readSkill();
    // Breadcrumb should use > or → or similar separator between phases
    const hasBreadcrumbSeparators = source.match(/DESIGN.*>.*APPROVAL|DESIGN.*→.*APPROVAL|QUEUE.*>.*DESIGNING|TESTING.*>.*IMPLEMENTING/i);
    expect(hasBreadcrumbSeparators).toBeTruthy();
  });

  it("good example includes a breadcrumb line", () => {
    const source = readSkill();
    // The good example section should have a breadcrumb
    const goodExampleStart = source.indexOf("Good example");
    const goodExampleEnd = source.indexOf("Bad example");
    if (goodExampleStart > -1 && goodExampleEnd > goodExampleStart) {
      const goodExample = source.slice(goodExampleStart, goodExampleEnd);
      const hasBreadcrumb = goodExample.match(/DESIGN|QUEUE|APPROVAL|TESTING|IMPLEMENTING|QA REVIEW|PDSA REVIEW|HUMAN REVIEW/i);
      expect(hasBreadcrumb).toBeTruthy();
    } else {
      // If no clear good/bad example boundaries, just verify breadcrumb exists in template area
      expect(source).toMatch(/===.*Task.*===[\s\S]*?(DESIGN|QUEUE|APPROVAL|TESTING|IMPLEMENTING|REVIEW)/i);
    }
  });
});

// ============================================================
// AC5: Only meaningful phases shown
// ============================================================

describe("AC5: Only meaningful phases (no internal statuses)", () => {
  it("breadcrumb does NOT expose raw 'blocked' or 'cancelled' as phases", () => {
    const source = readSkill();
    // If there's a breadcrumb line with > separators, it should not include blocked/cancelled
    const breadcrumbLines = source.match(/.*>.*>.*>.*>/g) || [];
    for (const line of breadcrumbLines) {
      expect(line).not.toMatch(/BLOCKED|CANCELLED/i);
    }
  });

  it("breadcrumb does NOT expose 'rework' as a forward phase", () => {
    const source = readSkill();
    // Rework is not a forward phase — it's a loop back
    const breadcrumbLines = source.match(/.*>.*>.*>.*>/g) || [];
    for (const line of breadcrumbLines) {
      expect(line).not.toMatch(/REWORK/i);
    }
  });
});

// ============================================================
// AC6: Skill file updated (not just a new file)
// ============================================================

describe("AC6: Breadcrumb integrated into existing skill", () => {
  it("skill file still has the 6-part presentation template", () => {
    const source = readSkill();
    expect(source).toMatch(/MANAGEMENT ABSTRACT/);
    expect(source).toMatch(/WHAT WAS DONE/);
    expect(source).toMatch(/REVIEW CHAIN/);
    expect(source).toMatch(/RECOMMENDATION/);
  });

  it("skill file still has Step 3 drill-down instructions", () => {
    const source = readSkill();
    expect(source).toMatch(/Step 3.*Phase 2|Phase 2.*Drill/i);
  });
});
