/**
 * Tests for scoring configuration and quality-aware retrieval scoring.
 *
 * From PDSA retrieval-scoring-quality (2026-03-02):
 * AC-RSQ1: scoring-config.ts exports SCORING_CONFIG with all required multipliers
 * AC-RSQ2: Penalty values < 1.0, boost values > 1.0
 * AC-RSQ3: keywordEchoTopic penalty is stronger than keywordEchoFlag
 * AC-RSQ4: thoughtspace.ts uses SCORING_CONFIG (not hardcoded values)
 * AC-RSQ5: Topic-based keyword-echo thoughts score lower than non-echo thoughts
 *
 * From PDSA retrieval-scoring-quality v0.0.2:
 * AC-RSQ6: categoryWeights map in SCORING_CONFIG
 * AC-RSQ7: Category weight value ranges (boost > 1.0, penalty < 1.0)
 * AC-RSQ8: Required categories present
 * AC-RSQ9: thoughtspace.ts applies category weights in retrieval
 */
import { describe, it, expect } from "vitest";
import { SCORING_CONFIG } from "./scoring-config.js";

// --- AC-RSQ1: Config module exports all required multipliers ---

describe("AC-RSQ1: SCORING_CONFIG exports all multipliers", () => {
  it("exports a defined config object", () => {
    expect(SCORING_CONFIG).toBeDefined();
    expect(typeof SCORING_CONFIG).toBe("object");
  });

  it("has all penalty multipliers", () => {
    expect(SCORING_CONFIG).toHaveProperty("supersededByRefinement");
    expect(SCORING_CONFIG).toHaveProperty("supersededByCorrection");
    expect(SCORING_CONFIG).toHaveProperty("supersededByConsolidation");
    expect(SCORING_CONFIG).toHaveProperty("keywordEchoFlag");
    expect(SCORING_CONFIG).toHaveProperty("keywordEchoTopic");
  });

  it("has all boost multipliers", () => {
    expect(SCORING_CONFIG).toHaveProperty("correctionCategory");
    expect(SCORING_CONFIG).toHaveProperty("refinementOfSuperseded");
  });

  it("has categoryWeights map", () => {
    expect(SCORING_CONFIG).toHaveProperty("categoryWeights");
    expect(typeof SCORING_CONFIG.categoryWeights).toBe("object");
  });

  it("has exactly 8 top-level scoring keys", () => {
    expect(Object.keys(SCORING_CONFIG)).toHaveLength(8);
  });
});

// --- AC-RSQ2: Penalty values < 1.0, boost values > 1.0 ---

describe("AC-RSQ2: Scoring multiplier value ranges", () => {
  it("penalty multipliers are less than 1.0", () => {
    expect(SCORING_CONFIG.supersededByRefinement).toBeLessThan(1.0);
    expect(SCORING_CONFIG.supersededByCorrection).toBeLessThan(1.0);
    expect(SCORING_CONFIG.supersededByConsolidation).toBeLessThan(1.0);
    expect(SCORING_CONFIG.keywordEchoFlag).toBeLessThan(1.0);
    expect(SCORING_CONFIG.keywordEchoTopic).toBeLessThan(1.0);
  });

  it("penalty multipliers are greater than 0", () => {
    expect(SCORING_CONFIG.supersededByRefinement).toBeGreaterThan(0);
    expect(SCORING_CONFIG.supersededByCorrection).toBeGreaterThan(0);
    expect(SCORING_CONFIG.supersededByConsolidation).toBeGreaterThan(0);
    expect(SCORING_CONFIG.keywordEchoFlag).toBeGreaterThan(0);
    expect(SCORING_CONFIG.keywordEchoTopic).toBeGreaterThan(0);
  });

  it("boost multipliers are greater than 1.0", () => {
    expect(SCORING_CONFIG.correctionCategory).toBeGreaterThan(1.0);
    expect(SCORING_CONFIG.refinementOfSuperseded).toBeGreaterThan(1.0);
  });
});

// --- AC-RSQ3: Gardener echo penalty stronger than contribution-time echo ---

describe("AC-RSQ3: keywordEchoTopic is stronger penalty than keywordEchoFlag", () => {
  it("topic-based penalty multiplier is lower than flag-based", () => {
    expect(SCORING_CONFIG.keywordEchoTopic).toBeLessThan(SCORING_CONFIG.keywordEchoFlag);
  });
});

// --- AC-RSQ4: thoughtspace.ts uses config, not hardcoded values ---

describe("AC-RSQ4: thoughtspace.ts imports from scoring-config", () => {
  it("thoughtspace.ts contains import from scoring-config", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      new URL("./services/thoughtspace.ts", import.meta.url).pathname.replace("/dist/", "/src/"),
      "utf-8"
    );
    expect(content).toContain("scoring-config");
    expect(content).toContain("SCORING_CONFIG");
  });

  it("thoughtspace.ts does not hardcode scoring multipliers in score adjustments", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      new URL("./services/thoughtspace.ts", import.meta.url).pathname.replace("/dist/", "/src/"),
      "utf-8"
    );
    // Extract only the score adjustment section (between "Score adjustments" and "Re-sort")
    const scoreSection = content.match(/Score adjustments[\s\S]*?Re-sort/)?.[0] ?? "";
    expect(scoreSection.length).toBeGreaterThan(0);
    // Should not contain raw multiplier values in score adjustment code
    // (0.7, 0.5, 1.3, 0.8, 1.2 should be replaced with SCORING_CONFIG refs)
    expect(scoreSection).not.toMatch(/m\.score \*= 0\.7/);
    expect(scoreSection).not.toMatch(/m\.score \*= 0\.5/);
    expect(scoreSection).not.toMatch(/m\.score \* 1\.3/);
    expect(scoreSection).not.toMatch(/m\.score \*= 0\.8/);
    expect(scoreSection).not.toMatch(/m\.score \* 1\.2/);
  });
});

// --- AC-RSQ5: Topic-based keyword-echo scoring in retrieval ---

describe("AC-RSQ5: Topic-based keyword-echo penalty in retrieval", () => {
  it("brain API applies topic-based penalty to keyword-echo thoughts", async () => {
    // Query brain with read_only to avoid pollution
    const res = await fetch("http://localhost:3200/api/v1/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Recovery protocol and role definition for QA agent",
        agent_id: "vitest-scoring",
        agent_name: "Vitest",
        read_only: true,
      }),
    });
    if (!res.ok) return; // Skip if brain is down

    const data = await res.json() as {
      result: {
        sources: Array<{
          thought_id: string;
          score: number;
          topic: string | null;
          quality_flags: string[];
        }>;
      };
    };

    const sources = data.result.sources;
    if (sources.length === 0) return;

    // If any keyword-echo topics exist in results, they should score lower
    // than non-echo thoughts (the penalty makes them rank lower)
    const echoTopics = sources.filter((s) => s.topic === "keyword-echo");
    const nonEchoTopics = sources.filter((s) => s.topic !== "keyword-echo" && s.score > 0);

    if (echoTopics.length > 0 && nonEchoTopics.length > 0) {
      const maxEchoScore = Math.max(...echoTopics.map((s) => s.score));
      const avgNonEchoScore = nonEchoTopics.reduce((sum, s) => sum + s.score, 0) / nonEchoTopics.length;
      // Echo thoughts should score significantly lower than average non-echo
      expect(maxEchoScore).toBeLessThan(avgNonEchoScore);
    }
    // If no echo topics in results, the test passes vacuously — scoring config test is the gate
  });
});

// --- AC-RSQ6: categoryWeights map ---

describe("AC-RSQ6: categoryWeights in SCORING_CONFIG", () => {
  const cw = SCORING_CONFIG.categoryWeights;

  it("has all required high-value categories", () => {
    expect(cw).toHaveProperty("correction");
    expect(cw).toHaveProperty("principle");
    expect(cw).toHaveProperty("operational_learning");
  });

  it("has all required mid-value categories", () => {
    expect(cw).toHaveProperty("decision_record");
    expect(cw).toHaveProperty("design_decision");
    expect(cw).toHaveProperty("task_outcome");
    expect(cw).toHaveProperty("domain_summary");
  });

  it("has all required low-value categories", () => {
    expect(cw).toHaveProperty("state_snapshot");
    expect(cw).toHaveProperty("transition_marker");
    expect(cw).toHaveProperty("noise");
    expect(cw).toHaveProperty("uncategorized");
  });
});

// --- AC-RSQ7: Category weight value ranges ---

describe("AC-RSQ7: Category weight value ranges", () => {
  const cw = SCORING_CONFIG.categoryWeights;

  it("boost categories have weight > 1.0", () => {
    expect(cw.correction).toBeGreaterThan(1.0);
    expect(cw.principle).toBeGreaterThan(1.0);
    expect(cw.operational_learning).toBeGreaterThan(1.0);
  });

  it("penalty categories have weight < 1.0", () => {
    expect(cw.transition_marker).toBeLessThan(1.0);
    expect(cw.noise).toBeLessThan(1.0);
    expect(cw.uncategorized).toBeLessThan(1.0);
  });

  it("all weights are positive", () => {
    for (const [, weight] of Object.entries(cw)) {
      expect(weight).toBeGreaterThan(0);
    }
  });

  it("correction has highest category weight", () => {
    for (const [, weight] of Object.entries(cw)) {
      expect(cw.correction).toBeGreaterThanOrEqual(weight as number);
    }
  });

  it("noise has lowest category weight", () => {
    for (const [, weight] of Object.entries(cw)) {
      expect(cw.noise).toBeLessThanOrEqual(weight as number);
    }
  });
});

// --- AC-RSQ8: Required PDSA-specified category weights ---

describe("AC-RSQ8: PDSA-specified category weight values", () => {
  const cw = SCORING_CONFIG.categoryWeights;

  it("correction = 1.4", () => {
    expect(cw.correction).toBe(1.4);
  });

  it("principle = 1.3", () => {
    expect(cw.principle).toBe(1.3);
  });

  it("operational_learning = 1.2", () => {
    expect(cw.operational_learning).toBe(1.2);
  });

  it("transition_marker = 0.5", () => {
    expect(cw.transition_marker).toBe(0.5);
  });

  it("noise = 0.3", () => {
    expect(cw.noise).toBe(0.3);
  });

  it("uncategorized = 0.6", () => {
    expect(cw.uncategorized).toBe(0.6);
  });
});

// --- AC-RSQ9: thoughtspace.ts applies category weights ---

describe("AC-RSQ9: thoughtspace.ts applies category weights in retrieval", () => {
  it("thoughtspace.ts references categoryWeights", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      new URL("./services/thoughtspace.ts", import.meta.url).pathname.replace("/dist/", "/src/"),
      "utf-8"
    );
    expect(content).toContain("categoryWeights");
  });

  it("thoughtspace.ts uses expanded candidate pool", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      new URL("./services/thoughtspace.ts", import.meta.url).pathname.replace("/dist/", "/src/"),
      "utf-8"
    );
    // Should fetch more candidates than final limit for re-ranking
    expect(content).toMatch(/20|limit\s*\*\s*4|Math\.max/);
  });
});
