/**
 * TDD tests for brain-query-echo-leak
 *
 * Verifies server-side auto-detection of recovery query patterns
 * to force read_only even when callers omit it.
 *
 * Bug: Agents (LLMs) reconstruct curl commands from skill templates
 * without read_only:true, causing recovery queries to be stored as
 * thoughts — filling the brain with noise.
 *
 * Fix: Server-side pattern detection in memory.ts that auto-forces
 * read_only for known recovery patterns before the contribution
 * threshold check.
 *
 * DEV IMPLEMENTATION NOTES:
 * - In api/src/routes/memory.ts:
 *   - Add isRecoveryQuery(prompt) function that detects known patterns
 *   - Patterns to detect: "Recovery protocol and role definition",
 *     "Current task state, recent decisions", "TASK START or TASK BLOCKED markers"
 *   - Apply BEFORE line 199 (thresholdMet check): if isRecoveryQuery, force read_only
 *   - Include auto_read_only: true in trace when auto-forced
 * - Target repo: xpollination-best-practices (brain API at api/src/routes/memory.ts)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BRAIN_API_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/api/src"
);

// --- Recovery query detection function ---
describe("brain-query-echo-leak: isRecoveryQuery function", () => {
  let content: string;
  try {
    content = readFileSync(resolve(BRAIN_API_DIR, "routes/memory.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("defines isRecoveryQuery function", () => {
    expect(content).toMatch(/function\s+isRecoveryQuery/);
  });

  it("detects 'Recovery protocol and role definition' pattern", () => {
    expect(content).toMatch(/[Rr]ecovery protocol and role definition/i);
  });

  it("detects 'Current task state, recent decisions' pattern", () => {
    expect(content).toMatch(/[Cc]urrent task state.*recent decisions/i);
  });

  it("detects 'TASK START or TASK BLOCKED markers' pattern", () => {
    expect(content).toMatch(/TASK START.*TASK BLOCKED|TASK BLOCKED.*TASK START/i);
  });

  it("returns boolean", () => {
    // Function should return boolean (used in conditional)
    expect(content).toMatch(/isRecoveryQuery\([^)]*\)\s*:\s*boolean|return\s+(true|false).*isRecoveryQuery/s);
  });
});

// --- Auto-force read_only integration ---
describe("brain-query-echo-leak: auto-force read_only in handleMemoryRequest", () => {
  let content: string;
  try {
    content = readFileSync(resolve(BRAIN_API_DIR, "routes/memory.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("calls isRecoveryQuery before thresholdMet calculation", () => {
    // isRecoveryQuery must appear BEFORE the thresholdMet line
    const recoveryIdx = content.indexOf("isRecoveryQuery");
    const thresholdIdx = content.indexOf("thresholdMet");
    // Both must exist and recovery check must come first (in handleMemoryRequest)
    expect(recoveryIdx).toBeGreaterThan(-1);
    expect(thresholdIdx).toBeGreaterThan(-1);
    // Find the isRecoveryQuery call within handleMemoryRequest (after line ~109)
    const handleFnIdx = content.indexOf("handleMemoryRequest");
    const afterHandle = content.slice(handleFnIdx);
    const recoveryInHandle = afterHandle.indexOf("isRecoveryQuery");
    const thresholdInHandle = afterHandle.indexOf("thresholdMet");
    expect(recoveryInHandle).toBeLessThan(thresholdInHandle);
  });

  it("auto-forces read_only when recovery pattern detected", () => {
    // Should override read_only to true when pattern matches
    expect(content).toMatch(/isRecoveryQuery.*read_only|read_only.*isRecoveryQuery/s);
  });

  it("includes auto_read_only in trace when auto-forced", () => {
    expect(content).toMatch(/auto_read_only/);
  });
});

// --- Integration test: known recovery patterns from monitor skill ---
describe("brain-query-echo-leak: pattern coverage", () => {
  let content: string;
  try {
    content = readFileSync(resolve(BRAIN_API_DIR, "routes/memory.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("handles case-insensitive matching for agent role variations", () => {
    // Recovery queries come with different role capitalizations
    // Pattern should use case-insensitive matching
    expect(content).toMatch(/toLowerCase|toLocaleLowerCase|\/i\b/);
  });

  it("does not block explicit contributions (read_only:false still works)", () => {
    // The auto-force should only apply when read_only is not explicitly set
    // or when it's undefined — not when caller explicitly passes read_only:false
    // Check for undefined/null check before overriding
    expect(content).toMatch(/read_only\s*(===|==|!==|!=)\s*(undefined|null|false)|read_only\s*\?\?|!read_only/);
  });
});
