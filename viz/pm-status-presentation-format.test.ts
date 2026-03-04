/**
 * TDD tests for pm-status-skill-presentation-format
 *
 * Verifies the xpo.claude.mindspace.pm.status skill (SKILL.md) contains
 * the structured 6-part presentation format for LIAISON task presentation.
 *
 * Acceptance criteria:
 *   AC1: Step 3.3 includes 6-part presentation template
 *   AC2: Template includes good vs bad example
 *   AC3: Skill states LIAISON must evaluate and recommend
 *   AC4: Format works for approval and review+liaison types
 *   AC5: Brain learnings referenced
 *
 * Source: xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md
 * Installed at: ~/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md
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
// AC1: Step 3.3 includes 6-part presentation template
// ============================================================

describe("AC1: 6-part presentation template in Step 3", () => {
  it("skill file exists", () => {
    expect(existsSync(SKILL_PATH)).toBe(true);
  });

  it("Step 3 presents tasks using structured format", () => {
    const source = readSkill();
    expect(source).toMatch(/Step 3|Phase 2/);
    expect(source).toMatch(/present.*structured|structured.*format/i);
  });

  it("template has MANAGEMENT ABSTRACT section", () => {
    const source = readSkill();
    expect(source).toMatch(/MANAGEMENT ABSTRACT/);
  });

  it("template has WHAT WAS DONE section", () => {
    const source = readSkill();
    expect(source).toMatch(/WHAT WAS DONE/);
  });

  it("template has REVIEW CHAIN section with table format", () => {
    const source = readSkill();
    expect(source).toMatch(/REVIEW CHAIN/);
    // Must have a table with Reviewer column
    expect(source).toMatch(/Reviewer.*Result|Result.*Reviewer/i);
  });

  it("template has SCOPE & RISK section", () => {
    const source = readSkill();
    expect(source).toMatch(/SCOPE.*RISK|SCOPE & RISK/i);
  });

  it("template has RECOMMENDATION section", () => {
    const source = readSkill();
    expect(source).toMatch(/RECOMMENDATION/);
  });

  it("template has header with N-of-M, type, priority", () => {
    const source = readSkill();
    // Header should show task number, type, priority
    expect(source).toMatch(/Task.*N.*of.*M|N of M/i);
    expect(source).toMatch(/Type.*Priority|Priority.*Type/i);
  });
});

// ============================================================
// AC2: Template includes good vs bad example
// ============================================================

describe("AC2: Good vs bad example included", () => {
  it("skill includes a good example", () => {
    const source = readSkill();
    expect(source).toMatch(/[Gg]ood example/);
  });

  it("skill includes a bad example", () => {
    const source = readSkill();
    expect(source).toMatch(/[Bb]ad example/);
  });

  it("bad example shows what NOT to do", () => {
    const source = readSkill();
    // Bad example should warn against dumping raw DNA
    expect(source).toMatch(/do NOT|dumps raw|without evaluation/i);
  });
});

// ============================================================
// AC3: LIAISON must evaluate and recommend
// ============================================================

describe("AC3: LIAISON evaluation and recommendation required", () => {
  it("skill states LIAISON must evaluate", () => {
    const source = readSkill();
    expect(source).toMatch(/LIAISON.*evaluate|evaluate.*recommend/i);
  });

  it("skill states LIAISON must recommend APPROVE or REWORK", () => {
    const source = readSkill();
    expect(source).toMatch(/APPROVE.*REWORK|recommend.*APPROVE/i);
  });

  it("skill says LIAISON thinks — not just presents data", () => {
    const source = readSkill();
    expect(source).toMatch(/LIAISON.*thinks|Thomas decides.*LIAISON thinks/i);
  });
});

// ============================================================
// AC4: Format works for approval AND review+liaison
// ============================================================

describe("AC4: Format works for both task types", () => {
  it("skill mentions approval tasks", () => {
    const source = readSkill();
    expect(source).toMatch(/approval.*task|task.*approval/i);
  });

  it("skill mentions review+liaison tasks", () => {
    const source = readSkill();
    expect(source).toMatch(/review.*liaison/i);
  });

  it("skill differentiates presentation for design vs implementation reviews", () => {
    const source = readSkill();
    // For approval: WHAT WAS DONE covers design
    // For review+liaison: WHAT WAS DONE covers implementation
    const hasDifferentiation = source.match(/approval.*design|design.*review/i) ||
                               source.match(/implementation.*review|review.*implementation/i);
    expect(hasDifferentiation).toBeTruthy();
  });
});

// ============================================================
// AC5: Brain learnings referenced
// ============================================================

describe("AC5: Brain learnings referenced", () => {
  it("Management Abstract first principle is documented", () => {
    const source = readSkill();
    // Management Abstract should come first — this is a brain learning
    expect(source).toMatch(/Management Abstract.*first|first.*Management Abstract|Abstract comes FIRST/i);
  });
});
