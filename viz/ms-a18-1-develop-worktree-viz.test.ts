/**
 * TDD tests for ms-a18-1-develop-worktree-viz
 *
 * Verifies develop worktree serves mindspace-test (4200):
 * - mindspace-test.service ExecStart points to viz/server.js (not viz/active/server.js)
 * - CLAUDE.md documents viz environments (4100=PROD/main, 4200=TEST/develop)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update /etc/systemd/system/mindspace-test.service:
 *   - ExecStart: node viz/server.js 4200 (not viz/active/server.js)
 *   - WorkingDirectory: develop worktree path
 * - Update ~/.claude/CLAUDE.md: document viz environments
 * - Requires sudo via thomas user for systemd changes
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- Service file ---
describe("ms-a18-1-develop-worktree-viz: service config", () => {
  let serviceContent: string;
  try {
    serviceContent = execSync("cat /etc/systemd/system/mindspace-test.service 2>/dev/null || echo ''", { encoding: "utf-8" });
  } catch { serviceContent = ""; }

  it("mindspace-test.service ExecStart uses viz/server.js", () => {
    expect(serviceContent).toMatch(/viz\/server\.js/);
  });

  it("mindspace-test.service does NOT use viz/active/server.js", () => {
    expect(serviceContent).not.toMatch(/viz\/active\/server\.js/);
  });

  it("mindspace-test.service specifies port 4200", () => {
    expect(serviceContent).toMatch(/4200/);
  });
});

// --- Documentation ---
describe("ms-a18-1-develop-worktree-viz: documentation", () => {
  let claudemd: string;
  try {
    claudemd = readFileSync(resolve("/home/developer/.claude/CLAUDE.md"), "utf-8");
  } catch { claudemd = ""; }

  it("CLAUDE.md documents viz environments", () => {
    expect(claudemd).toMatch(/4100|4200|viz.*environment|PROD|TEST/i);
  });

  it("CLAUDE.md mentions develop worktree", () => {
    expect(claudemd).toMatch(/develop|worktree/i);
  });
});
