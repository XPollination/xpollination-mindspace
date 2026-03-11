/**
 * TDD tests for bp-pm-status-progress-feedback
 *
 * Verifies PM Status skill v0.0.4: progress feedback during batch preparation.
 * 5-stage protocol so humans can see preparation is active (not stuck).
 *
 * From PDSA pm-status-skill v0.0.1:
 * AC-PF1: Stage 1 message before first DNA fetch
 * AC-PF2: DNA progress for each task when ≤5
 * AC-PF3: DNA progress every 3rd task when >5
 * AC-PF4: Grouping result (individual vs batch counts)
 * AC-PF5: "Preparation complete" before first presentation
 * AC-PF6: Continuous output during preparation (no >10s silence)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create .claude/skills/xpo.claude.mindspace.pm.status/versions/v0.0.4/SKILL.md
 * - Update SKILL.md symlink to point to v0.0.4
 * - Update CHANGELOG.md with v0.0.4 entry
 * - Add 5-stage progress protocol to batch preparation section:
 *   Stage 1: Preparation start with value framing
 *   Stage 2: DNA fetch progress (every task if ≤5, every 3rd if >5)
 *   Stage 3: Verification notification
 *   Stage 4: Grouping result (individual vs batch counts)
 *   Stage 5: Preparation complete
 * - Agents MUST output at each stage
 * - Include slow-response hint for >5s fetches
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status"
);

// --- Skill file structure ---

describe("PM Status v0.0.4: skill file structure", () => {
  it("v0.0.4 SKILL.md exists", () => {
    expect(existsSync(resolve(SKILL_DIR, "versions/v0.0.4/SKILL.md"))).toBe(true);
  });

  it("SKILL.md symlink points to v0.0.4", () => {
    const target = readlinkSync(resolve(SKILL_DIR, "SKILL.md"));
    expect(target).toMatch(/v0\.0\.4/);
  });

  it("CHANGELOG.md contains v0.0.4 entry", () => {
    const changelog = readFileSync(resolve(SKILL_DIR, "CHANGELOG.md"), "utf-8");
    expect(changelog).toMatch(/v0\.0\.4|0\.0\.4/);
  });

  it("CHANGELOG.md describes progress feedback", () => {
    const changelog = readFileSync(resolve(SKILL_DIR, "CHANGELOG.md"), "utf-8");
    expect(changelog).toMatch(/progress|feedback/i);
  });
});

// --- AC-PF1: Stage 1 — preparation start ---

describe("AC-PF1: Stage 1 — preparation start with value framing", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.4/SKILL.md"), "utf-8");
  } catch {
    content = "";
  }

  it("includes Stage 1 or preparation start instruction", () => {
    expect(content).toMatch(/stage\s*1|preparation.*start|preparing/i);
  });

  it("frames preparation as value (not delay)", () => {
    expect(content).toMatch(/consolidat|efficien|value|optimiz/i);
  });
});

// --- AC-PF2: Stage 2 — DNA fetch progress (≤5 tasks) ---

describe("AC-PF2: Stage 2 — DNA fetch progress for small batches", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.4/SKILL.md"), "utf-8");
  } catch {
    content = "";
  }

  it("includes DNA fetch progress instructions", () => {
    expect(content).toMatch(/DNA|fetch|progress/i);
  });

  it("mentions per-task progress for small batches (≤5)", () => {
    expect(content).toMatch(/5|every\s+task|each\s+task/i);
  });
});

// --- AC-PF3: Stage 2 — DNA fetch progress (>5 tasks) ---

describe("AC-PF3: Stage 2 — DNA fetch progress for large batches", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.4/SKILL.md"), "utf-8");
  } catch {
    content = "";
  }

  it("mentions batched progress for large batches (>5)", () => {
    expect(content).toMatch(/3rd|every\s*3|batch|larger/i);
  });
});

// --- AC-PF4: Stage 4 — grouping result ---

describe("AC-PF4: Stage 4 — grouping result", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.4/SKILL.md"), "utf-8");
  } catch {
    content = "";
  }

  it("includes grouping/categorization stage", () => {
    expect(content).toMatch(/group|categor|individual|batch/i);
  });

  it("mentions count of individual vs batch", () => {
    expect(content).toMatch(/count|individual|batch/i);
  });
});

// --- AC-PF5: Stage 5 — preparation complete ---

describe("AC-PF5: Stage 5 — preparation complete", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.4/SKILL.md"), "utf-8");
  } catch {
    content = "";
  }

  it("includes preparation complete message", () => {
    expect(content).toMatch(/preparation\s*complete|ready\s*to\s*present|ready\s*for\s*review/i);
  });
});

// --- AC-PF6: Continuous output (no long silence) ---

describe("AC-PF6: continuous output instruction", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.4/SKILL.md"), "utf-8");
  } catch {
    content = "";
  }

  it("instructs agent to output at each stage", () => {
    expect(content).toMatch(/MUST\s*output|must\s*print|output.*each.*stage|stage.*output/i);
  });

  it("mentions slow-response or timeout hint", () => {
    expect(content).toMatch(/slow|5\s*s|timeout|taking\s*longer/i);
  });

  it("has 5 stages defined", () => {
    // Count stage references — should have at least 5 distinct stages
    const stageMatches = content.match(/stage\s*[1-5]/gi) || [];
    expect(stageMatches.length).toBeGreaterThanOrEqual(5);
  });
});
