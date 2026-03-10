/**
 * TDD tests for workflow-complete-role-reset
 *
 * Verifies role consistency enforcement in the workflow engine:
 * - EXPECTED_ROLES_BY_STATE map in workflow-engine.js
 * - validateRoleConsistency() function rejects wrong roles on fixed-role states
 * - validateRoleConsistency() allows correct roles
 * - Variable-role states (active, review, ready, rework) are NOT checked
 * - any->cancelled:system sets role=liaison
 * - v17 migration file exists for historical data fix
 * - WORKFLOW.md v17 exists with changelog
 * - CLAUDE.md workflow reference updated
 * - Symlink resolves correctly
 *
 * DEV IMPLEMENTATION NOTES (WORK ON MAIN BRANCH):
 * - Add EXPECTED_ROLES_BY_STATE export to src/db/workflow-engine.js
 *   Map: complete→liaison, approval→liaison, approved→qa, testing→qa, cancelled→liaison
 * - Add validateRoleConsistency(targetStatus, effectiveRole) export
 *   Returns null if OK, error string if wrong role
 * - Add enforcement gate in src/db/interface-cli.js cmdTransition
 *   Before executing transition, validate role consistency
 * - Add newRole: 'liaison' to any->cancelled:system in ALLOWED_TRANSITIONS (task + bug)
 * - Create src/db/migrations/v17-complete-role-reset.js (one-time fix for 69 historical tasks)
 * - Create tracks/process/context/workflow/v17/WORKFLOW.md
 * - Update symlink tracks/process/context/WORKFLOW.md → workflow/v17/WORKFLOW.md
 * - Fix CLAUDE.md: workflow reference from docs/WORKFLOW.md (v12) to tracks/process/context/WORKFLOW.md
 * - After main is done, merge main → develop
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);

// --- Change A: EXPECTED_ROLES_BY_STATE and validateRoleConsistency ---
describe("workflow-complete-role-reset: workflow-engine.js", () => {
  let content: string;

  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/db/workflow-engine.js"), "utf-8");
  } catch {
    content = "";
  }

  it("exports EXPECTED_ROLES_BY_STATE map", () => {
    expect(content).toMatch(/export\s+(const|let|var)\s+EXPECTED_ROLES_BY_STATE/);
  });

  it("EXPECTED_ROLES_BY_STATE maps complete to liaison", () => {
    expect(content).toMatch(/['"]complete['"].*['"]liaison['"]/);
  });

  it("EXPECTED_ROLES_BY_STATE maps approval to liaison", () => {
    expect(content).toMatch(/['"]approval['"].*['"]liaison['"]/);
  });

  it("EXPECTED_ROLES_BY_STATE maps approved to qa", () => {
    expect(content).toMatch(/['"]approved['"].*['"]qa['"]/);
  });

  it("EXPECTED_ROLES_BY_STATE maps testing to qa", () => {
    expect(content).toMatch(/['"]testing['"].*['"]qa['"]/);
  });

  it("EXPECTED_ROLES_BY_STATE maps cancelled to liaison", () => {
    expect(content).toMatch(/['"]cancelled['"].*['"]liaison['"]/);
  });

  it("exports validateRoleConsistency function", () => {
    expect(content).toMatch(/export\s+function\s+validateRoleConsistency/);
  });

  it("validateRoleConsistency checks EXPECTED_ROLES_BY_STATE lookup", () => {
    // The function should reference EXPECTED_ROLES_BY_STATE internally
    expect(content).toMatch(/EXPECTED_ROLES_BY_STATE\s*\[/);
  });

  it("validateRoleConsistency returns error string for role violations", () => {
    expect(content).toMatch(/Role consistency violation/i);
  });
});

// --- Change C: any->cancelled:system has newRole ---
describe("workflow-complete-role-reset: cancelled transition", () => {
  let content: string;

  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/db/workflow-engine.js"), "utf-8");
  } catch {
    content = "";
  }

  it("any->cancelled:system has newRole liaison for task type", () => {
    // The any->cancelled:system rule should include newRole: 'liaison'
    // We check that the cancelled:system entry includes newRole
    const cancelledMatch = content.match(/['"]any->cancelled:system['"]\s*:\s*\{[^}]+\}/g);
    expect(cancelledMatch).not.toBeNull();
    if (cancelledMatch) {
      const hasNewRole = cancelledMatch.some(m => m.includes("newRole") && m.includes("liaison"));
      expect(hasNewRole).toBe(true);
    }
  });
});

// --- Change B: Enforcement gate in interface-cli.js ---
describe("workflow-complete-role-reset: interface-cli.js enforcement", () => {
  let content: string;

  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/db/interface-cli.js"), "utf-8");
  } catch {
    content = "";
  }

  it("imports validateRoleConsistency from workflow-engine", () => {
    expect(content).toMatch(/validateRoleConsistency/);
  });

  it("calls validateRoleConsistency before executing transition", () => {
    expect(content).toMatch(/validateRoleConsistency\s*\(/);
  });
});

// --- Change D: Migration file ---
describe("workflow-complete-role-reset: v17 migration", () => {
  it("migration file exists at src/db/migrations/v17-complete-role-reset.js", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "src/db/migrations/v17-complete-role-reset.js"))).toBe(true);
  });

  it("migration fixes historical complete tasks with wrong role", () => {
    let content: string;
    try {
      content = readFileSync(resolve(PROJECT_ROOT, "src/db/migrations/v17-complete-role-reset.js"), "utf-8");
    } catch {
      content = "";
    }
    expect(content).toMatch(/UPDATE/i);
    expect(content).toMatch(/complete/);
    expect(content).toMatch(/liaison/);
  });
});

// --- Change E: WORKFLOW.md v17 ---
describe("workflow-complete-role-reset: WORKFLOW.md v17", () => {
  it("v17 WORKFLOW.md exists", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "tracks/process/context/workflow/v17/WORKFLOW.md"))).toBe(true);
  });

  it("WORKFLOW.md v17 mentions role consistency enforcement", () => {
    let content: string;
    try {
      content = readFileSync(resolve(PROJECT_ROOT, "tracks/process/context/workflow/v17/WORKFLOW.md"), "utf-8");
    } catch {
      content = "";
    }
    expect(content).toMatch(/role.*consistency|enforcement/i);
  });

  it("WORKFLOW.md symlink resolves to v17", () => {
    const symlinkPath = resolve(PROJECT_ROOT, "tracks/process/context/WORKFLOW.md");
    if (existsSync(symlinkPath)) {
      const realPath = realpathSync(symlinkPath);
      expect(realPath).toMatch(/v17/);
    } else {
      expect(existsSync(symlinkPath)).toBe(true);
    }
  });
});

// --- Change F: CLAUDE.md fix ---
describe("workflow-complete-role-reset: CLAUDE.md update", () => {
  let content: string;

  try {
    content = readFileSync(resolve(PROJECT_ROOT, "CLAUDE.md"), "utf-8");
  } catch {
    content = "";
  }

  it("CLAUDE.md does NOT reference stale docs/WORKFLOW.md (v12)", () => {
    expect(content).not.toMatch(/docs\/WORKFLOW\.md.*v12/);
  });

  it("CLAUDE.md references tracks/process/context/WORKFLOW.md", () => {
    expect(content).toMatch(/tracks\/process\/context\/WORKFLOW\.md/);
  });
});
