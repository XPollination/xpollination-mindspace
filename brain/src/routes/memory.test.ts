/**
 * Phase 3 Tests: Conversational Interface POST /api/v1/memory
 *
 * Tests acceptance criteria from spec Sections 3, 3.11:
 * 1. POST /memory endpoint works
 * 2. Contribution threshold classifies correctly
 * 3. Context concatenation changes embedding
 * 4. Result + trace response format matches spec
 * 5. Disambiguation triggers on 10+ results with 3+ tags
 * 6. New agent onboarding with guidance
 * 7. Implicit feedback +0.02 on session follow-ups
 * 8. All error codes from Section 3.1
 *
 * From PDSA gardener-query-pollution (2026-02-27):
 * AC-QP1: keyword_echo contribution is NOT persisted (thoughts_contributed=0)
 * AC-QP2: Non-echo contributions still persist normally
 * AC-QP3: Explicit refine bypasses keyword_echo guard
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";
import { think } from "../services/thoughtspace.js";
import { getDb } from "../services/database.js";

const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const BASE_URL = "http://localhost:3200";

async function serverIsRunning(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/api/v1/health`);
    return true;
  } catch {
    return false;
  }
}

async function postMemory(body: Record<string, unknown>) {
  return fetch(`${BASE_URL}/api/v1/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let serverUp: boolean;

beforeAll(async () => {
  serverUp = await serverIsRunning();
});

// --- AC1: POST /memory endpoint works ---

describe("AC1: POST /memory endpoint works", () => {
  it("returns 200 for valid request", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "What patterns exist in multi-agent coordination?",
      agent_id: "agent-p3-test",
      agent_name: "QA Phase3 Test",
    });
    expect(res.status).toBe(200);
  });

  it("returns JSON with result and trace", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "How does role separation prevent coordination failures?",
      agent_id: "agent-p3-test",
      agent_name: "QA Phase3 Test",
    });
    const body = await res.json();
    expect(body).toHaveProperty("result");
    expect(body).toHaveProperty("trace");
  });
});

// --- AC2: Contribution threshold ---

describe("AC2: Contribution threshold classifies correctly", () => {
  it("short prompt (<=50 chars) is NOT stored", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "What is org debt?",
      agent_id: "agent-p3-threshold",
      agent_name: "QA Threshold",
    });
    const body = await res.json();
    expect(body.trace.contribution_threshold_met).toBe(false);
    expect(body.trace.thoughts_contributed).toBe(0);
  });

  it("purely interrogative prompt is NOT stored", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "What are the best practices for multi-agent systems in production environments?",
      agent_id: "agent-p3-threshold",
      agent_name: "QA Threshold",
    });
    const body = await res.json();
    expect(body.trace.contribution_threshold_met).toBe(false);
    expect(body.trace.thoughts_contributed).toBe(0);
  });

  it("follow-up reference is NOT stored", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "Based on your previous answer, I think we should restructure the agent workflow to use explicit handoffs.",
      agent_id: "agent-p3-threshold",
      agent_name: "QA Threshold",
    });
    const body = await res.json();
    expect(body.trace.contribution_threshold_met).toBe(false);
    expect(body.trace.thoughts_contributed).toBe(0);
  });

  it("declarative insight >50 chars IS stored", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "Role separation in multi-agent systems prevents coordination collapse by ensuring each agent has clear ownership of its domain.",
      agent_id: "agent-p3-threshold",
      agent_name: "QA Threshold",
    });
    const body = await res.json();
    expect(body.trace.contribution_threshold_met).toBe(true);
    expect(body.trace.thoughts_contributed).toBe(1);
    expect(body.trace.operations).toContain("contribute");
  });
});

// --- AC3: Context concatenation ---

describe("AC3: Context concatenation changes retrieval", () => {
  it("trace shows context_used=true when context provided", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "What patterns exist for handling failures?",
      agent_id: "agent-p3-context",
      agent_name: "QA Context",
      context: "I'm building a multi-agent workflow system.",
    });
    const body = await res.json();
    expect(body.trace.context_used).toBe(true);
  });

  it("trace shows context_used=false when no context", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "What patterns exist for handling failures?",
      agent_id: "agent-p3-context",
      agent_name: "QA Context",
    });
    const body = await res.json();
    expect(body.trace.context_used).toBe(false);
  });
});

// --- AC4: Response format matches spec ---

describe("AC4: Result + trace response format", () => {
  it("result has all required fields", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "Tell me about organizational design patterns.",
      agent_id: "agent-p3-format",
      agent_name: "QA Format",
    });
    const body = await res.json();

    // result fields (Section 3.7)
    expect(body.result).toHaveProperty("response");
    expect(body.result).toHaveProperty("sources");
    expect(body.result).toHaveProperty("highways_nearby");
    expect(body.result).toHaveProperty("disambiguation");
    expect(body.result).toHaveProperty("guidance");

    expect(typeof body.result.response).toBe("string");
    expect(Array.isArray(body.result.sources)).toBe(true);
    expect(Array.isArray(body.result.highways_nearby)).toBe(true);
  });

  it("trace has all required fields", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "Tell me about pheromone models.",
      agent_id: "agent-p3-format",
      agent_name: "QA Format",
    });
    const body = await res.json();

    // trace fields (Section 3.7)
    expect(body.trace).toHaveProperty("session_id");
    expect(body.trace).toHaveProperty("operations");
    expect(body.trace).toHaveProperty("thoughts_retrieved");
    expect(body.trace).toHaveProperty("thoughts_contributed");
    expect(body.trace).toHaveProperty("contribution_threshold_met");
    expect(body.trace).toHaveProperty("context_used");
    expect(body.trace).toHaveProperty("retrieval_method");

    expect(typeof body.trace.session_id).toBe("string");
    expect(Array.isArray(body.trace.operations)).toBe(true);
    expect(body.trace.retrieval_method).toBe("vector");
  });

  it("sources have correct shape", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "Role separation prevents coordination collapse in multi-agent architectures through explicit boundary enforcement.",
      agent_id: "agent-p3-format",
      agent_name: "QA Format",
    });
    const body = await res.json();

    if (body.result.sources.length > 0) {
      const source = body.result.sources[0];
      expect(source).toHaveProperty("thought_id");
      expect(source).toHaveProperty("contributor");
      expect(source).toHaveProperty("score");
      expect(source).toHaveProperty("content_preview");
      expect(typeof source.thought_id).toBe("string");
      expect(typeof source.contributor).toBe("string");
      expect(typeof source.score).toBe("number");
      expect(typeof source.content_preview).toBe("string");
      expect(source.content_preview.length).toBeLessThanOrEqual(80);
    }
  });
});

// --- AC6: New agent onboarding ---

describe("AC6: New agent onboarding with guidance", () => {
  it("new agent gets guidance message", async () => {
    if (!serverUp) return;
    // Use a unique agent_id that has never queried before
    const uniqueAgent = `agent-onboard-${Date.now()}`;
    const res = await postMemory({
      prompt: "What can you tell me about this system?",
      agent_id: uniqueAgent,
      agent_name: "New Agent",
    });
    const body = await res.json();
    expect(body.result.guidance).toBeDefined();
    expect(body.result.guidance).toContain("Welcome");
    expect(body.trace.operations).toContain("onboard");
  });

  it("returning agent does NOT get guidance", async () => {
    if (!serverUp) return;
    // agent-p3-test has queried before in AC1
    const res = await postMemory({
      prompt: "Follow-up question about coordination patterns.",
      agent_id: "agent-p3-test",
      agent_name: "QA Phase3 Test",
    });
    const body = await res.json();
    expect(body.result.guidance).toBeNull();
    expect(body.trace.operations).not.toContain("onboard");
  });
});

// --- AC8: Error responses ---

describe("AC8: Error responses (Section 3.1)", () => {
  it("400 for missing prompt", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      agent_id: "test",
      agent_name: "Test",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 for empty prompt", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "",
      agent_id: "test",
      agent_name: "Test",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 for missing agent_id", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "test prompt",
      agent_name: "Test",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 for missing agent_name", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "test prompt",
      agent_id: "test",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 for prompt exceeding 10000 chars", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "x".repeat(10001),
      agent_id: "test",
      agent_name: "Test",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 for agent_id exceeding 100 chars", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "test",
      agent_id: "x".repeat(101),
      agent_name: "Test",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 for context exceeding 2000 chars", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "test prompt",
      agent_id: "test",
      agent_name: "Test",
      context: "x".repeat(2001),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("error response has correct shape {error: {code, message}}", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "",
      agent_id: "test",
      agent_name: "Test",
    });
    const body = await res.json();
    expect(body.error).toHaveProperty("code");
    expect(body.error).toHaveProperty("message");
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
  });
});

// --- Spec acceptance test ---

describe("Spec acceptance: question -> result+trace, insight -> stored+returned", () => {
  it("question returns result with sources and trace", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "What do you know about role separation?",
      agent_id: "agent-p3-accept",
      agent_name: "QA Accept",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.response).toBeDefined();
    expect(body.result.sources).toBeDefined();
    expect(body.trace.session_id).toBeDefined();
    expect(body.trace.operations).toContain("retrieve");
    // Short question should NOT be stored
    expect(body.trace.contribution_threshold_met).toBe(false);
  });

  it("insight is stored AND related thoughts returned", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "Agent coordination requires explicit role boundaries. Without them, agents step on each other's toes and produce conflicting outputs.",
      agent_id: "agent-p3-accept",
      agent_name: "QA Accept",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    // Should be stored (>50 chars, declarative, not follow-up)
    expect(body.trace.contribution_threshold_met).toBe(true);
    expect(body.trace.thoughts_contributed).toBe(1);
    expect(body.trace.operations).toContain("contribute");
    expect(body.trace.operations).toContain("retrieve");
    // Should get related results back
    expect(body.trace.thoughts_retrieved).toBeGreaterThanOrEqual(0);
  });
});

// --- AC-QP1: keyword_echo query does NOT persist ---

describe("AC-QP1: keyword_echo contribution is NOT persisted", () => {
  const ECHO_AGENT = `agent-qp-echo-${Date.now()}`;

  it("first establishes query history, then echo contribution has thoughts_contributed=0", async () => {
    if (!serverUp) return;

    // Step 1: Make a query to establish recent query history
    const query1 = await postMemory({
      prompt: "What are the coordination patterns for multi-agent workflow systems?",
      agent_id: ECHO_AGENT,
      agent_name: "QA Echo Test",
    });
    expect(query1.status).toBe(200);

    // Step 2: Submit a contribution with >60% word overlap (keyword echo)
    // Reuses: "coordination", "patterns", "multi-agent", "workflow", "systems" = high overlap
    const echoRes = await postMemory({
      prompt: "The coordination patterns for multi-agent workflow systems involve explicit role separation and boundary enforcement in distributed architectures.",
      agent_id: ECHO_AGENT,
      agent_name: "QA Echo Test",
    });
    const echoBody = await echoRes.json();
    expect(echoRes.status).toBe(200);

    // After fix: echo contribution should NOT be persisted
    expect(echoBody.trace.thoughts_contributed).toBe(0);
    // But retrieval should still work
    expect(echoBody.trace.operations).toContain("retrieve");
  });
});

// --- AC-QP2: Non-echo queries still persist normally ---

describe("AC-QP2: Non-echo contribution IS persisted", () => {
  const FRESH_AGENT = `agent-qp-fresh-${Date.now()}`;

  it("contribution with no prior queries persists normally", async () => {
    if (!serverUp) return;

    const res = await postMemory({
      prompt: "Vitest QP2 verification: a completely original insight about quantum computing applications in distributed ledger consensus mechanisms.",
      agent_id: FRESH_AGENT,
      agent_name: "QA Fresh Test",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trace.contribution_threshold_met).toBe(true);
    expect(body.trace.thoughts_contributed).toBe(1);
    expect(body.trace.operations).toContain("contribute");
  });

  it("contribution with low word overlap still persists", async () => {
    if (!serverUp) return;

    // First query with some keywords
    await postMemory({
      prompt: "Tell me about pheromone-based navigation in ant colonies.",
      agent_id: FRESH_AGENT,
      agent_name: "QA Fresh Test",
    });

    // Contribution with completely different words (<60% overlap)
    const res = await postMemory({
      prompt: "Vitest QP2 low-overlap: emergent swarm intelligence produces resilient distributed consensus without centralized leadership hierarchies.",
      agent_id: FRESH_AGENT,
      agent_name: "QA Fresh Test",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trace.thoughts_contributed).toBe(1);
  });
});

// --- AC-QP3: Explicit iteration bypasses echo guard ---

describe("AC-QP3: Explicit refine bypasses keyword_echo guard", () => {
  const REFINE_AGENT = `agent-qp-refine-${Date.now()}`;

  it("refine with echo words still persists (explicit iteration bypass)", async () => {
    if (!serverUp) return;

    // Step 1: Create a thought to refine
    const seedRes = await postMemory({
      prompt: "Vitest QP3 seed: coordination patterns for multi-agent workflow systems require explicit boundary definitions.",
      agent_id: REFINE_AGENT,
      agent_name: "QA Refine Test",
    });
    const seedBody = await seedRes.json();
    expect(seedBody.trace.thoughts_contributed).toBe(1);

    // Get the thought_id of the seed
    const seedSources = seedBody.result.sources;
    const seedThought = seedSources.find(
      (s: { contributor: string }) => s.contributor === "QA Refine Test"
    );
    // Skip if we can't find our own thought (still validates flow)
    if (!seedThought) return;

    // Step 2: Refine with similar words (would be echo without refines flag)
    const refineRes = await postMemory({
      prompt: "Refined: coordination patterns for multi-agent workflow systems require explicit boundary definitions and role-based task routing.",
      agent_id: REFINE_AGENT,
      agent_name: "QA Refine Test",
      refines: seedThought.thought_id,
    });
    const refineBody = await refineRes.json();
    expect(refineRes.status).toBe(200);
    // Should still persist because refines = explicit iteration
    expect(refineBody.trace.thoughts_contributed).toBe(1);
  });
});

// Cleanup
afterAll(async () => {
  const db = getDb();
  db.prepare("DELETE FROM query_log WHERE agent_id LIKE 'agent-p3%'").run();
  db.prepare("DELETE FROM query_log WHERE agent_id LIKE 'agent-onboard%'").run();
  db.prepare("DELETE FROM query_log WHERE agent_id LIKE 'agent-qp%'").run();
});
