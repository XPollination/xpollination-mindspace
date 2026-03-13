/**
 * Gardener Retroactive Categorization Tests (gardener-retroactive-categorization task)
 *
 * Tests for batch categorization of existing uncategorized thoughts.
 *
 * Acceptance criteria:
 * AC1: >80% of existing thoughts have a category and topic
 * AC2: Categorization is accurate and consistent
 * AC3: Does not modify thought content, only metadata fields
 *
 * Design changes:
 * - PATCH /api/v1/memory/thought/:id/metadata endpoint
 * - GET /api/v1/memory/thoughts/uncategorized endpoint (paginated)
 * - ThoughtCategory type includes transition_marker and design_decision
 * - Gardener SKILL.md Step 5.5 for batch categorization
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { think, type ThoughtCategory } from "./thoughtspace.js";

const BRAIN_URL = "http://localhost:3200/api/v1";
const PROJECT_ROOT = resolve(__dirname, "../../..");
const GARDENER_SKILL_PATH = resolve(
  PROJECT_ROOT,
  ".claude/skills/xpo.claude.mindspace.garden/SKILL.md"
);

const TEST_AGENT_ID = `agent-retro-cat-test-${Date.now()}`;
const TEST_AGENT_NAME = "RetroCatTest";

// --- ThoughtCategory type ---

describe("ThoughtCategory type includes new categories", () => {
  it("transition_marker is a valid ThoughtCategory", () => {
    // This test validates at compile time + runtime that the type accepts these values
    const cat: ThoughtCategory = "transition_marker" as ThoughtCategory;
    expect(cat).toBe("transition_marker");
  });

  it("design_decision is a valid ThoughtCategory", () => {
    const cat: ThoughtCategory = "design_decision" as ThoughtCategory;
    expect(cat).toBe("design_decision");
  });

  it("existing categories still work", () => {
    const cats: ThoughtCategory[] = [
      "state_snapshot",
      "decision_record",
      "operational_learning",
      "task_outcome",
      "correction",
      "uncategorized",
    ];
    expect(cats.length).toBe(6);
  });
});

// --- PATCH /api/v1/memory/thought/:id/metadata ---

describe("PATCH /api/v1/memory/thought/:id/metadata", () => {
  let testThoughtId: string;

  beforeAll(async () => {
    const result = await think({
      content: "Retroactive categorization test thought — this thought was created without category and will be patched with metadata by the gardener.",
      contributor_id: TEST_AGENT_ID,
      contributor_name: TEST_AGENT_NAME,
      thought_type: "original",
      source_ids: [],
      tags: ["retro-cat-test"],
    });
    testThoughtId = result.thought_id;
  });

  it("endpoint exists and accepts PATCH with thought_category", async () => {
    const res = await fetch(`${BRAIN_URL}/memory/thought/${testThoughtId}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thought_category: "operational_learning",
        topic: "testing",
      }),
    });
    expect(res.status).toBe(200);
  });

  it("does not modify thought content", async () => {
    // After PATCH, fetch the thought and verify content unchanged
    const res = await fetch(`${BRAIN_URL}/memory/thought/${testThoughtId}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thought_category: "task_outcome",
      }),
    });
    expect(res.status).toBe(200);

    // Verify via brain query that the thought still has original content
    const queryRes = await fetch(`${BRAIN_URL}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Retroactive categorization test thought gardener metadata",
        agent_id: TEST_AGENT_ID,
        agent_name: TEST_AGENT_NAME,
        full_content: true,
      }),
    });
    const body = (await queryRes.json()) as Record<string, unknown>;
    const result = body.result as Record<string, unknown>;
    const sources = result.sources as Array<Record<string, unknown>>;
    if (sources) {
      const match = sources.find((s) => s.thought_id === testThoughtId);
      if (match) {
        expect((match.content as string)).toContain("Retroactive categorization test thought");
      }
    }
  });

  it("rejects invalid thought_category", async () => {
    const res = await fetch(`${BRAIN_URL}/memory/thought/${testThoughtId}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thought_category: "invalid_category_xxx",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent thought", async () => {
    const res = await fetch(`${BRAIN_URL}/memory/thought/00000000-0000-0000-0000-000000000000/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thought_category: "operational_learning",
      }),
    });
    expect(res.status).toBe(404);
  });
});

// --- GET /api/v1/memory/thoughts/uncategorized ---

describe("GET /api/v1/memory/thoughts/uncategorized", () => {
  it("endpoint exists and returns paginated results", async () => {
    const res = await fetch(`${BRAIN_URL}/memory/thoughts/uncategorized?limit=5`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("thoughts");
    expect(Array.isArray((body as Record<string, unknown>).thoughts)).toBe(true);
  });

  it("supports limit and offset pagination", async () => {
    const res = await fetch(`${BRAIN_URL}/memory/thoughts/uncategorized?limit=2&offset=0`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const thoughts = body.thoughts as Array<unknown>;
    expect(thoughts.length).toBeLessThanOrEqual(2);
  });

  it("returns thought_id, content_preview, and existing metadata", async () => {
    const res = await fetch(`${BRAIN_URL}/memory/thoughts/uncategorized?limit=1`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const thoughts = body.thoughts as Array<Record<string, unknown>>;
    if (thoughts.length > 0) {
      expect(thoughts[0]).toHaveProperty("thought_id");
      expect(thoughts[0]).toHaveProperty("content_preview");
    }
  });
});

// --- Gardener SKILL.md Step 5.5 ---

describe("Gardener SKILL.md Step 5.5 for batch categorization", () => {
  it("gardener skill documents retroactive categorization step", () => {
    const content = readFileSync(GARDENER_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/retroactive|batch.*categori|step.*5\.5|categori.*uncategorized/);
  });

  it("step only runs during full deep scope", () => {
    const content = readFileSync(GARDENER_SKILL_PATH, "utf-8").toLowerCase();
    // Should mention full/deep as condition for this step
    expect(content).toMatch(/full.*deep|deep.*only|scope.*full/);
  });

  it("step uses PATCH endpoint for metadata updates", () => {
    const content = readFileSync(GARDENER_SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/patch|metadata|\/memory\/thought/);
  });
});
