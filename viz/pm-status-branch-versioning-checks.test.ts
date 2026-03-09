/**
 * TDD tests for pm-status-branch-versioning-checks
 *
 * Verifies 3 new verification checks added to PM status skill Step 3:
 * - Branch compliance (git branch --contains)
 * - Versioning validation (tracks/ semver check)
 * - Ref URL validation (pdsa_ref, changelog_ref repo matching)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Modify xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md
 * - Insert verification block as step 2b in Step 3 (between DNA retrieval and presentation)
 * - Add BRANCH COMPLIANCE, VERSIONING, REF VALIDATION headers to presentation template
 * - Update good example to include the three headers
 * - Route VIOLATION/WARN to RECOMMENDATION section
 * - Do NOT change existing structure (approval mode check, DNA retrieval, transition execution)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_PATH = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices",
  ".claude/skills/xpo.claude.mindspace.pm.status/SKILL.md"
);

const content = readFileSync(SKILL_PATH, "utf-8");

describe("pm-status-branch-versioning-checks", () => {
  // --- Requirement 1: BRANCH COMPLIANCE check instructions ---
  describe("branch compliance check", () => {
    it("contains BRANCH COMPLIANCE check instructions", () => {
      expect(content).toMatch(/BRANCH COMPLIANCE/);
    });

    it("references git branch --contains for commit verification", () => {
      expect(content).toMatch(/git.*branch\s+--contains/);
    });

    it("defines VIOLATION for main-only commits", () => {
      expect(content).toMatch(/VIOLATION/i);
      expect(content).toMatch(/main/);
    });

    it("extracts commit hashes from DNA fields", () => {
      // Must mention extracting commits from DNA (implementation, changelog_ref, etc.)
      expect(content).toMatch(/commit.*hash|[0-9a-f]\{7/i);
    });
  });

  // --- Requirement 2: VERSIONING check instructions ---
  describe("versioning check", () => {
    it("contains VERSIONING check instructions", () => {
      expect(content).toMatch(/VERSIONING/);
    });

    it("checks tracks/ directory for semver pattern", () => {
      expect(content).toMatch(/tracks\//);
      expect(content).toMatch(/v\[?0-9/);
    });

    it("verifies PDSA.md presence in version directories", () => {
      expect(content).toMatch(/PDSA\.md/);
    });
  });

  // --- Requirement 3: REF VALIDATION check instructions ---
  describe("ref validation check", () => {
    it("contains REF VALIDATION check instructions", () => {
      expect(content).toMatch(/REF VALIDATION/);
    });

    it("validates pdsa_ref and changelog_ref URLs", () => {
      expect(content).toMatch(/pdsa_ref/);
      expect(content).toMatch(/changelog_ref/);
    });

    it("checks repo name in GitHub URLs matches actual project", () => {
      expect(content).toMatch(/repo.*mismatch|mismatch.*repo|wrong.*repo/i);
    });
  });

  // --- Requirement 4: All three headers in presentation template ---
  describe("presentation template headers", () => {
    it("has all three verification headers after breadcrumb in template", () => {
      // Headers should appear in the presentation section (Step 3)
      expect(content).toMatch(/BRANCH COMPLIANCE.*:.*OK|VIOLATION|N\/A/s);
      expect(content).toMatch(/VERSIONING.*:.*OK|WARN|N\/A/s);
      expect(content).toMatch(/REF VALIDATION.*:.*OK|WARN|N\/A/s);
    });
  });

  // --- Requirement 5: Good example includes the three headers ---
  describe("good example", () => {
    it("good example includes BRANCH COMPLIANCE header", () => {
      // Find the good example section and check it has the headers
      const goodExampleMatch = content.match(/Good example[\s\S]*?```[\s\S]*?```/);
      expect(goodExampleMatch).not.toBeNull();
      expect(goodExampleMatch![0]).toMatch(/BRANCH COMPLIANCE/);
    });

    it("good example includes VERSIONING header", () => {
      const goodExampleMatch = content.match(/Good example[\s\S]*?```[\s\S]*?```/);
      expect(goodExampleMatch).not.toBeNull();
      expect(goodExampleMatch![0]).toMatch(/VERSIONING/);
    });

    it("good example includes REF VALIDATION header", () => {
      const goodExampleMatch = content.match(/Good example[\s\S]*?```[\s\S]*?```/);
      expect(goodExampleMatch).not.toBeNull();
      expect(goodExampleMatch![0]).toMatch(/REF VALIDATION/);
    });
  });

  // --- Requirement 6: VIOLATION/WARN routed to RECOMMENDATION ---
  describe("violation/warn routing", () => {
    it("routes VIOLATION findings to RECOMMENDATION section", () => {
      expect(content).toMatch(/VIOLATION[\s\S]*?RECOMMENDATION|RECOMMENDATION[\s\S]*?VIOLATION/i);
    });

    it("routes WARN findings to RECOMMENDATION section", () => {
      expect(content).toMatch(/WARN[\s\S]*?RECOMMENDATION|RECOMMENDATION[\s\S]*?WARN/i);
    });
  });

  // --- Requirement 7: Existing structure unchanged ---
  describe("existing structure preserved", () => {
    it("still checks LIAISON approval mode before each task", () => {
      expect(content).toMatch(/liaison.approval.mode|approval-mode/i);
    });

    it("still retrieves full DNA via CLI get", () => {
      expect(content).toMatch(/node.*\$CLI\s+get|interface-cli.*get/);
    });

    it("still executes transitions (approved, complete, rework)", () => {
      expect(content).toMatch(/transition.*approved/);
      expect(content).toMatch(/transition.*complete/);
      expect(content).toMatch(/transition.*rework/);
    });

    it("still has Step 1 scan, Step 2 summary, Step 3 drill-down, Step 4 wrap up", () => {
      expect(content).toMatch(/## Step 1/);
      expect(content).toMatch(/## Step 2/);
      expect(content).toMatch(/## Step 3/);
      expect(content).toMatch(/## Step 4/);
    });
  });
});
