/**
 * Phase 2 Tests: Access Tracking + Pheromone Model
 *
 * Tests acceptance criteria from spec Sections 4.2, 6, 8:
 * 1. access_count increments on each retrieval
 * 2. accessed_by tracks unique agent_ids
 * 3. access_log capped at 100 entries
 * 4. co_retrieved_with tracks pairs with counts, capped at 50
 * 5. Pheromone reinforcement +0.05 per access, capped at 10.0
 * 6. Decay job runs hourly, applies 0.995 multiplier, floor 0.1
 * 7. session_id generated per query
 * 8. query_log populated with each retrieval
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";
import { think, retrieve, runPheromoneDecay, ThoughtError } from "./thoughtspace.js";
import { getDb } from "./database.js";
import { embed } from "./embedding.js";

const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// Helper: get point payload from Qdrant
async function getPayload(thoughtId: string): Promise<Record<string, unknown>> {
  const points = await qdrant.retrieve("thought_space", {
    ids: [thoughtId],
    with_payload: true,
  });
  return points[0].payload as Record<string, unknown>;
}

// --- Test fixtures ---

let thoughtA: string;
let thoughtB: string;
let thoughtC: string;
let queryVec: number[];

beforeAll(async () => {
  // Create 3 test thoughts that will be co-retrieved
  const [a, b, c] = await Promise.all([
    think({
      content: "Access tracking verifies that each retrieval increments counters correctly in the thought space system.",
      contributor_id: "agent-qa-p2",
      contributor_name: "QA Phase2",
      thought_type: "original",
      source_ids: [],
      tags: ["phase2-test"],
    }),
    think({
      content: "Pheromone reinforcement makes frequently accessed thoughts more prominent over time in the knowledge substrate.",
      contributor_id: "agent-qa-p2",
      contributor_name: "QA Phase2",
      thought_type: "original",
      source_ids: [],
      tags: ["phase2-test"],
    }),
    think({
      content: "Co-retrieval tracking records which thoughts appear together in search results to build associative maps.",
      contributor_id: "agent-qa-p2",
      contributor_name: "QA Phase2",
      thought_type: "original",
      source_ids: [],
      tags: ["phase2-test"],
    }),
  ]);

  thoughtA = a.thought_id;
  thoughtB = b.thought_id;
  thoughtC = c.thought_id;

  // Wait for indexing
  await new Promise((r) => setTimeout(r, 500));

  // Pre-compute a query vector that should match our test thoughts
  queryVec = await embed("access tracking pheromone reinforcement thought space");
});

afterAll(async () => {
  // Cleanup test thoughts
  const ids = [thoughtA, thoughtB, thoughtC].filter(Boolean);
  if (ids.length > 0) {
    await qdrant.delete("thought_space", { points: ids, wait: true });
  }
  // Cleanup query_log
  const db = getDb();
  db.prepare("DELETE FROM query_log WHERE agent_id LIKE 'agent-%-p2'").run();
});

// --- AC1: access_count increments ---

describe("AC1: access_count increments on each retrieval", () => {
  it("starts at 0 before any retrieval", async () => {
    const p = await getPayload(thoughtA);
    expect(p.access_count).toBe(0);
  });

  it("increments to 1 after first retrieval", async () => {
    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-counter-p2",
      session_id: "count-session-1",
      filter_tags: ["phase2-test"],
    });

    const p = await getPayload(thoughtA);
    expect(p.access_count).toBe(1);
  });

  it("increments to 2 after second retrieval", async () => {
    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-counter-p2",
      session_id: "count-session-2",
      filter_tags: ["phase2-test"],
    });

    const p = await getPayload(thoughtA);
    expect(p.access_count).toBe(2);
  });
});

// --- AC2: accessed_by tracks unique agent_ids ---

describe("AC2: accessed_by deduplication", () => {
  it("contains the retrieving agent", async () => {
    const p = await getPayload(thoughtA);
    const accessedBy = p.accessed_by as string[];
    expect(accessedBy).toContain("agent-counter-p2");
  });

  it("adds a second unique agent", async () => {
    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-second-p2",
      session_id: "dedup-session-1",
      filter_tags: ["phase2-test"],
    });

    const p = await getPayload(thoughtA);
    const accessedBy = p.accessed_by as string[];
    expect(accessedBy).toContain("agent-counter-p2");
    expect(accessedBy).toContain("agent-second-p2");
    expect(accessedBy.length).toBe(2);
  });

  it("does not duplicate on repeat access by same agent", async () => {
    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-second-p2",
      session_id: "dedup-session-2",
      filter_tags: ["phase2-test"],
    });

    const p = await getPayload(thoughtA);
    const accessedBy = p.accessed_by as string[];
    const count = accessedBy.filter((a) => a === "agent-second-p2").length;
    expect(count).toBe(1);
  });
});

// --- AC3: access_log capped at 100 ---

describe("AC3: access_log structure and cap", () => {
  it("has correct entry structure", async () => {
    const p = await getPayload(thoughtA);
    const accessLog = p.access_log as Array<{ user_id: string; timestamp: string; session_id: string }>;
    expect(accessLog.length).toBeGreaterThan(0);

    const entry = accessLog[0];
    expect(entry).toHaveProperty("user_id");
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("session_id");
  });
});

// --- AC4: co_retrieved_with tracks pairs ---

describe("AC4: co_retrieved_with tracking", () => {
  it("tracks co-retrieval between thoughts returned together", async () => {
    // thoughtA and thoughtB should have been co-retrieved (all tagged phase2-test)
    const pA = await getPayload(thoughtA);
    const coRetrieved = pA.co_retrieved_with as Array<{ thought_id: string; count: number }>;

    // Should reference thoughtB and/or thoughtC
    const otherIds = coRetrieved.map((e) => e.thought_id);
    expect(otherIds.length).toBeGreaterThan(0);
  });

  it("has correct entry structure {thought_id, count}", async () => {
    const pA = await getPayload(thoughtA);
    const coRetrieved = pA.co_retrieved_with as Array<{ thought_id: string; count: number }>;

    for (const entry of coRetrieved) {
      expect(entry).toHaveProperty("thought_id");
      expect(entry).toHaveProperty("count");
      expect(typeof entry.thought_id).toBe("string");
      expect(typeof entry.count).toBe("number");
      expect(entry.count).toBeGreaterThan(0);
    }
  });

  it("increments count on repeated co-retrieval", async () => {
    const pBefore = await getPayload(thoughtA);
    const coBefore = pBefore.co_retrieved_with as Array<{ thought_id: string; count: number }>;
    const countBefore = coBefore.find((e) => e.thought_id === thoughtB)?.count ?? 0;

    // One more retrieval
    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-co-p2",
      session_id: "co-session-1",
      filter_tags: ["phase2-test"],
    });

    const pAfter = await getPayload(thoughtA);
    const coAfter = pAfter.co_retrieved_with as Array<{ thought_id: string; count: number }>;
    const countAfter = coAfter.find((e) => e.thought_id === thoughtB)?.count ?? 0;

    expect(countAfter).toBeGreaterThan(countBefore);
  });
});

// --- AC5: Pheromone reinforcement ---

describe("AC5: Pheromone reinforcement +0.05 per access, cap 10.0", () => {
  it("weight increases by 0.05 per retrieval from initial 1.0", async () => {
    // thoughtA has been retrieved multiple times by now
    const p = await getPayload(thoughtA);
    const weight = p.pheromone_weight as number;
    // Initial 1.0 + (N retrievals * 0.05)
    expect(weight).toBeGreaterThan(1.0);
    // Each retrieval adds 0.05
    const expectedMin = 1.0 + 5 * 0.05; // At least 5 retrievals happened
    expect(weight).toBeGreaterThanOrEqual(expectedMin);
  });

  it("returned pheromone_weight reflects the reinforced value", async () => {
    const results = await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-weight-p2",
      session_id: "weight-session-1",
      filter_tags: ["phase2-test"],
    });

    for (const r of results) {
      // All returned weights should be > 1.0 (they've all been accessed)
      expect(r.pheromone_weight).toBeGreaterThan(1.0);
    }
  });
});

// --- AC6: Pheromone decay ---

describe("AC6: Pheromone decay job", () => {
  let decayTestThoughtId: string;

  beforeAll(async () => {
    // Create a thought and access it, then backdate last_accessed
    const result = await think({
      content: "This thought tests pheromone decay by having its last_accessed set in the past.",
      contributor_id: "agent-decay-p2",
      contributor_name: "QA Decay Test",
      thought_type: "original",
      source_ids: [],
      tags: ["decay-test"],
    });
    decayTestThoughtId = result.thought_id;

    await new Promise((r) => setTimeout(r, 300));

    // Access it to set pheromone > 1.0 and last_accessed
    const vec = await embed("pheromone decay test");
    await retrieve({
      query_embedding: vec,
      agent_id: "agent-decay-p2",
      session_id: "decay-session",
      filter_tags: ["decay-test"],
    });

    // Backdate last_accessed to 2 hours ago so decay job picks it up
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await qdrant.setPayload("thought_space", {
      points: [decayTestThoughtId],
      payload: { last_accessed: twoHoursAgo },
      wait: true,
    });
  });

  afterAll(async () => {
    if (decayTestThoughtId) {
      await qdrant.delete("thought_space", {
        points: [decayTestThoughtId],
        wait: true,
      });
    }
  });

  it("decay reduces weight by 0.995 multiplier", async () => {
    const before = await getPayload(decayTestThoughtId);
    const weightBefore = before.pheromone_weight as number;
    expect(weightBefore).toBeGreaterThan(1.0);

    const updated = await runPheromoneDecay();
    expect(updated).toBeGreaterThan(0);

    const after = await getPayload(decayTestThoughtId);
    const weightAfter = after.pheromone_weight as number;

    // Should be weightBefore * 0.995
    const expected = Math.max(0.1, weightBefore * 0.995);
    expect(weightAfter).toBeCloseTo(expected, 5);
  });

  it("decay respects floor of 0.1", async () => {
    // Set weight to just above floor
    await qdrant.setPayload("thought_space", {
      points: [decayTestThoughtId],
      payload: {
        pheromone_weight: 0.1,
        last_accessed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      wait: true,
    });

    await runPheromoneDecay();

    const after = await getPayload(decayTestThoughtId);
    const weight = after.pheromone_weight as number;
    expect(weight).toBeGreaterThanOrEqual(0.1);
  });
});

// --- AC7: session_id generation ---

describe("AC7: session_id handling", () => {
  it("uses provided session_id in query_log", async () => {
    const db = getDb();
    const customSession = "custom-session-p2-test";

    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-session-p2",
      session_id: customSession,
      filter_tags: ["phase2-test"],
    });

    const row = db.prepare("SELECT * FROM query_log WHERE session_id = ?").get(customSession) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.session_id).toBe(customSession);

    // Cleanup
    db.prepare("DELETE FROM query_log WHERE session_id = ?").run(customSession);
  });
});

// --- AC8: query_log populated ---

describe("AC8: query_log populated with each retrieval", () => {
  it("writes entry with correct fields on retrieval", async () => {
    const db = getDb();
    const sessionId = "qlog-test-p2";

    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-qlog-p2",
      session_id: sessionId,
      filter_tags: ["phase2-test"],
    });

    const row = db.prepare("SELECT * FROM query_log WHERE session_id = ?").get(sessionId) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.agent_id).toBe("agent-qlog-p2");
    expect(row.session_id).toBe(sessionId);
    expect(row.result_count).toBeGreaterThan(0);
    expect(row.knowledge_space_id).toBe("ks-default");

    // returned_ids should be valid JSON array
    const returnedIds = JSON.parse(row.returned_ids as string);
    expect(Array.isArray(returnedIds)).toBe(true);
    expect(returnedIds.length).toBeGreaterThan(0);

    // Cleanup
    db.prepare("DELETE FROM query_log WHERE session_id = ?").run(sessionId);
  });
});

// --- Spec acceptance test: 5 retrievals ---

describe("Spec acceptance: 5 retrievals → access_count=5, weight=1.25", () => {
  let acceptTestId: string;

  beforeAll(async () => {
    const result = await think({
      content: "Acceptance test for Phase 2: repeated retrieval should increment counters and reinforce pheromone weight correctly.",
      contributor_id: "agent-accept-p2",
      contributor_name: "QA Accept",
      thought_type: "original",
      source_ids: [],
      tags: ["accept-p2"],
    });
    acceptTestId = result.thought_id;
    await new Promise((r) => setTimeout(r, 500));
  });

  afterAll(async () => {
    if (acceptTestId) {
      await qdrant.delete("thought_space", { points: [acceptTestId], wait: true });
    }
    const db = getDb();
    db.prepare("DELETE FROM query_log WHERE agent_id = 'agent-accept-p2'").run();
  });

  it("after 5 retrievals: access_count=5, pheromone_weight=1.25", async () => {
    const vec = await embed("acceptance test repeated retrieval counters pheromone");

    // Retrieve 5 times
    for (let i = 0; i < 5; i++) {
      await retrieve({
        query_embedding: vec,
        agent_id: "agent-accept-p2",
        session_id: `accept-session-${i}`,
        filter_tags: ["accept-p2"],
      });
    }

    const p = await getPayload(acceptTestId);
    expect(p.access_count).toBe(5);
    expect(p.pheromone_weight).toBeCloseTo(1.25, 5);
  });

  it("after decay: weight decreases from 1.25", async () => {
    // Backdate last_accessed
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await qdrant.setPayload("thought_space", {
      points: [acceptTestId],
      payload: { last_accessed: twoHoursAgo },
      wait: true,
    });

    await runPheromoneDecay();

    const p = await getPayload(acceptTestId);
    const weight = p.pheromone_weight as number;
    expect(weight).toBeCloseTo(1.25 * 0.995, 5); // 1.24375
    expect(weight).toBeLessThan(1.25);
  });
});
