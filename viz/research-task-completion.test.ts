/**
 * Tests for approval→complete transition for research tasks.
 *
 * From PDSA research-task-completion-transition (2026-03-02):
 * AC-RTCT1: task type has approval->complete transition
 * AC-RTCT2: Only liaison can execute approval->complete
 * AC-RTCT3: approval->complete requires human_confirmed
 * AC-RTCT4: approval->complete requires abstract_ref in DNA
 * AC-RTCT5: Existing approval->approved path still exists
 * AC-RTCT6: Bug type does NOT have approval->complete
 * AC-RTCT7: WORKFLOW.md updated to v15
 */
import { describe, it, expect } from "vitest";

// --- AC-RTCT1: approval->complete exists for task ---

describe("AC-RTCT1: task type has approval->complete transition", () => {
  it("ALLOWED_TRANSITIONS.task has approval->complete", async () => {
    const engine = (await import(
      "../src/db/workflow-engine.js"
    )) as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { allowedActors?: string[]; requiresHumanConfirm?: boolean; requiresDna?: string[]; newRole?: string }>
    >;
    const taskTransitions = transitions["task"] ?? {};
    const rule = taskTransitions["approval->complete"];
    expect(rule).toBeDefined();
  });
});

// --- AC-RTCT2: Only liaison allowed ---

describe("AC-RTCT2: Only liaison can execute approval->complete", () => {
  it("allowedActors includes liaison", async () => {
    const engine = (await import(
      "../src/db/workflow-engine.js"
    )) as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { allowedActors?: string[] }>
    >;
    const rule = transitions["task"]["approval->complete"];
    expect(rule).toBeDefined();
    expect(rule.allowedActors).toContain("liaison");
  });

  it("allowedActors does NOT include dev, qa, or pdsa", async () => {
    const engine = (await import(
      "../src/db/workflow-engine.js"
    )) as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { allowedActors?: string[] }>
    >;
    const rule = transitions["task"]["approval->complete"];
    if (!rule) return;
    expect(rule.allowedActors).not.toContain("dev");
    expect(rule.allowedActors).not.toContain("qa");
    expect(rule.allowedActors).not.toContain("pdsa");
  });
});

// --- AC-RTCT3: Requires human_confirmed ---

describe("AC-RTCT3: approval->complete requires human_confirmed", () => {
  it("requiresHumanConfirm is true", async () => {
    const engine = (await import(
      "../src/db/workflow-engine.js"
    )) as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { requiresHumanConfirm?: boolean }>
    >;
    const rule = transitions["task"]["approval->complete"];
    expect(rule).toBeDefined();
    expect(rule.requiresHumanConfirm).toBe(true);
  });
});

// --- AC-RTCT4: Requires abstract_ref ---

describe("AC-RTCT4: approval->complete requires abstract_ref in DNA", () => {
  it("requiresDna includes abstract_ref", async () => {
    const engine = (await import(
      "../src/db/workflow-engine.js"
    )) as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { requiresDna?: string[] }>
    >;
    const rule = transitions["task"]["approval->complete"];
    expect(rule).toBeDefined();
    expect(rule.requiresDna).toBeDefined();
    expect(rule.requiresDna).toContain("abstract_ref");
  });
});

// --- AC-RTCT5: Existing approval->approved still exists ---

describe("AC-RTCT5: approval->approved still exists", () => {
  it("approval->approved remains in task transitions", async () => {
    const engine = (await import(
      "../src/db/workflow-engine.js"
    )) as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { allowedActors?: string[] }>
    >;
    const taskTransitions = transitions["task"] ?? {};
    const rule = taskTransitions["approval->approved"];
    expect(rule).toBeDefined();
    expect(rule.allowedActors).toContain("liaison");
  });
});

// --- AC-RTCT6: Bug type does NOT have approval->complete ---

describe("AC-RTCT6: Bug type has no approval->complete", () => {
  it("ALLOWED_TRANSITIONS.bug does not have approval->complete", async () => {
    const engine = (await import(
      "../src/db/workflow-engine.js"
    )) as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, unknown>
    >;
    const bugTransitions = transitions["bug"] ?? {};
    expect(bugTransitions["approval->complete"]).toBeUndefined();
  });
});

// --- AC-RTCT7: WORKFLOW.md updated to v15 ---

describe("AC-RTCT7: WORKFLOW.md updated to v15", () => {
  it("WORKFLOW.md contains v15 version indicator", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/WORKFLOW.md",
      "utf-8",
    );
    expect(content).toContain("v15");
  });

  it("WORKFLOW.md documents approval->complete transition", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/WORKFLOW.md",
      "utf-8",
    );
    expect(content.toLowerCase()).toContain("approval");
    expect(content.toLowerCase()).toContain("complete");
  });
});
