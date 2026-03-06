/**
 * TDD tests for rework-liaison-role-routing
 *
 * Bug: review+liaison→rework routes to rework+liaison instead of correct role.
 * Fix: require rework_target_role in DNA for review+liaison→rework.
 *
 * PDSA test cases:
 * 1. review+liaison→rework WITHOUT rework_target_role → should fail (requiresDna gate)
 * 2. review+liaison→rework WITH rework_target_role: 'dev' → should succeed, role=dev
 * 3. review+liaison→rework WITH rework_target_role: 'pdsa' → should succeed, role=pdsa
 * 4. review+liaison→rework WITH rework_target_role: 'invalid' → should fail
 * 5. Existing complete->rework with rework_target_role → unchanged behavior
 *
 * DEV IMPLEMENTATION NOTES:
 * - Change A (interface-cli.js): Replace binary heuristic at lines 615-620 with
 *   rework_target_role check. Error if missing or invalid. Set newRole = dna.rework_target_role.
 * - Change B (workflow-engine.js): Add requiresDna: ['rework_target_role'] to
 *   review->rework:liaison transition rule.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const PROJECT_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);
const CLI_PATH = resolve(PROJECT_DIR, "src/db/interface-cli.js");

// --- Part 1: Workflow engine rule checks (Change B) ---

describe("workflow-engine: review->rework:liaison rule", () => {
  let transitions: Record<string, Record<string, any>>;

  beforeAll(async () => {
    const engine = (await import("../src/db/workflow-engine.js")) as Record<string, unknown>;
    transitions = engine.ALLOWED_TRANSITIONS as Record<string, Record<string, any>>;
  });

  it("task: review->rework:liaison requires rework_target_role in DNA", () => {
    const taskTransitions = transitions["task"] ?? {};
    const rule = taskTransitions["review->rework:liaison"];
    expect(rule).toBeDefined();
    expect(rule.requiresDna).toBeDefined();
    expect(rule.requiresDna).toContain("rework_target_role");
  });

  it("task: review->rework:liaison allows liaison actor", () => {
    const taskTransitions = transitions["task"] ?? {};
    const rule = taskTransitions["review->rework:liaison"];
    expect(rule.allowedActors).toContain("liaison");
  });

  it("task: review->rework:liaison requires liaison role", () => {
    const taskTransitions = transitions["task"] ?? {};
    const rule = taskTransitions["review->rework:liaison"];
    expect(rule.requireRole).toBe("liaison");
  });

  it("task: complete->rework still requires rework_target_role (unchanged)", () => {
    const taskTransitions = transitions["task"] ?? {};
    const rule = taskTransitions["complete->rework"];
    expect(rule).toBeDefined();
    expect(rule.requiresDna).toContain("rework_target_role");
  });
});

// --- Part 2: CLI role assignment logic (Change A) ---
// Tests that the interface-cli.js override uses rework_target_role

describe("interface-cli: liaison rework role assignment", () => {
  // Helper: run CLI against production DB (read-only checks, no mutations)
  function cliGet(slug: string): any {
    try {
      const stdout = execSync(
        `DATABASE_PATH=${PROJECT_DIR}/data/xpollination.db node ${CLI_PATH} get ${slug}`,
        { encoding: "utf-8", cwd: PROJECT_DIR, timeout: 10000 }
      );
      return JSON.parse(stdout);
    } catch {
      return null;
    }
  }

  it("interface-cli.js does NOT have the old binary heuristic (pdsa_ref ? pdsa : liaison)", () => {
    // The old code: newRole = dna.pdsa_ref ? 'pdsa' : 'liaison';
    // This should be replaced with rework_target_role check
    const source = execSync(`cat ${CLI_PATH}`, { encoding: "utf-8" });

    // The old pattern should NOT exist (binary heuristic based on pdsa_ref for rework routing)
    const hasBinaryHeuristic = /dna\.pdsa_ref\s*\?\s*['"]pdsa['"]\s*:\s*['"]liaison['"]/.test(source);
    expect(hasBinaryHeuristic).toBe(false);
  });

  it("interface-cli.js uses dna.rework_target_role when liaison reworks from review", () => {
    const source = execSync(`cat ${CLI_PATH}`, { encoding: "utf-8" });

    // The liaison rework section (review + rework + liaison check block)
    // must assign newRole from dna.rework_target_role, NOT from pdsa_ref heuristic
    // Look for: newRole = dna.rework_target_role (in the liaison rework context)
    const hasAssignment = /newRole\s*=\s*dna\.rework_target_role/.test(source);
    expect(hasAssignment).toBe(true);
  });

  it("interface-cli.js errors when rework_target_role is missing for liaison rework", () => {
    const source = execSync(`cat ${CLI_PATH}`, { encoding: "utf-8" });

    // Should have error message about missing rework_target_role
    const hasErrorMessage = /rework_target_role.*required|requires.*rework_target_role/i.test(source);
    expect(hasErrorMessage).toBe(true);
  });
});
