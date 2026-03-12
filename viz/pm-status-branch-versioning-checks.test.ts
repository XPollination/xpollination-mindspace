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
 *
 * v0.0.6 ADDITIONS:
 * - Remove all references to skill split (pm.scan / pm.drill)
 * - PROD deployment port = 8080 (not 4100)
 * - TEST deployment port = 4200
 * - Document port migration 8080→4100 as future work
 * - Deployment action guidance with symlink + service restart
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

  // --- v0.0.6 Requirement 1: No skill split references ---
  describe("v0.0.6: no skill split", () => {
    it("does not reference pm.scan or pm.drill as separate skills", () => {
      expect(content).not.toMatch(/pm\.scan/);
      expect(content).not.toMatch(/pm\.drill/);
    });

    it("does not recommend splitting the skill", () => {
      expect(content).not.toMatch(/split.*skill|skill.*split/i);
    });
  });

  // --- v0.0.6 Requirement 2: Deployment action guidance ---
  describe("v0.0.6: deployment action guidance", () => {
    it("PROD deployment shows port 8080", () => {
      expect(content).toMatch(/PROD.*8080|8080.*PROD/i);
    });

    it("TEST deployment shows port 4200", () => {
      expect(content).toMatch(/TEST.*4200|4200.*TEST/i);
    });

    it("does NOT show port 4100 as current PROD", () => {
      // 4100 may appear only in future migration context, not as current prod
      const prodLines = content.split("\n").filter(
        (l) => /deploy.*prod|prod.*deploy/i.test(l) && /4100/.test(l)
      );
      expect(prodLines.length).toBe(0);
    });

    it("documents port migration 8080→4100 as future/planned", () => {
      expect(content).toMatch(/8080.*4100|migration.*4100|planned.*4100/i);
    });

    it("includes symlink update for deployment", () => {
      expect(content).toMatch(/ln\s+-sfn|symlink/i);
    });

    it("includes service restart for deployment", () => {
      expect(content).toMatch(/systemctl.*restart|restart.*service/i);
    });

    it("documents current infrastructure (PROD=8080, TEST=4200)", () => {
      expect(content).toMatch(/PROD.*8080/i);
      expect(content).toMatch(/TEST.*4200/i);
    });

    it("verification curl uses port 8080 for PROD", () => {
      expect(content).toMatch(/curl.*8080|localhost:8080/);
    });
  });

  // --- v0.0.7: Rendering Style Guide ---
  describe("v0.0.7: rendering style guide", () => {
    it("has Rendering Style Guide section", () => {
      expect(content).toMatch(/Rendering Style Guide/);
    });
  });

  // --- v0.0.7: HUMAN APPROVAL rename ---
  describe("v0.0.7: HUMAN APPROVAL", () => {
    it("status-to-phase table uses HUMAN APPROVAL (not just APPROVAL)", () => {
      expect(content).toMatch(/HUMAN APPROVAL/);
    });

    it("breadcrumb uses HUMAN APPROVAL", () => {
      // Breadcrumb line should contain HUMAN APPROVAL
      const breadcrumbLines = content.split("\n").filter(
        (l) => /DESIGN QUEUE.*COMPLETE/.test(l)
      );
      expect(breadcrumbLines.length).toBeGreaterThan(0);
      expect(breadcrumbLines[0]).toMatch(/HUMAN APPROVAL/);
    });
  });

  // --- v0.0.7: Visual hierarchy ---
  describe("v0.0.7: visual hierarchy", () => {
    it("drill-down template has slug on own line", () => {
      expect(content).toMatch(/\*\*Slug:\*\*.*`.*`/);
    });

    it("drill-down template has phase callout on own line", () => {
      expect(content).toMatch(/\*\*Phase:\*\*.*YOU ARE HERE/);
    });

    it("current phase is bolded in breadcrumb", () => {
      expect(content).toMatch(/>>>\*\*.*\*\*<<</);
    });
  });

  // --- v0.0.7: AskUserQuestion for SEMI mode ---
  describe("v0.0.7: SEMI mode AskUserQuestion", () => {
    it("SEMI mode uses AskUserQuestion", () => {
      expect(content).toMatch(/AskUserQuestion/);
    });

    it("does NOT say Do NOT use AskUserQuestion", () => {
      expect(content).not.toMatch(/Do NOT use AskUserQuestion|do not use AskUserQuestion/i);
    });
  });

  // --- v0.0.7: DEPLOYMENT VERIFICATION check ---
  describe("v0.0.7: deployment verification", () => {
    it("has DEPLOYMENT VERIFICATION as 4th check", () => {
      expect(content).toMatch(/DEPLOYMENT.*VERIFICATION|DEPLOYMENT/);
    });

    it("reads viz/active symlink", () => {
      expect(content).toMatch(/viz\/active|readlink/);
    });

    it("compares active version to latest version directory", () => {
      expect(content).toMatch(/latest.*version|deployment.*gap/i);
    });

    it("DEPLOYMENT header in presentation template", () => {
      expect(content).toMatch(/DEPLOYMENT:.*OK|WARN|N\/A/);
    });
  });

  // --- v0.0.7: Good example updated ---
  describe("v0.0.7: good example format", () => {
    it("good example has slug on own line", () => {
      const goodExample = content.match(/Good [Ee]xample[\s\S]*?```[\s\S]*?```/);
      expect(goodExample).not.toBeNull();
      expect(goodExample![0]).toMatch(/\*\*Slug:\*\*/);
    });

    it("good example has phase callout", () => {
      const goodExample = content.match(/Good [Ee]xample[\s\S]*?```[\s\S]*?```/);
      expect(goodExample).not.toBeNull();
      expect(goodExample![0]).toMatch(/\*\*Phase:\*\*/);
    });

    it("good example uses HUMAN APPROVAL in breadcrumb", () => {
      const goodExample = content.match(/Good [Ee]xample[\s\S]*?```[\s\S]*?```/);
      expect(goodExample).not.toBeNull();
      expect(goodExample![0]).toMatch(/HUMAN APPROVAL/);
    });

    it("good example includes DEPLOYMENT header", () => {
      const goodExample = content.match(/Good [Ee]xample[\s\S]*?```[\s\S]*?```/);
      expect(goodExample).not.toBeNull();
      expect(goodExample![0]).toMatch(/DEPLOYMENT/);
    });
  });

  // --- v0.0.7: No cross-version references ---
  describe("v0.0.7: self-contained", () => {
    it("no see v0.0.X references", () => {
      expect(content).not.toMatch(/see v0\.0\.[0-9]/);
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
