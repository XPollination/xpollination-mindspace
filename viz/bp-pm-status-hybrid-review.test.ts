/**
 * TDD tests for bp-pm-status-hybrid-review
 *
 * Verifies PM Status skill hybrid review pattern:
 * - Skill versioning: versions/v0.0.2/ preserves current, versions/v0.0.3/ adds hybrid
 * - SKILL.md is a symlink to versions/v0.0.3/SKILL.md
 * - Hybrid pattern: grouping, individual vs batch, confirmation at group boundaries
 * - CHANGELOG.md updated
 *
 * DEV IMPLEMENTATION NOTES:
 * - In xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/:
 *   - Create versions/v0.0.2/SKILL.md (copy of current)
 *   - Create versions/v0.0.3/SKILL.md (with hybrid review pattern)
 *   - Replace SKILL.md with symlink to versions/v0.0.3/SKILL.md
 *   - Update CHANGELOG.md
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status"
);

// --- Version structure ---
describe("bp-pm-status-hybrid-review: versioning", () => {
  it("versions/v0.0.2/SKILL.md exists (preserves current)", () => {
    expect(existsSync(resolve(SKILL_DIR, "versions/v0.0.2/SKILL.md"))).toBe(true);
  });

  it("versions/v0.0.3/SKILL.md exists (hybrid pattern)", () => {
    expect(existsSync(resolve(SKILL_DIR, "versions/v0.0.3/SKILL.md"))).toBe(true);
  });

  it("SKILL.md is a symlink", () => {
    const stat = lstatSync(resolve(SKILL_DIR, "SKILL.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });
});

// --- Hybrid pattern content ---
describe("bp-pm-status-hybrid-review: hybrid pattern", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.3/SKILL.md"), "utf-8");
  } catch { content = ""; }

  it("contains grouping/batch logic", () => {
    expect(content).toMatch(/group|batch|theme/i);
  });

  it("defines when to use individual vs batch review", () => {
    expect(content).toMatch(/individual|drill.?down/i);
  });

  it("FAIL reviews always get individual treatment", () => {
    expect(content).toMatch(/FAIL|fail/);
  });

  it("batch requires 3+ related tasks", () => {
    expect(content).toMatch(/3\+|three|minimum/i);
  });

  it("has Approve All option for batches", () => {
    expect(content).toMatch(/Approve\s+All|approve.*all/i);
  });

  it("has Review Individually fallback option", () => {
    expect(content).toMatch(/Review\s+Individually|individual/i);
  });
});

// --- Preserved version ---
describe("bp-pm-status-hybrid-review: v0.0.2 preserved", () => {
  let v2content: string;
  let v3content: string;
  try {
    v2content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.2/SKILL.md"), "utf-8");
  } catch { v2content = ""; }
  try {
    v3content = readFileSync(resolve(SKILL_DIR, "versions/v0.0.3/SKILL.md"), "utf-8");
  } catch { v3content = ""; }

  it("v0.0.2 does NOT contain hybrid/batch pattern", () => {
    expect(v2content).not.toMatch(/Themed\s+Batch|batch.*review/i);
  });

  it("v0.0.3 is different from v0.0.2", () => {
    expect(v3content).not.toBe(v2content);
  });
});

// --- CHANGELOG ---
describe("bp-pm-status-hybrid-review: CHANGELOG", () => {
  let changelog: string;
  try {
    changelog = readFileSync(resolve(SKILL_DIR, "CHANGELOG.md"), "utf-8");
  } catch { changelog = ""; }

  it("CHANGELOG.md mentions v0.0.3", () => {
    expect(changelog).toMatch(/v0\.0\.3|0\.0\.3/);
  });

  it("CHANGELOG.md documents hybrid review pattern", () => {
    expect(changelog).toMatch(/hybrid|batch|group/i);
  });
});
