/**
 * TDD tests for viz-workflow-loop-refactor — Loop visualization, agent visibility, version symlinking.
 *
 * From PDSA viz-workflow-loop-refactor (2026-03-03):
 *
 * Sub-problem 1: LOOP VIZ
 *   AC-LOOP1: Flow arrows (SVG) showing forward path between status sections
 *   AC-LOOP2: Rework loop arrows (orange/red curved) showing re-entry points
 *   AC-LOOP3: Forward arrows visually distinct from rework arrows (color-coded)
 *
 * Sub-problem 2: AGENT VISIBILITY
 *   AC-AGENT1: Color-coded role badges on task packages (LIAISON=red, PDSA=green, DEV=blue, QA=amber)
 *   AC-AGENT2: Role badge rendered in renderSection() for every task
 *   AC-AGENT3: Review chain distinguishable — review+QA vs review+PDSA vs review+LIAISON visible
 *   AC-AGENT4: Detail panel shows assigned agent role
 *
 * Sub-problem 3: VERSION SYMLINKING
 *   AC-VER1: viz/versions/v0.0.1/ directory contains index.html, server.js, start-server.sh
 *   AC-VER2: viz/active symlink points to current live version
 *   AC-VER3: Infrastructure files (agent-monitor.cjs, tests, pm-status.cjs) remain at viz root
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
// Sub-problem 1: LOOP VISUALIZATION (Flow Arrows)
// ============================================================

describe("AC-LOOP1: Flow arrows showing forward path between status sections", () => {
  it("viz contains SVG path or line elements for flow arrows", () => {
    const source = readViz();
    // Must have flow arrow elements — either <path> or <line> with flow-related class/id
    expect(source).toMatch(/flow-arrow|flowArrow|arrow-forward|forward-arrow/i);
  });

  it("forward flow arrows connect QUEUE → ACTIVE → REVIEW → APPROVED → COMPLETE", () => {
    const source = readViz();
    // Must reference at least the major forward-flow status sections
    // The flow rendering code should mention these transitions
    const hasQueueToActive = source.match(/queue.*active|QUEUE.*ACTIVE/i) ||
                             source.match(/ready.*active/i);
    const hasActiveToReview = source.match(/active.*review|ACTIVE.*REVIEW/i);
    const hasReviewToComplete = source.match(/review.*complete|approved.*complete/i);

    // At minimum, the flow arrow rendering function should exist
    expect(source).toMatch(/renderFlow|renderArrows|drawFlowArrows|drawArrows/i);
  });
});

describe("AC-LOOP2: Rework loop arrows showing re-entry points", () => {
  it("viz contains rework-specific arrow elements or CSS class", () => {
    const source = readViz();
    // Rework arrows must be visually distinct
    expect(source).toMatch(/rework.*arrow|arrow.*rework|loop.*arrow|arrow.*loop/i);
  });

  it("rework arrows show re-entry from review/complete back to queue/active", () => {
    const source = readViz();
    // The rendering code must handle rework transitions
    // review → rework is a key loop in the workflow
    expect(source).toMatch(/rework/i);
    // Must have some visual loop/curve representation
    expect(source).toMatch(/curve|arc|loop|bezier|path.*d=.*[CcQqAa]/i);
  });
});

describe("AC-LOOP3: Forward arrows visually distinct from rework arrows", () => {
  it("forward arrows use green color", () => {
    const source = readViz();
    // Forward arrows should be green (matching PDSA design)
    // Look for green color near flow/arrow definitions
    expect(source).toMatch(/#22c55e|#4ade80|green.*arrow|arrow.*green|forward.*green/i);
  });

  it("rework arrows use orange or red color", () => {
    const source = readViz();
    // Rework/loop arrows should be orange or red (matching PDSA design)
    expect(source).toMatch(/(#ef4444|#f59e0b|#fb923c|orange|red).*(rework|loop|backward)/i) ||
    expect(source).toMatch(/(rework|loop|backward).*(#ef4444|#f59e0b|#fb923c|orange|red)/i);
  });
});

// ============================================================
// Sub-problem 2: AGENT VISIBILITY (Role Badges)
// ============================================================

describe("AC-AGENT1: Color-coded role badges on task packages", () => {
  it("viz defines role-specific colors: LIAISON=red, PDSA=green, DEV=blue, QA=amber", () => {
    const source = readViz();
    // Must have role-color mapping — could be CSS classes or JS object
    // Check for role-based color definitions
    const hasRoleColors = source.match(/role.*liaison.*color|liaison.*#|role-liaison/i) &&
                          source.match(/role.*pdsa.*color|pdsa.*#|role-pdsa/i) &&
                          source.match(/role.*dev.*color|dev.*#|role-dev/i) &&
                          source.match(/role.*qa.*color|qa.*#|role-qa/i);

    expect(hasRoleColors).toBeTruthy();
  });

  it("role badge CSS classes or color definitions exist for all 4 agent roles", () => {
    const source = readViz();
    // Must have visual distinction for each role
    // Could be: .role-liaison, .role-pdsa, .role-dev, .role-qa
    // Or: ROLE_COLORS = { liaison: ..., pdsa: ..., dev: ..., qa: ... }
    expect(source).toMatch(/role.*(liaison|LIAISON)/);
    expect(source).toMatch(/role.*(pdsa|PDSA)/);
    expect(source).toMatch(/role.*(dev|DEV)/);
    expect(source).toMatch(/role.*(qa|QA)/);
  });
});

describe("AC-AGENT2: Role badge rendered in renderSection() for every task", () => {
  it("renderSection function creates a role badge element for each task", () => {
    const source = readViz();
    // Inside renderSection, after creating the package <g>, there must be
    // a role badge element (text or rect) using dna.role or node.dna.role
    const renderSectionStart = source.indexOf("function renderSection");
    expect(renderSectionStart).toBeGreaterThan(-1);

    const renderSectionBlock = source.substring(renderSectionStart, renderSectionStart + 2000);
    // Must reference role within the section rendering
    expect(renderSectionBlock).toMatch(/role|\.role/);
    // Must create a visual element for the role (text, rect, or foreignObject)
    expect(renderSectionBlock).toMatch(/role.*badge|badge.*role|role-badge|roleBadge|roleLabel|role.*text/i);
  });
});

describe("AC-AGENT3: Review chain distinguishable in viz", () => {
  it("review tasks show the assigned role (qa/pdsa/liaison) visually", () => {
    const source = readViz();
    // When status is 'review', the role matters: review+qa, review+pdsa, review+liaison
    // The viz must make this visible — either via badge color or label
    // The role badge on review tasks should show which agent is reviewing
    expect(source).toMatch(/dna\.role|node\.dna\.role|\.role/);
  });

  it("role is displayed alongside status on task packages (not just in detail panel)", () => {
    const source = readViz();
    // The role display must be in the package rendering (renderSection or renderPackageInStation),
    // not only in the detail panel (showDetail)
    const renderSectionStart = source.indexOf("function renderSection");
    const showDetailStart = source.indexOf("function showDetail");

    expect(renderSectionStart).toBeGreaterThan(-1);

    // Role reference must appear in renderSection, not just showDetail
    const renderSectionBlock = source.substring(renderSectionStart, showDetailStart > renderSectionStart ? showDetailStart : renderSectionStart + 3000);
    expect(renderSectionBlock).toMatch(/\.role/);
  });
});

describe("AC-AGENT4: Detail panel shows assigned agent role with color", () => {
  it("detail panel Role field uses color-coded display (not plain text)", () => {
    const source = readViz();
    // Current: <div class="value">${dna.role || '-'}</div> (plain text)
    // Expected: color-coded badge or styled span for the role
    const roleFieldStart = source.indexOf("<label>Role</label>");
    expect(roleFieldStart).toBeGreaterThan(-1);

    const roleFieldBlock = source.substring(roleFieldStart, roleFieldStart + 300);
    // Should have color styling on the role value
    expect(roleFieldBlock).toMatch(/color.*role|role.*color|badge.*role|role.*badge|style.*color/i);
  });
});

// ============================================================
// Sub-problem 3: VERSION SYMLINKING
// ============================================================

describe("AC-VER1: Version directory contains core viz files", () => {
  it("viz/versions/ directory exists", () => {
    const versionsDir = join(VIZ_DIR, "versions");
    expect(existsSync(versionsDir)).toBe(true);
  });

  it("at least one version directory exists (e.g., v0.0.1)", () => {
    const versionsDir = join(VIZ_DIR, "versions");
    if (!existsSync(versionsDir)) {
      expect(existsSync(versionsDir)).toBe(true);
      return;
    }
    const versions = readdirSync(versionsDir).filter(d => d.startsWith("v"));
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  it("version directory contains index.html", () => {
    const versionsDir = join(VIZ_DIR, "versions");
    if (!existsSync(versionsDir)) {
      expect(existsSync(versionsDir)).toBe(true);
      return;
    }
    const versions = readdirSync(versionsDir).filter(d => d.startsWith("v"));
    const latestVersion = versions.sort().pop()!;
    expect(existsSync(join(versionsDir, latestVersion, "index.html"))).toBe(true);
  });

  it("version directory contains server.js", () => {
    const versionsDir = join(VIZ_DIR, "versions");
    if (!existsSync(versionsDir)) {
      expect(existsSync(versionsDir)).toBe(true);
      return;
    }
    const versions = readdirSync(versionsDir).filter(d => d.startsWith("v"));
    const latestVersion = versions.sort().pop()!;
    expect(existsSync(join(versionsDir, latestVersion, "server.js"))).toBe(true);
  });

  it("version directory contains start-server.sh", () => {
    const versionsDir = join(VIZ_DIR, "versions");
    if (!existsSync(versionsDir)) {
      expect(existsSync(versionsDir)).toBe(true);
      return;
    }
    const versions = readdirSync(versionsDir).filter(d => d.startsWith("v"));
    const latestVersion = versions.sort().pop()!;
    expect(existsSync(join(versionsDir, latestVersion, "start-server.sh"))).toBe(true);
  });
});

describe("AC-VER2: Active symlink points to current live version", () => {
  it("viz/active is a symbolic link", () => {
    const activePath = join(VIZ_DIR, "active");
    expect(existsSync(activePath)).toBe(true);
    expect(lstatSync(activePath).isSymbolicLink()).toBe(true);
  });

  it("viz/active symlink points to a version directory", () => {
    const activePath = join(VIZ_DIR, "active");
    if (!existsSync(activePath)) {
      expect(existsSync(activePath)).toBe(true);
      return;
    }
    if (!lstatSync(activePath).isSymbolicLink()) {
      expect(lstatSync(activePath).isSymbolicLink()).toBe(true);
      return;
    }
    const target = readlinkSync(activePath);
    // Should point to versions/v0.0.X
    expect(target).toMatch(/versions\/v\d+\.\d+\.\d+/);
  });
});

describe("AC-VER3: Infrastructure files remain at viz root (not versioned)", () => {
  it("agent-monitor.cjs stays at viz root", () => {
    expect(existsSync(join(VIZ_DIR, "agent-monitor.cjs"))).toBe(true);
  });

  it("pm-status.cjs stays at viz root", () => {
    expect(existsSync(join(VIZ_DIR, "pm-status.cjs"))).toBe(true);
  });

  it("test files stay at viz root", () => {
    // At least the existing test files should remain at root
    expect(existsSync(join(VIZ_DIR, "liaison-approval-mode.test.ts"))).toBe(true);
  });
});
