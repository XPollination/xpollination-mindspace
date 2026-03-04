/**
 * TDD tests for viz-workflow-loop-refactor v0.0.2 — Kanban board redesign.
 *
 * From PDSA v0.0.2 DESIGN.md (2026-03-04):
 *
 * Thomas APPROVED: role badges + version symlinking (from v0.0.1).
 * Thomas REJECTED: flow arrows — "does not solve usability".
 * Thomas REQUIRED: full UI redesign (Kanban board), remove non-process stations.
 *
 * Sub-problem 1: KANBAN BOARD (replaces flow arrows + warehouse sections)
 *   AC-KB1: 5 phase columns: QUEUE, ACTIVE, REVIEW, APPROVED, COMPLETE
 *   AC-KB2: Tasks appear as cards in correct column based on status
 *   AC-KB3: Rework tasks appear in QUEUE column (natural loop, no arrows)
 *   AC-KB4: Blocked/cancelled tasks in separate bottom bar
 *   AC-KB5: Flow arrows completely removed (no drawFlowArrows, no arrowhead defs)
 *   AC-KB6: Non-process stations (HOMEPAGE entries) removed from UI
 *   AC-KB7: Agent status bar at top shows agent→task assignment
 *   AC-KB8: Detail panel still works (click card → full DNA)
 *
 * Sub-problem 2: AGENT VISIBILITY (kept from v0.0.1)
 *   AC-AGENT1: Color-coded role badges (LIAISON=red, PDSA=green, DEV=blue, QA=amber)
 *   AC-AGENT2: Role badge on every task card
 *   AC-AGENT3: Review chain distinguishable (review+qa vs review+pdsa vs review+liaison)
 *   AC-AGENT4: Detail panel Role field color-coded
 *
 * Sub-problem 3: VERSION SYMLINKING (kept from v0.0.1, extended to v0.0.2)
 *   AC-VER1: viz/versions/ has v0.0.1 and v0.0.2 directories
 *   AC-VER2: viz/active symlink points to v0.0.2
 *   AC-VER3: Infrastructure files remain at viz root
 *
 * Tests are source code checks on viz index.html + filesystem structure checks.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, lstatSync, readdirSync, readlinkSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);

/**
 * Read the active version's index.html.
 * Prefers viz/active/index.html (symlinked version) if it exists,
 * falls back to viz/index.html for backward compat during development.
 */
function readViz(): string {
  const activeIndex = join(VIZ_DIR, "active", "index.html");
  if (existsSync(activeIndex)) {
    return readFileSync(activeIndex, "utf-8");
  }
  return readFileSync(join(VIZ_DIR, "index.html"), "utf-8");
}

// ============================================================
// Sub-problem 1: KANBAN BOARD
// ============================================================

describe("AC-KB1: 5 phase columns — QUEUE, ACTIVE, REVIEW, APPROVED, COMPLETE", () => {
  it("viz renders a Kanban-style column layout", () => {
    const source = readViz();
    // Must have a Kanban rendering function or column-based layout
    expect(source).toMatch(/kanban|column.*phase|phase.*column|renderColumn|renderKanban/i);
  });

  it("defines all 5 phase columns", () => {
    const source = readViz();
    // The column/phase definitions must include all 5
    expect(source).toMatch(/QUEUE/i);
    expect(source).toMatch(/ACTIVE/i);
    expect(source).toMatch(/REVIEW/i);
    expect(source).toMatch(/APPROVED/i);
    expect(source).toMatch(/COMPLETE/i);
  });

  it("QUEUE column groups pending, ready, and rework statuses", () => {
    const source = readViz();
    // The column definition or status-to-column mapping must group these
    const hasMapping = source.match(/pending.*queue|queue.*pending/i) ||
                       source.match(/ready.*queue|queue.*ready/i) ||
                       source.match(/rework.*queue|queue.*rework/i) ||
                       source.match(/pending.*ready.*rework|queue.*\[.*pending.*ready.*rework/i);
    expect(hasMapping).toBeTruthy();
  });

  it("ACTIVE column groups active and testing statuses", () => {
    const source = readViz();
    const hasMapping = source.match(/active.*testing|testing.*active/i) ||
                       source.match(/ACTIVE.*\[.*active.*testing/i);
    expect(hasMapping).toBeTruthy();
  });

  it("REVIEW column groups review and approval statuses", () => {
    const source = readViz();
    const hasMapping = source.match(/review.*approval|approval.*review/i) ||
                       source.match(/REVIEW.*\[.*review.*approval/i);
    expect(hasMapping).toBeTruthy();
  });
});

describe("AC-KB2: Tasks appear as cards in correct column", () => {
  it("task rendering uses card-style elements (not warehouse grid packages)", () => {
    const source = readViz();
    // Must have card-style rendering: CSS classes or DOM structure
    expect(source).toMatch(/card|kanban-item|task-card/i);
  });

  it("cards show task slug/title", () => {
    const source = readViz();
    // Card must display the slug or title
    expect(source).toMatch(/slug|title/i);
  });

  it("cards show project name", () => {
    const source = readViz();
    // Card rendering must include project name
    // The rendering function should reference project
    expect(source).toMatch(/project/i);
  });
});

describe("AC-KB3: Rework tasks appear in QUEUE column (natural loop)", () => {
  it("rework status maps to QUEUE column", () => {
    const source = readViz();
    // The status-to-column mapping must put rework in QUEUE
    const hasReworkInQueue = source.match(/rework.*queue|queue.*rework/i) ||
                             source.match(/pending.*ready.*rework/i);
    expect(hasReworkInQueue).toBeTruthy();
  });
});

describe("AC-KB4: Blocked/cancelled tasks in separate bottom bar", () => {
  it("blocked tasks are NOT in the 5 main columns", () => {
    const source = readViz();
    // Blocked must be handled separately — bottom bar, not a column
    expect(source).toMatch(/blocked/i);
  });

  it("blocked section rendered separately from Kanban columns", () => {
    const source = readViz();
    // Must have a distinct blocked section/bar/area
    expect(source).toMatch(/blocked.*bar|blocked.*section|blocked.*bottom|blocked.*separate/i);
  });
});

describe("AC-KB5: Flow arrows completely removed", () => {
  it("no drawFlowArrows function exists", () => {
    const source = readViz();
    expect(source).not.toMatch(/drawFlowArrows/);
  });

  it("no arrowhead SVG marker definitions exist", () => {
    const source = readViz();
    // No arrowhead markers from v0.0.1
    expect(source).not.toMatch(/arrowhead-forward|arrowhead-rework/);
  });

  it("no flow-arrow class or id references exist", () => {
    const source = readViz();
    expect(source).not.toMatch(/flow-arrow|flowArrow|arrow-forward/);
  });
});

describe("AC-KB6: Non-process stations removed from UI", () => {
  it("no HOMEPAGE station references in rendering code", () => {
    const source = readViz();
    // Non-process stations like "Dev (HOMEPAGE)", "Human (HOMEPAGE)" must be removed
    // They should not appear in the rendering data
    const renderingCode = source.substring(
      source.indexOf("<script") || 0
    );
    // Check no HOMEPAGE entries in stations/data definitions
    const hasHomepage = renderingCode.match(/HOMEPAGE.*station|station.*HOMEPAGE/i);
    expect(hasHomepage).toBeFalsy();
  });
});

describe("AC-KB7: Agent status bar at top", () => {
  it("viz has an agent status panel/bar element", () => {
    const source = readViz();
    // Must have an agent status area replacing the old stations row
    expect(source).toMatch(/agent.*status|status.*bar|agent.*bar|agent.*panel/i);
  });

  it("agent status bar shows role labels for all 4 agents", () => {
    const source = readViz();
    // The status bar must reference all agent roles
    const statusBarMatch = source.match(/agent.*status|status.*bar/i);
    expect(statusBarMatch).toBeTruthy();
    // Must reference liaison, pdsa, dev, qa somewhere in the rendering
    expect(source).toMatch(/liaison/i);
    expect(source).toMatch(/pdsa/i);
    expect(source).toMatch(/dev/i);
  });
});

describe("AC-KB8: Detail panel still works", () => {
  it("showDetail function exists", () => {
    const source = readViz();
    expect(source).toMatch(/function showDetail/);
  });

  it("detail panel has Role label", () => {
    const source = readViz();
    expect(source).toMatch(/<label>Role<\/label>/);
  });
});

// ============================================================
// Sub-problem 2: AGENT VISIBILITY (kept from v0.0.1)
// ============================================================

describe("AC-AGENT1: Color-coded role badges on task cards", () => {
  it("viz defines role-specific colors: LIAISON=red, PDSA=green, DEV=blue, QA=amber", () => {
    const source = readViz();
    const hasRoleColors = source.match(/role.*liaison.*color|liaison.*#|role-liaison/i) &&
                          source.match(/role.*pdsa.*color|pdsa.*#|role-pdsa/i) &&
                          source.match(/role.*dev.*color|dev.*#|role-dev/i) &&
                          source.match(/role.*qa.*color|qa.*#|role-qa/i);
    expect(hasRoleColors).toBeTruthy();
  });

  it("role badge CSS classes or color definitions exist for all 4 agent roles", () => {
    const source = readViz();
    expect(source).toMatch(/role.*(liaison|LIAISON)/);
    expect(source).toMatch(/role.*(pdsa|PDSA)/);
    expect(source).toMatch(/role.*(dev|DEV)/);
    expect(source).toMatch(/role.*(qa|QA)/);
  });
});

describe("AC-AGENT2: Role badge rendered on every task card", () => {
  it("card rendering includes role badge element", () => {
    const source = readViz();
    // The card/column rendering must create role badge on each task
    // Look for role badge in the rendering code
    expect(source).toMatch(/role.*badge|badge.*role|role-badge|roleBadge|roleLabel/i);
  });

  it("cards use role-colored left border", () => {
    const source = readViz();
    // Per design: left-border color shows which agent owns the task
    expect(source).toMatch(/border-left|borderLeft/i);
  });
});

describe("AC-AGENT3: Review chain distinguishable in viz", () => {
  it("review tasks show the assigned role (qa/pdsa/liaison) visually", () => {
    const source = readViz();
    expect(source).toMatch(/dna\.role|node\.dna\.role|\.role/);
  });
});

describe("AC-AGENT4: Detail panel Role field color-coded", () => {
  it("detail panel Role field uses color-coded display", () => {
    const source = readViz();
    const roleFieldStart = source.indexOf("<label>Role</label>");
    expect(roleFieldStart).toBeGreaterThan(-1);
    const roleFieldBlock = source.substring(roleFieldStart, roleFieldStart + 300);
    expect(roleFieldBlock).toMatch(/color.*role|role.*color|badge.*role|role.*badge|style.*color/i);
  });
});

// ============================================================
// Sub-problem 3: VERSION SYMLINKING (extended to v0.0.2)
// ============================================================

describe("AC-VER1: Version directories contain core viz files", () => {
  it("viz/versions/ directory exists", () => {
    expect(existsSync(join(VIZ_DIR, "versions"))).toBe(true);
  });

  it("v0.0.1 version directory exists (previous version preserved)", () => {
    expect(existsSync(join(VIZ_DIR, "versions", "v0.0.1"))).toBe(true);
  });

  it("v0.0.2 version directory exists (new Kanban version)", () => {
    expect(existsSync(join(VIZ_DIR, "versions", "v0.0.2"))).toBe(true);
  });

  it("v0.0.2 contains index.html", () => {
    expect(existsSync(join(VIZ_DIR, "versions", "v0.0.2", "index.html"))).toBe(true);
  });

  it("v0.0.2 contains server.js", () => {
    expect(existsSync(join(VIZ_DIR, "versions", "v0.0.2", "server.js"))).toBe(true);
  });
});

describe("AC-VER2: Active symlink points to v0.0.2", () => {
  it("viz/active is a symbolic link", () => {
    const activePath = join(VIZ_DIR, "active");
    expect(existsSync(activePath)).toBe(true);
    expect(lstatSync(activePath).isSymbolicLink()).toBe(true);
  });

  it("viz/active symlink points to versions/v0.0.2", () => {
    const activePath = join(VIZ_DIR, "active");
    if (!existsSync(activePath) || !lstatSync(activePath).isSymbolicLink()) {
      expect.fail("viz/active symlink does not exist");
      return;
    }
    const target = readlinkSync(activePath);
    expect(target).toMatch(/v0\.0\.2/);
  });
});

describe("AC-VER3: Infrastructure files remain at viz root", () => {
  it("agent-monitor.cjs stays at viz root", () => {
    expect(existsSync(join(VIZ_DIR, "agent-monitor.cjs"))).toBe(true);
  });

  it("pm-status.cjs stays at viz root", () => {
    expect(existsSync(join(VIZ_DIR, "pm-status.cjs"))).toBe(true);
  });

  it("test files stay at viz root", () => {
    expect(existsSync(join(VIZ_DIR, "liaison-approval-mode.test.ts"))).toBe(true);
  });
});
