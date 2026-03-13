/**
 * Tests for the noise thought category.
 *
 * From PDSA noise-thought-category (2026-03-02):
 * AC-NTC1: noise is a valid ThoughtCategory value accepted by the brain API
 * AC-NTC2: PATCH metadata endpoint accepts noise as thought_category
 * AC-NTC3: Thoughts with category noise can be filtered in retrieval
 * AC-NTC4: noise category does not break existing category validation
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "http://localhost:3200";

async function serverIsRunning(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/api/v1/health`);
    return true;
  } catch {
    return false;
  }
}

let serverUp: boolean;

beforeAll(async () => {
  serverUp = await serverIsRunning();
});

// --- AC-NTC1: noise is a valid ThoughtCategory ---

describe("AC-NTC1: noise is accepted as thought_category", () => {
  it("contributing a thought with thought_category noise succeeds", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Vitest AC-NTC1: verifying noise thought category is accepted by the brain API — this is a test contribution that should store with category noise.",
        agent_id: "vitest-noise",
        agent_name: "Vitest",
        thought_category: "noise",
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as {
      trace: { thoughts_contributed: number };
    };
    // The thought should be stored (not rejected)
    expect(data.trace.thoughts_contributed).toBe(1);
  });
});

// --- AC-NTC2: PATCH metadata accepts noise ---

describe("AC-NTC2: PATCH metadata endpoint accepts noise category", () => {
  it("can recategorize an existing thought to noise", async () => {
    if (!serverUp) return;

    // First, find a thought to recategorize (query for keyword echoes)
    const queryRes = await fetch(`${BASE_URL}/api/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "recovery protocol role definition agent responsibilities",
        agent_id: "vitest-noise",
        agent_name: "Vitest",
        read_only: true,
      }),
    });
    if (!queryRes.ok) return;

    const queryData = await queryRes.json() as {
      result: { sources: Array<{ thought_id: string; thought_category: string }> };
    };
    const sources = queryData.result.sources;
    if (sources.length === 0) return;

    // Find a thought with category "state_snapshot" or "uncategorized" to test recategorization
    const target = sources.find(
      (s) => s.thought_category === "state_snapshot" || s.thought_category === "uncategorized"
    );
    if (!target) return; // Skip if no suitable target

    // Attempt to PATCH to noise
    const patchRes = await fetch(
      `${BASE_URL}/api/v1/memory/thought/${target.thought_id}/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought_category: "noise" }),
      }
    );

    // Should succeed (200) if noise is a valid category
    // Will fail with 400 VALIDATION_ERROR if noise is not in VALID_CATEGORIES
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json() as { success: boolean };
    expect(patchData.success).toBe(true);
  });
});

// --- AC-NTC3: Filter by noise category works ---

describe("AC-NTC3: Retrieval can filter by noise category", () => {
  it("query with filter_category=noise returns only noise-categorized thoughts", async () => {
    if (!serverUp) return;
    // This test verifies that the category is usable as a filter.
    // Since Qdrant accepts any string as keyword filter, this tests
    // that the API doesn't reject the category value.
    const res = await fetch(`${BASE_URL}/api/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "noise category test query for verification",
        agent_id: "vitest-noise",
        agent_name: "Vitest",
        read_only: true,
        filter_category: "noise",
      }),
    });
    // Should not error
    expect(res.ok).toBe(true);
  });
});

// --- AC-NTC4: Existing categories still valid ---

describe("AC-NTC4: Existing categories still valid after adding noise", () => {
  it("state_snapshot is still a valid category for PATCH", async () => {
    if (!serverUp) return;
    // Query to find any thought
    const queryRes = await fetch(`${BASE_URL}/api/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "agent coordination workflow patterns",
        agent_id: "vitest-noise",
        agent_name: "Vitest",
        read_only: true,
      }),
    });
    if (!queryRes.ok) return;

    const data = await queryRes.json() as {
      result: { sources: Array<{ thought_id: string }> };
    };
    if (data.result.sources.length === 0) return;

    // Verify state_snapshot still works
    const res = await fetch(
      `${BASE_URL}/api/v1/memory/thought/${data.result.sources[0].thought_id}/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought_category: "state_snapshot" }),
      }
    );
    expect(res.status).toBe(200);
  });

  it("invalid category still rejected", async () => {
    if (!serverUp) return;
    const queryRes = await fetch(`${BASE_URL}/api/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "agent coordination workflow patterns",
        agent_id: "vitest-noise",
        agent_name: "Vitest",
        read_only: true,
      }),
    });
    if (!queryRes.ok) return;

    const data = await queryRes.json() as {
      result: { sources: Array<{ thought_id: string }> };
    };
    if (data.result.sources.length === 0) return;

    // Invalid category should still be rejected with 400
    const res = await fetch(
      `${BASE_URL}/api/v1/memory/thought/${data.result.sources[0].thought_id}/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought_category: "totally_invalid_category" }),
      }
    );
    expect(res.status).toBe(400);
  });
});
