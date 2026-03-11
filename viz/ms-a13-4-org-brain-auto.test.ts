/**
 * TDD tests for ms-a13-4-org-brain-auto
 *
 * Verifies auto-contribute to org brain on task completion:
 * - Service: contributeTaskCompletion function
 * - Integration: task-transitions hooks on complete
 * - Best-effort (brain failure doesn't block)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/brain-contribution.ts:
 *   - Export contributeTaskCompletion(task, projectSlug)
 *   - POST to brain API with task title, project, thought_category='task_completion'
 *   - agent_id='system', agent_name='SYSTEM'
 *   - Best-effort: catch errors, log warning, never throw
 * - Update api/routes/task-transitions.ts:
 *   - After transition to 'complete', call contributeTaskCompletion
 *   - Use .catch(() => {}) for best-effort
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a13-4-org-brain-auto: service", () => {
  it("brain-contribution service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/brain-contribution.ts"),
      resolve(API_DIR, "services/brainContribution.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/brain-contribution.ts"),
      resolve(API_DIR, "services/brainContribution.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports contributeTaskCompletion function", () => {
    expect(content).toMatch(/export.*contributeTaskCompletion|exports.*contributeTaskCompletion/);
  });

  it("includes task title in contribution", () => {
    expect(content).toMatch(/title/);
  });

  it("uses thought_category task_completion", () => {
    expect(content).toMatch(/task_completion/);
  });

  it("uses system agent_id", () => {
    expect(content).toMatch(/system/i);
  });

  it("POSTs to brain API", () => {
    expect(content).toMatch(/POST|fetch|memory/i);
  });

  it("handles errors gracefully (best-effort)", () => {
    expect(content).toMatch(/catch|try|warn/i);
  });
});

describe("ms-a13-4-org-brain-auto: integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/task-transitions.ts"), "utf-8");
  } catch { content = ""; }

  it("task-transitions references brain contribution on complete", () => {
    expect(content).toMatch(/contributeTaskCompletion|brain.*contribut/i);
  });
});
