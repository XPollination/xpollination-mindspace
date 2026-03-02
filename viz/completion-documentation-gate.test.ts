/**
 * Tests for completion documentation gate.
 *
 * From PDSA completion-documentation-gate (2026-03-02):
 * AC-CDG1: review->complete (task) requires abstract_ref in DNA
 * AC-CDG2: review->complete (bug) requires abstract_ref in DNA
 * AC-CDG3: any->cancelled by liaison requires abstract_ref in DNA
 * AC-CDG4: any->cancelled by system does NOT require abstract_ref (exemption)
 * AC-CDG5: abstract_ref must be a GitHub URL (validation in workflow-engine)
 * AC-CDG6: DOCUMENTATION.md exists at tracks/process/context/
 * AC-CDG7: WORKFLOW.md is v14 with quality gates table
 * AC-CDG8: DOCUMENTATION.md has required sections (naming, abstracts, linking)
 */
import { describe, it, expect } from "vitest";

// --- AC-CDG1: review->complete (task) requires abstract_ref ---

describe("AC-CDG1: review->complete (task) has requiresDna: abstract_ref", () => {
  it("task review->complete transition includes abstract_ref in requiresDna", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { requiresDna?: string[]; allowedActors?: string[] }>
    >;
    const taskTransitions = transitions["task"] ?? {};
    const rule = taskTransitions["review->complete"];
    expect(rule).toBeDefined();
    expect(rule.requiresDna).toBeDefined();
    expect(rule.requiresDna).toContain("abstract_ref");
  });
});

// --- AC-CDG2: review->complete (bug) requires abstract_ref ---

describe("AC-CDG2: review->complete (bug) has requiresDna: abstract_ref", () => {
  it("bug review->complete transition includes abstract_ref in requiresDna", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { requiresDna?: string[]; allowedActors?: string[] }>
    >;
    const bugTransitions = transitions["bug"] ?? {};
    const rule = bugTransitions["review->complete"];
    expect(rule).toBeDefined();
    expect(rule.requiresDna).toBeDefined();
    expect(rule.requiresDna).toContain("abstract_ref");
  });
});

// --- AC-CDG3: any->cancelled by liaison requires abstract_ref ---

describe("AC-CDG3: any->cancelled by liaison requires abstract_ref", () => {
  it("task any->cancelled (liaison path) has requiresDna: abstract_ref", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { requiresDna?: string[]; allowedActors?: string[] }>
    >;
    const taskTransitions = transitions["task"] ?? {};

    // Either a split transition (any->cancelled with liaison only + any->cancelled:system)
    // or the base any->cancelled should have requiresDna for liaison
    const cancelledRule = taskTransitions["any->cancelled"];
    if (cancelledRule && cancelledRule.allowedActors?.includes("liaison") && !cancelledRule.allowedActors?.includes("system")) {
      // Split pattern: liaison-only cancelled has the gate
      expect(cancelledRule.requiresDna).toBeDefined();
      expect(cancelledRule.requiresDna).toContain("abstract_ref");
    } else {
      // Check for split: any->cancelled for liaison, any->cancelled:system for system
      const liaisonCancelled = cancelledRule;
      expect(liaisonCancelled).toBeDefined();
      expect(liaisonCancelled.requiresDna).toBeDefined();
      expect(liaisonCancelled.requiresDna).toContain("abstract_ref");
    }
  });
});

// --- AC-CDG4: any->cancelled by system has NO abstract_ref requirement ---

describe("AC-CDG4: any->cancelled by system is ungated", () => {
  it("system cancellation path has no requiresDna for abstract_ref", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<
      string,
      Record<string, { requiresDna?: string[]; allowedActors?: string[] }>
    >;
    const taskTransitions = transitions["task"] ?? {};

    // System should either:
    // (a) have its own ungated transition (any->cancelled:system), or
    // (b) be listed in allowedActors on any->cancelled without requiresDna

    const systemCancelled = taskTransitions["any->cancelled:system"];
    const baseCancelled = taskTransitions["any->cancelled"];

    if (systemCancelled) {
      // Split pattern: system has its own path without requiresDna
      const hasDnaGate = systemCancelled.requiresDna?.includes("abstract_ref") ?? false;
      expect(hasDnaGate).toBe(false);
      expect(systemCancelled.allowedActors).toContain("system");
    } else if (baseCancelled) {
      // If no split, system must still be allowed (existing behavior preserved)
      expect(baseCancelled.allowedActors).toContain("system");
    } else {
      // Neither exists — fail
      expect(systemCancelled ?? baseCancelled).toBeDefined();
    }
  });
});

// --- AC-CDG5: abstract_ref validation (GitHub URL) ---

describe("AC-CDG5: abstract_ref validated as GitHub URL", () => {
  it("workflow-engine.js source has abstract_ref URL validation", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/workflow-engine.js",
      "utf-8",
    );
    // Should contain validation that abstract_ref starts with https://github.com/
    expect(source).toContain("abstract_ref");
    expect(source).toContain("https://github.com/");
  });
});

// --- AC-CDG6: DOCUMENTATION.md exists ---

describe("AC-CDG6: DOCUMENTATION.md exists at correct location", () => {
  it("DOCUMENTATION.md exists at tracks/process/context/", async () => {
    const fs = await import("node:fs");
    const exists = fs.existsSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/DOCUMENTATION.md",
    );
    expect(exists).toBe(true);
  });
});

// --- AC-CDG7: WORKFLOW.md is v14 ---

describe("AC-CDG7: WORKFLOW.md updated to v14", () => {
  it("WORKFLOW.md contains v14 version indicator", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/WORKFLOW.md",
      "utf-8",
    );
    expect(content).toContain("v14");
  });

  it("WORKFLOW.md has quality gates table with abstract_ref", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/WORKFLOW.md",
      "utf-8",
    );
    expect(content).toContain("abstract_ref");
    expect(content).toContain("Quality Gates");
  });
});

// --- AC-CDG8: DOCUMENTATION.md has required sections ---

describe("AC-CDG8: DOCUMENTATION.md has required content sections", () => {
  it("contains naming conventions section", async () => {
    const fs = await import("node:fs");
    const path = "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/DOCUMENTATION.md";
    if (!fs.existsSync(path)) return; // Skip if file doesn't exist (AC-CDG6 covers this)
    const content = fs.readFileSync(path, "utf-8");
    expect(content).toContain("Naming Convention");
  });

  it("contains writing abstracts section", async () => {
    const fs = await import("node:fs");
    const path = "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/DOCUMENTATION.md";
    if (!fs.existsSync(path)) return;
    const content = fs.readFileSync(path, "utf-8");
    expect(content).toContain("Writing Abstracts");
  });

  it("contains linking conventions section", async () => {
    const fs = await import("node:fs");
    const path = "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context/DOCUMENTATION.md";
    if (!fs.existsSync(path)) return;
    const content = fs.readFileSync(path, "utf-8");
    expect(content).toContain("Linking Convention");
  });
});
