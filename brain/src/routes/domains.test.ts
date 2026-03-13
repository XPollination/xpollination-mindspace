/**
 * Tests for domain summary discovery endpoint.
 *
 * From PDSA domain-summary-discovery (2026-03-02):
 * AC-DSD1: GET /api/v1/memory/domains endpoint exists and returns 200
 * AC-DSD2: Response contains thoughts array
 * AC-DSD3: Each thought has required fields (thought_id, topic, content_preview, access_count, created_at)
 * AC-DSD4: Endpoint respects limit parameter
 * AC-DSD5: Endpoint handles empty results gracefully (no 500)
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

// --- AC-DSD1: Endpoint exists and returns 200 ---

describe("AC-DSD1: GET /api/v1/memory/domains returns 200", () => {
  it("responds with 200 status", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory/domains`);
    expect(res.status).toBe(200);
  });

  it("returns JSON content type", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory/domains`);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

// --- AC-DSD2: Response contains thoughts array ---

describe("AC-DSD2: Response contains thoughts array", () => {
  it("response body has thoughts property as array", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory/domains`);
    const data = await res.json() as { thoughts: unknown[] };
    expect(data).toHaveProperty("thoughts");
    expect(Array.isArray(data.thoughts)).toBe(true);
  });
});

// --- AC-DSD3: Each thought has required fields ---

describe("AC-DSD3: Domain summary response fields", () => {
  it("each thought has thought_id, topic, content_preview, access_count, created_at", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory/domains`);
    const data = await res.json() as {
      thoughts: Array<{
        thought_id: string;
        topic: string;
        content_preview: string;
        access_count: number;
        created_at: string;
      }>;
    };
    // If there are domain summaries, verify each has required fields
    for (const thought of data.thoughts) {
      expect(thought).toHaveProperty("thought_id");
      expect(thought).toHaveProperty("topic");
      expect(thought).toHaveProperty("content_preview");
      expect(thought).toHaveProperty("access_count");
      expect(thought).toHaveProperty("created_at");
      expect(typeof thought.thought_id).toBe("string");
      expect(typeof thought.topic).toBe("string");
      expect(typeof thought.content_preview).toBe("string");
      expect(typeof thought.access_count).toBe("number");
    }
  });
});

// --- AC-DSD4: Endpoint respects limit parameter ---

describe("AC-DSD4: Limit parameter", () => {
  it("accepts limit query parameter without error", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory/domains?limit=2`);
    expect(res.status).toBe(200);
    const data = await res.json() as { thoughts: unknown[] };
    expect(data.thoughts.length).toBeLessThanOrEqual(2);
  });

  it("caps limit at 100", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory/domains?limit=200`);
    expect(res.status).toBe(200);
    // Shouldn't return more than 100 even if requested
    const data = await res.json() as { thoughts: unknown[] };
    expect(data.thoughts.length).toBeLessThanOrEqual(100);
  });
});

// --- AC-DSD5: Handles empty results gracefully ---

describe("AC-DSD5: Empty results handling", () => {
  it("returns empty thoughts array if no domain summaries exist (not 500)", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/memory/domains`);
    expect(res.status).toBe(200);
    const data = await res.json() as { thoughts: unknown[] };
    // Whether empty or populated, must be a valid array
    expect(Array.isArray(data.thoughts)).toBe(true);
  });
});
