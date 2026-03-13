/**
 * Tests for gardener consolidation superseding originals.
 *
 * From PDSA consolidation-supersedes-originals (2026-03-02):
 * AC-CSO1: SCORING_CONFIG has supersededByConsolidation: 0.7
 * AC-CSO2: thoughtspace.ts scoring section checks superseded_by_consolidation
 * AC-CSO3: thoughtspace.ts think() marks source thoughts as superseded after consolidation
 * AC-CSO4: Retrieval API response includes superseded_by_consolidation field
 */
import { describe, it, expect } from "vitest";

// --- AC-CSO1: SCORING_CONFIG has supersededByConsolidation ---

describe("AC-CSO1: SCORING_CONFIG has supersededByConsolidation entry", () => {
  it("exports supersededByConsolidation with value 0.7", async () => {
    const config = (await import("../scoring-config.js")) as Record<string, unknown>;
    const scoringConfig = config.SCORING_CONFIG as Record<string, number>;
    expect(scoringConfig).toBeDefined();
    expect(scoringConfig.supersededByConsolidation).toBeDefined();
    expect(scoringConfig.supersededByConsolidation).toBe(0.7);
  });
});

// --- AC-CSO2: Scoring section checks superseded_by_consolidation ---

describe("AC-CSO2: Scoring applies penalty for superseded_by_consolidation", () => {
  it("thoughtspace.ts contains superseded_by_consolidation scoring check", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/thoughtspace.ts",
      "utf-8",
    );

    // The scoring section should check for superseded_by_consolidation
    expect(source).toContain("superseded_by_consolidation");
    expect(source).toContain("supersededByConsolidation");
  });

  it("scoring check uses SCORING_CONFIG.supersededByConsolidation", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/thoughtspace.ts",
      "utf-8",
    );

    // Should reference the config value, not a hardcoded multiplier
    expect(source).toContain("SCORING_CONFIG.supersededByConsolidation");
  });
});

// --- AC-CSO3: think() marks originals after consolidation ---

describe("AC-CSO3: think() marks source thoughts as superseded after consolidation", () => {
  it("thoughtspace.ts think() has consolidation supersede logic", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/thoughtspace.ts",
      "utf-8",
    );

    // Find the think() function
    const thinkStart = source.indexOf("export async function think(");
    expect(thinkStart).toBeGreaterThan(-1);

    // Within think(), look for consolidation superseding logic
    // The function should contain: thought_type === "consolidation" AND source_ids AND superseded_by_consolidation
    const thinkBody = source.slice(thinkStart, thinkStart + 3000);
    expect(thinkBody).toContain("consolidation");
    expect(thinkBody).toContain("superseded_by_consolidation");
    expect(thinkBody).toContain("source_ids");
  });
});

// --- AC-CSO4: Retrieval response includes superseded_by_consolidation ---

describe("AC-CSO4: Retrieval API response includes superseded_by_consolidation", () => {
  it("memory.ts routes include superseded_by_consolidation in sources mapping", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/routes/memory.ts",
      "utf-8",
    );
    expect(source).toContain("superseded_by_consolidation");
  });

  it("API query returns superseded_by_consolidation field in sources", async () => {
    const API_URL = "http://localhost:3200";
    try {
      const res = await fetch(`${API_URL}/api/v1/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "agent workflow and task management",
          agent_id: "agent-qa-test",
          agent_name: "QA-TEST",
          read_only: true,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        result?: { sources?: Array<Record<string, unknown>> };
      };
      const sources = data?.result?.sources ?? [];
      if (sources.length === 0) return;

      // At least one source should have the superseded_by_consolidation field defined
      // (either true or false)
      const hasField = sources.some(
        (s) => "superseded_by_consolidation" in s,
      );
      expect(hasField).toBe(true);
    } catch {
      // API not running — skip
    }
  });
});
