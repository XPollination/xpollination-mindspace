/**
 * TDD tests for p0-1-brain-write-quality
 *
 * Tests validateBrainWrite() function.
 * These tests define the specification — DEV implements to make them pass.
 *
 * DEV IMPLEMENTATION NOTES:
 * - validateBrainWrite() must be exported from interface-cli.js
 * - The main CLI execution block must be guarded so import doesn't trigger process.exit
 *   (e.g., wrap with: if (process.argv[1]?.includes('interface-cli')) { ... })
 * - Alternatively, extract validateBrainWrite to a separate module and re-export
 *
 * Validation rules (from PDSA design):
 * 1. Reject if prompt ends with question mark (interrogative)
 * 2. Reject if prompt length < 50 chars
 * 3. Reject if prompt matches known query patterns
 * 4. Reject if prompt is a near-duplicate of the slug
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { resolve } from "node:path";

const CLI_PATH = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js"
);

let validateBrainWrite: (prompt: string, slug?: string) => { valid: boolean; reason?: string };

beforeAll(async () => {
  // Mock process.exit to prevent CLI main block from killing the test runner
  const originalExit = process.exit;
  vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

  try {
    const mod = await import(CLI_PATH);
    validateBrainWrite = mod.validateBrainWrite;
  } finally {
    vi.restoreAllMocks();
  }

  if (!validateBrainWrite) {
    throw new Error(
      "validateBrainWrite is not exported from interface-cli.js. " +
      "DEV must: (1) implement validateBrainWrite(prompt, slug?) and export it, " +
      "(2) guard the main CLI block so it doesn't run on import."
    );
  }
});

describe("validateBrainWrite", () => {
  // --- Rule 1: Reject interrogatives ---
  describe("Rule 1: reject interrogatives (ends with ?)", () => {
    it("rejects a prompt ending with question mark", () => {
      const result = validateBrainWrite(
        "Recovery protocol and role definition for QA agent. What are my responsibilities?"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/interrogative|question/i);
    });

    it("rejects a short question", () => {
      const result = validateBrainWrite(
        "What is the current task state for all projects right now?"
      );
      expect(result.valid).toBe(false);
    });

    it("accepts a prompt that contains ? but does not end with it", () => {
      const result = validateBrainWrite(
        "TASK END: QA reviewed p0-1 (xpollination-mcp-server). Question marks in code? Not a problem. Outcome: PASS. All 4 validation rules implemented correctly."
      );
      expect(result.valid).toBe(true);
    });
  });

  // --- Rule 2: Reject short prompts (< 50 chars) ---
  describe("Rule 2: reject short prompts (< 50 chars)", () => {
    it("rejects a prompt with fewer than 50 characters", () => {
      const result = validateBrainWrite("TASK START: QA claiming slug");
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/short|length|50/i);
    });

    it("rejects an empty string", () => {
      const result = validateBrainWrite("");
      expect(result.valid).toBe(false);
    });

    it("accepts a prompt with exactly 50 characters", () => {
      const prompt = "TASK END: QA completed review. Outcome: PASS. Done";
      expect(prompt.length).toBeGreaterThanOrEqual(50);
      const result = validateBrainWrite(prompt);
      expect(result.valid).toBe(true);
    });
  });

  // --- Rule 3: Reject known query patterns ---
  describe("Rule 3: reject known query patterns", () => {
    it("rejects 'Recovery protocol' pattern", () => {
      const result = validateBrainWrite(
        "Recovery protocol and role definition for QA agent. What are my responsibilities and what are the latest operational learnings"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/query pattern|known pattern/i);
    });

    it("rejects 'Current task state' pattern", () => {
      const result = validateBrainWrite(
        "Current task state, recent decisions, and in-flight work across all projects"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/query pattern|known pattern/i);
    });

    it("rejects 'TASK START or TASK BLOCKED markers' pattern", () => {
      const result = validateBrainWrite(
        "TASK START or TASK BLOCKED markers for QA agent — any interrupted or in-progress tasks"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/query pattern|known pattern/i);
    });

    it("rejects prompts containing 'What are my responsibilities'", () => {
      const result = validateBrainWrite(
        "Role definition for dev agent. What are my responsibilities in this project and workflow"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/query pattern|known pattern/i);
    });

    it("does NOT reject valid TASK START contributions", () => {
      const result = validateBrainWrite(
        "TASK START: QA claiming p0-1-brain-write-quality (xpollination-mcp-server). Context: brain writes are low quality. Plan: write vitest tests for validateBrainWrite."
      );
      expect(result.valid).toBe(true);
    });

    it("does NOT reject valid TASK END contributions", () => {
      const result = validateBrainWrite(
        "TASK active->review: DEV p0-1-brain-write-quality (xpollination-mcp-server). Outcome: PASS. What I did: added validateBrainWrite() with 4 rules. Key findings: needed regex for pattern matching."
      );
      expect(result.valid).toBe(true);
    });
  });

  // --- Rule 4: Reject near-duplicates of slug ---
  describe("Rule 4: reject near-duplicates of slug", () => {
    it("rejects prompt that is just the slug text", () => {
      const result = validateBrainWrite(
        "p0-1-brain-write-quality",
        "p0-1-brain-write-quality"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/slug|duplicate/i);
    });

    it("rejects prompt that is the slug with minor additions", () => {
      const result = validateBrainWrite(
        "Task: p0-1-brain-write-quality done",
        "p0-1-brain-write-quality"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/slug|duplicate/i);
    });

    it("accepts a substantive prompt that contains the slug", () => {
      const result = validateBrainWrite(
        "TASK END: QA p0-1-brain-write-quality (xpollination-mcp-server). Outcome: PASS. What I did: wrote 15 vitest tests covering all 4 validation rules. Key findings: regex pattern matching sufficient for query detection.",
        "p0-1-brain-write-quality"
      );
      expect(result.valid).toBe(true);
    });

    it("works when slug parameter is omitted", () => {
      const result = validateBrainWrite(
        "TASK END: QA completed comprehensive review of production snapshot. All ports verified, all collections confirmed."
      );
      expect(result.valid).toBe(true);
    });
  });

  // --- Integration: multiple rules can trigger ---
  describe("multiple rules", () => {
    it("rejects on first matching rule (short + interrogative)", () => {
      const result = validateBrainWrite("What is this?");
      expect(result.valid).toBe(false);
    });

    it("accepts a well-formed contribution", () => {
      const result = validateBrainWrite(
        "TASK active->testing: QA p0-1-brain-write-quality (xpollination-mcp-server). Outcome: Tests written. What I did: created 15 vitest specs for validateBrainWrite(). Key findings: 4 rejection rules cover the echo-query problem. Next: DEV implements validateBrainWrite() to pass these tests."
      );
      expect(result.valid).toBe(true);
    });
  });

  // --- Return type contract ---
  describe("return type", () => {
    it("returns { valid: true } for valid contributions", () => {
      const result = validateBrainWrite(
        "TASK SUMMARY: production snapshot verified. All 15 ports match, 5 Qdrant collections confirmed, WireGuard VPN UP."
      );
      expect(result).toHaveProperty("valid", true);
      expect(result.reason).toBeUndefined();
    });

    it("returns { valid: false, reason: string } for rejections", () => {
      const result = validateBrainWrite("too short");
      expect(result).toHaveProperty("valid", false);
      expect(result).toHaveProperty("reason");
      expect(typeof result.reason).toBe("string");
    });
  });
});
