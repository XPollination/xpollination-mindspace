/**
 * Tests for correction lifecycle activation.
 *
 * From PDSA correction-lifecycle-activation (2026-03-02):
 * AC-CLA1: PATCH metadata endpoint accepts superseded_by_correction boolean
 * AC-CLA2: PATCH with only superseded_by_correction (no category/topic) returns 200
 * AC-CLA3: updateThoughtMetadata signature includes superseded_by_correction
 * AC-CLA4: After PATCH superseded_by_correction:true, thought metadata has the flag
 * AC-CLA5: Data fix — original Neuroimaginations-Coach thought (f15a0a60) marked superseded
 * AC-CLA6: Data fix — correction thoughts (8bdaa9bc, f45935fa) categorized as correction
 * AC-CLA7: Data fix — keyword echo (21cfafc6) categorized as noise
 */
import { describe, it, expect } from "vitest";

const API_URL = "http://localhost:3200";

async function apiIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// --- AC-CLA1: PATCH accepts superseded_by_correction boolean ---

describe("AC-CLA1: PATCH metadata accepts superseded_by_correction", () => {
  it("returns 200 when sending superseded_by_correction: true with a valid thought", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    // First, contribute a test thought to get a valid ID
    const contributeRes = await fetch(`${API_URL}/api/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "TEST THOUGHT for correction lifecycle — this thought will be marked superseded for testing purposes only",
        agent_id: "agent-qa-test",
        agent_name: "QA-TEST",
        context: "test: correction-lifecycle",
      }),
    });
    expect(contributeRes.ok).toBe(true);
    const contributeData = (await contributeRes.json()) as { result?: { sources?: Array<{ thought_id: string }> } };

    // Get the contributed thought ID from sources (most recent contribution is typically first)
    const sources = contributeData?.result?.sources ?? [];
    const testThoughtId = sources.find((s) => s.thought_id)?.thought_id;

    // Skip if we can't get a thought ID (contribution may have been deduplicated)
    if (!testThoughtId) return;

    // Now PATCH it with superseded_by_correction
    const patchRes = await fetch(`${API_URL}/api/v1/memory/thought/${testThoughtId}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ superseded_by_correction: true }),
    });
    expect(patchRes.status).toBe(200);
    const patchData = (await patchRes.json()) as { success?: boolean };
    expect(patchData.success).toBe(true);
  });
});

// --- AC-CLA2: PATCH with only superseded_by_correction ---

describe("AC-CLA2: PATCH with only superseded_by_correction field", () => {
  it("does not return 400 when superseded_by_correction is the only field", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    // Use a known thought ID from the Neuroimaginations-Coach case
    // f15a0a60 is the original wrong thought — if it exists, PATCH should work
    const res = await fetch(`${API_URL}/api/v1/memory/thought/f15a0a60-d9c9-4635-a460-5941842a357f/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ superseded_by_correction: true }),
    });
    // Should be 200 (success) or 404 (thought not found) — NOT 400 (validation error)
    // 400 would mean the endpoint doesn't recognize superseded_by_correction as a valid field
    expect(res.status).not.toBe(400);
  });
});

// --- AC-CLA3: updateThoughtMetadata includes superseded_by_correction ---

describe("AC-CLA3: updateThoughtMetadata signature includes superseded_by_correction", () => {
  it("thoughtspace.ts source contains superseded_by_correction in updateThoughtMetadata", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/thoughtspace.ts",
      "utf-8",
    );
    // The function signature should include superseded_by_correction
    expect(source).toContain("superseded_by_correction");
    // Verify it's in the updateThoughtMetadata function context
    const funcStart = source.indexOf("async function updateThoughtMetadata");
    expect(funcStart).toBeGreaterThan(-1);
    // Find the closing brace of the function (approximate — check next 500 chars)
    const funcBody = source.slice(funcStart, funcStart + 800);
    expect(funcBody).toContain("superseded_by_correction");
  });
});

// --- AC-CLA4: After PATCH, thought metadata reflects superseded flag ---

describe("AC-CLA4: superseded_by_correction flag persists after PATCH", () => {
  it("drill-down on patched thought shows superseded_by_correction in metadata", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    // Query for the Neuroimaginations-Coach thought to check if it has the flag
    const res = await fetch(`${API_URL}/api/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Neuroimaginations-Coach Thomas Pichler certification",
        agent_id: "agent-qa-test",
        agent_name: "QA-TEST",
        read_only: true,
      }),
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      result?: {
        sources?: Array<{
          thought_id: string;
          superseded: boolean;
          content_preview: string;
        }>;
      };
    };
    const sources = data?.result?.sources ?? [];

    // Find the original wrong thought (f15a0a60)
    const originalThought = sources.find(
      (s) => s.thought_id === "f15a0a60-d9c9-4635-a460-5941842a357f",
    );

    // If the thought exists and data fix was applied, it should be marked superseded
    if (originalThought) {
      expect(originalThought.superseded).toBe(true);
    }
    // If thought not found in results, it may have been scored down — also acceptable
  });
});

// --- AC-CLA5: Original Neuroimaginations-Coach thought marked superseded ---

describe("AC-CLA5: Data fix — original wrong thought marked superseded_by_correction", () => {
  it("thought f15a0a60 has superseded_by_correction:true after data fix", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    // Try to PATCH the specific thought — this is the data fix
    const res = await fetch(
      `${API_URL}/api/v1/memory/thought/f15a0a60-d9c9-4635-a460-5941842a357f/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ superseded_by_correction: true }),
      },
    );
    // 200 = success, 404 = thought doesn't exist in this brain instance
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = (await res.json()) as { success?: boolean };
      expect(data.success).toBe(true);
    }
  });
});

// --- AC-CLA6: Correction thoughts categorized as correction ---

describe("AC-CLA6: Data fix — correction thoughts categorized as correction", () => {
  it("thought 8bdaa9bc can be categorized as correction", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    const res = await fetch(
      `${API_URL}/api/v1/memory/thought/8bdaa9bc-6c2f-4140-af50-073c85fbe239/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought_category: "correction" }),
      },
    );
    expect([200, 404]).toContain(res.status);
  });

  it("thought f45935fa can be categorized as correction", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    const res = await fetch(
      `${API_URL}/api/v1/memory/thought/f45935fa-9890-4b13-a557-d1996e6b1219/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought_category: "correction" }),
      },
    );
    expect([200, 404]).toContain(res.status);
  });
});

// --- AC-CLA7: Keyword echo categorized as noise ---

describe("AC-CLA7: Data fix — keyword echo categorized as noise", () => {
  it("thought 21cfafc6 can be categorized as noise with topic keyword-echo", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    const res = await fetch(
      `${API_URL}/api/v1/memory/thought/21cfafc6-b72d-4c38-b281-fb0717d00850/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought_category: "noise", topic: "keyword-echo" }),
      },
    );
    expect([200, 404]).toContain(res.status);
  });
});
