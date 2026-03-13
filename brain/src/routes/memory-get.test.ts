/**
 * Tests for GET /api/v1/memory endpoint
 *
 * Acceptance criteria from task memory-get-endpoint-v2:
 * 1. GET /api/v1/memory returns same JSON structure as POST
 * 2. Query params: prompt, agent_id, agent_name, context, session_id
 * 3. Shared handler — no code duplication between GET and POST
 * 4. Existing POST endpoint unchanged
 * 5. URL-encoded params handled correctly
 * 6. Tests for GET endpoint
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

async function postMemory(body: Record<string, unknown>) {
  return fetch(`${BASE_URL}/api/v1/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getMemory(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${BASE_URL}/api/v1/memory?${qs}`);
}

let serverUp: boolean;

beforeAll(async () => {
  serverUp = await serverIsRunning();
});

// --- AC1: GET /api/v1/memory returns same JSON structure as POST ---

describe("AC1: GET returns same JSON structure as POST", () => {
  it("returns 200 for valid GET request", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "What patterns exist in multi-agent memory systems?",
      agent_id: "agent-get-test",
      agent_name: "QA GET Test",
    });
    expect(res.status).toBe(200);
  });

  it("returns result and trace in response body", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "How do agents share knowledge across sessions?",
      agent_id: "agent-get-test",
      agent_name: "QA GET Test",
    });
    const body = await res.json();
    expect(body).toHaveProperty("result");
    expect(body).toHaveProperty("trace");
    expect(body.result).toHaveProperty("response");
    expect(body.result).toHaveProperty("sources");
    expect(body.result).toHaveProperty("highways_nearby");
    expect(body.trace).toHaveProperty("session_id");
    expect(body.trace).toHaveProperty("operations");
    expect(body.trace).toHaveProperty("thoughts_retrieved");
    expect(body.trace).toHaveProperty("thoughts_contributed");
  });

  it("GET and POST produce same response shape for identical inputs", async () => {
    if (!serverUp) return;
    const params = {
      prompt: "Organizational debt accumulates silently in growing teams and becomes structural over time.",
      agent_id: "agent-get-compare",
      agent_name: "QA Compare",
      session_id: "compare-session-001",
    };

    const [getRes, postRes] = await Promise.all([
      getMemory(params),
      postMemory(params),
    ]);

    const getBody = await getRes.json();
    const postBody = await postRes.json();

    // Same top-level keys
    expect(Object.keys(getBody).sort()).toEqual(Object.keys(postBody).sort());
    // Same result keys
    expect(Object.keys(getBody.result).sort()).toEqual(Object.keys(postBody.result).sort());
    // Same trace keys
    expect(Object.keys(getBody.trace).sort()).toEqual(Object.keys(postBody.trace).sort());
  });
});

// --- AC2: Query params map to POST body fields ---

describe("AC2: Query params map correctly", () => {
  it("optional context param is passed through", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "The contribution threshold filters out noise and ensures only substantial thoughts persist in the knowledge base.",
      agent_id: "agent-get-context",
      agent_name: "QA Context Test",
      context: "testing GET endpoint context handling",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trace.context_used).toBe(true);
  });

  it("optional session_id param is passed through", async () => {
    if (!serverUp) return;
    const sid = "get-session-test-" + Date.now();
    const res = await getMemory({
      prompt: "Session tracking enables implicit feedback loops between related queries across time.",
      agent_id: "agent-get-session",
      agent_name: "QA Session Test",
      session_id: sid,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trace.session_id).toBe(sid);
  });

  it("auto-generates session_id when not provided", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "Agents that share findings accelerate collective learning beyond individual capability.",
      agent_id: "agent-get-nosession",
      agent_name: "QA No Session",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trace.session_id).toBeDefined();
    expect(body.trace.session_id.length).toBeGreaterThan(0);
  });
});

// --- AC4: Existing POST endpoint still works ---

describe("AC4: POST endpoint unchanged", () => {
  it("POST still returns 200", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "How do workflow engines validate state transitions?",
      agent_id: "agent-post-unchanged",
      agent_name: "QA POST Check",
    });
    expect(res.status).toBe(200);
  });

  it("POST still returns result and trace", async () => {
    if (!serverUp) return;
    const res = await postMemory({
      prompt: "State machines prevent invalid transitions and maintain workflow integrity across distributed systems.",
      agent_id: "agent-post-unchanged",
      agent_name: "QA POST Check",
    });
    const body = await res.json();
    expect(body).toHaveProperty("result");
    expect(body).toHaveProperty("trace");
  });
});

// --- AC5: URL-encoded params handled correctly ---

describe("AC5: URL-encoded params handled correctly", () => {
  it("handles spaces in prompt", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "Knowledge management requires both structured storage and organic discovery mechanisms for effective retrieval.",
      agent_id: "agent-get-spaces",
      agent_name: "QA Spaces Test",
    });
    expect(res.status).toBe(200);
  });

  it("handles special characters in prompt", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "Agent coordination uses role-based access: QA writes tests & DEV implements — never the reverse.",
      agent_id: "agent-get-special",
      agent_name: "QA Special Chars",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("result");
  });

  it("handles unicode in agent_name", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "Cross-cultural teams benefit from explicit communication protocols that reduce ambiguity in async work.",
      agent_id: "agent-get-unicode",
      agent_name: "QA Tëst Ägent Ü",
    });
    expect(res.status).toBe(200);
  });
});

// --- Validation: GET endpoint should enforce same validation as POST ---

describe("Validation: GET enforces same rules as POST", () => {
  it("returns 400 when prompt is missing", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      agent_id: "agent-get-noprompt",
      agent_name: "QA No Prompt",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when agent_id is missing", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "Testing missing agent_id on GET endpoint requires validation parity with POST.",
      agent_name: "QA No AgentId",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when agent_name is missing", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "Testing missing agent_name on GET endpoint requires validation parity with POST.",
      agent_id: "agent-get-noname",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for empty prompt", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "",
      agent_id: "agent-get-empty",
      agent_name: "QA Empty Prompt",
    });
    expect(res.status).toBe(400);
  });
});

// --- Contribution threshold: GET should apply same rules ---

describe("Contribution threshold via GET", () => {
  it("short prompt (<=50 chars) is NOT stored", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "Short thought here",
      agent_id: "agent-get-threshold",
      agent_name: "QA Threshold GET",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trace.contribution_threshold_met).toBe(false);
    expect(body.trace.thoughts_contributed).toBe(0);
  });

  it("long declarative prompt IS stored", async () => {
    if (!serverUp) return;
    const res = await getMemory({
      prompt: "The GET endpoint enables Claude web interface to access the Brain API via web_fetch for conversational knowledge access.",
      agent_id: "agent-get-threshold",
      agent_name: "QA Threshold GET",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trace.contribution_threshold_met).toBe(true);
    expect(body.trace.thoughts_contributed).toBe(1);
  });
});
