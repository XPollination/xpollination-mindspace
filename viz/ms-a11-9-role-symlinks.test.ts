/**
 * TDD tests for ms-a11-9-role-symlinks
 *
 * Verifies role symlinks setup:
 * - scripts/setup-role-symlinks.sh exists
 * - Creates symlinks: connect.as.pdsa, .dev, .qa, .liaison
 * - SKILL.md references role extraction
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create scripts/setup-role-symlinks.sh:
 *   - Creates symlinks for each role
 *   - Links to xpo.agent.connect skill
 *   - Makes script executable
 * - Update skills/xpo.agent.connect/SKILL.md:
 *   - Document role extraction from symlink name
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

describe("ms-a11-9-role-symlinks: setup script", () => {
  it("setup-role-symlinks.sh exists", () => {
    const paths = [
      resolve(PROJECT_ROOT, "scripts/setup-role-symlinks.sh"),
      resolve(PROJECT_ROOT, "viz/setup-role-symlinks.sh"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "scripts/setup-role-symlinks.sh"),
      resolve(PROJECT_ROOT, "viz/setup-role-symlinks.sh"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates pdsa symlink", () => {
    expect(content).toMatch(/pdsa/);
  });

  it("creates dev symlink", () => {
    expect(content).toMatch(/dev/);
  });

  it("creates qa symlink", () => {
    expect(content).toMatch(/qa/);
  });

  it("creates liaison symlink", () => {
    expect(content).toMatch(/liaison/);
  });

  it("uses ln -s or symlink command", () => {
    expect(content).toMatch(/ln\s+-s|symlink/i);
  });
});
