/**
 * TDD tests for wf-test-pass-gate
 *
 * Verifies workflow engine hard gate: 100% test pass required for completion.
 * - review->complete transition requires test_pass_count + test_total_count in DNA
 * - Gate validates test_pass_count === test_total_count (all tests must pass)
 * - Gate validates test_total_count > 0 (must have tests)
 * - Applies to both task and bug types
 * - Cannot be bypassed by any actor (liaison, system included)
 * - FIELD_VALIDATORS enforce integer types at write time
 * - Clear error message on gate block
 *
 * DEV IMPLEMENTATION NOTES:
 * - Modify src/db/workflow-engine.js:
 *   - Add test_pass_count + test_total_count to requiresDna on review->complete (task)
 *   - Add test_pass_count + test_total_count to requiresDna on review->complete (bug)
 *   - Add value validation in validateDnaRequirements():
 *     - test_pass_count must equal test_total_count
 *     - test_total_count must be > 0
 *     - Error message must include actual counts
 *   - approval->complete (research skip) does NOT require test counts
 * - Modify src/db/interface-cli.js:
 *   - Add FIELD_VALIDATORS for test_pass_count (positive integer)
 *   - Add FIELD_VALIDATORS for test_total_count (positive integer)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);
const WF_ENGINE = resolve(PROJECT_ROOT, "src/db/workflow-engine.js");
const CLI = resolve(PROJECT_ROOT, "src/db/interface-cli.js");

let wfContent: string;
let cliContent: string;
try { wfContent = readFileSync(WF_ENGINE, "utf-8"); } catch { wfContent = ""; }
try { cliContent = readFileSync(CLI, "utf-8"); } catch { cliContent = ""; }

// --- Task type: review->complete requires test counts ---
describe("wf-test-pass-gate: task review->complete requiresDna", () => {
  // Find the task review->complete rule and check it includes test fields
  it("task review->complete requires test_pass_count in DNA", () => {
    // The requiresDna array for review->complete must include test_pass_count
    // Look for the rule definition containing both review->complete and test_pass_count
    const taskBlock = wfContent.match(/'task':\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*(?:'bug'|\/\/)/);
    expect(taskBlock).not.toBeNull();
    const reviewComplete = taskBlock![1].match(/'review->complete':\s*\{[^}]*\}/);
    expect(reviewComplete).not.toBeNull();
    expect(reviewComplete![0]).toMatch(/test_pass_count/);
  });

  it("task review->complete requires test_total_count in DNA", () => {
    const taskBlock = wfContent.match(/'task':\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*(?:'bug'|\/\/)/);
    expect(taskBlock).not.toBeNull();
    const reviewComplete = taskBlock![1].match(/'review->complete':\s*\{[^}]*\}/);
    expect(reviewComplete).not.toBeNull();
    expect(reviewComplete![0]).toMatch(/test_total_count/);
  });
});

// --- Bug type: review->complete requires test counts ---
describe("wf-test-pass-gate: bug review->complete requiresDna", () => {
  it("bug review->complete requires test_pass_count in DNA", () => {
    const bugBlock = wfContent.match(/'bug':\s*\{([\s\S]*?)\n\s*\}/);
    expect(bugBlock).not.toBeNull();
    const reviewComplete = bugBlock![1].match(/'review->complete':\s*\{[^}]*\}/);
    expect(reviewComplete).not.toBeNull();
    expect(reviewComplete![0]).toMatch(/test_pass_count/);
  });

  it("bug review->complete requires test_total_count in DNA", () => {
    const bugBlock = wfContent.match(/'bug':\s*\{([\s\S]*?)\n\s*\}/);
    expect(bugBlock).not.toBeNull();
    const reviewComplete = bugBlock![1].match(/'review->complete':\s*\{[^}]*\}/);
    expect(reviewComplete).not.toBeNull();
    expect(reviewComplete![0]).toMatch(/test_total_count/);
  });
});

// --- validateDnaRequirements: equality + positivity validation ---
describe("wf-test-pass-gate: validateDnaRequirements value checks", () => {
  it("validates test_pass_count equals test_total_count", () => {
    // The function must contain logic comparing test_pass_count to test_total_count
    expect(wfContent).toMatch(/test_pass_count.*test_total_count|test_total_count.*test_pass_count/);
  });

  it("validates test_total_count is positive (> 0)", () => {
    // Must check that test_total_count is greater than 0
    expect(wfContent).toMatch(/test_total_count.*(?:>|<=)\s*0|test_total_count.*positive|test_total_count.*missing/i);
  });

  it("returns error message with actual counts on mismatch", () => {
    // Error message must include the actual values so agents know what failed
    expect(wfContent).toMatch(/test_pass_count|pass.*count/i);
    // Must reference both counts in an error/return string
    const fnBody = wfContent.match(/function validateDnaRequirements[\s\S]*?^}/m);
    expect(fnBody).not.toBeNull();
    expect(fnBody![0]).toMatch(/test_pass_count/);
    expect(fnBody![0]).toMatch(/test_total_count/);
  });

  it("check is inside validateDnaRequirements function", () => {
    // The validation must be in validateDnaRequirements, not scattered elsewhere
    const fnBody = wfContent.match(/function validateDnaRequirements[\s\S]*?^}/m);
    expect(fnBody).not.toBeNull();
    // Must contain comparison logic for test counts
    expect(fnBody![0]).toMatch(/test_pass_count.*!==.*test_total_count|test_pass_count.*!==|test_total_count.*test_pass_count/);
  });
});

// --- approval->complete (research skip) should NOT require test counts ---
describe("wf-test-pass-gate: approval->complete exemption", () => {
  it("approval->complete does NOT require test_pass_count", () => {
    // Research tasks skip QA via approval->complete — they have no tests
    const taskBlock = wfContent.match(/'task':\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*(?:'bug'|\/\/)/);
    expect(taskBlock).not.toBeNull();
    const approvalComplete = taskBlock![1].match(/'approval->complete':\s*\{[^}]*\}/);
    if (approvalComplete) {
      expect(approvalComplete![0]).not.toMatch(/test_pass_count/);
    }
    // If approval->complete doesn't exist, that's also fine (no gate needed)
  });
});

// --- FIELD_VALIDATORS for write-time validation ---
describe("wf-test-pass-gate: FIELD_VALIDATORS in interface-cli.js", () => {
  it("has FIELD_VALIDATORS entry for test_pass_count", () => {
    expect(cliContent).toMatch(/FIELD_VALIDATORS[\s\S]*test_pass_count/);
  });

  it("has FIELD_VALIDATORS entry for test_total_count", () => {
    expect(cliContent).toMatch(/FIELD_VALIDATORS[\s\S]*test_total_count/);
  });

  it("test_pass_count validator checks for integer type", () => {
    // Validator should reject non-integer values
    expect(cliContent).toMatch(/test_pass_count[\s\S]*?(?:integer|Number\.isInteger|parseInt|typeof.*number)/i);
  });

  it("test_total_count validator checks for integer type", () => {
    expect(cliContent).toMatch(/test_total_count[\s\S]*?(?:integer|Number\.isInteger|parseInt|typeof.*number)/i);
  });

  it("test_pass_count validator rejects negative values", () => {
    // Must ensure non-negative
    expect(cliContent).toMatch(/test_pass_count[\s\S]*?(?:<\s*0|>=\s*0|negative|non-negative)/i);
  });

  it("test_total_count validator rejects zero or negative", () => {
    // test_total_count must be positive (you must have tests)
    expect(cliContent).toMatch(/test_total_count[\s\S]*?(?:<=?\s*0|>\s*0|positive|must be)/i);
  });
});

// --- No bypass: gate applies to all actors ---
describe("wf-test-pass-gate: no bypass possible", () => {
  it("liaison cannot bypass test gate (review->complete still requires test fields)", () => {
    // The review->complete rule still allows only liaison, but requiresDna includes test fields
    const taskBlock = wfContent.match(/'task':\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*(?:'bug'|\/\/)/);
    expect(taskBlock).not.toBeNull();
    const rule = taskBlock![1].match(/'review->complete':\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    // Must have both liaison access AND test requirements
    expect(rule![0]).toMatch(/liaison/);
    expect(rule![0]).toMatch(/test_pass_count/);
    expect(rule![0]).toMatch(/test_total_count/);
  });

  it("no separate bypass transition exists for completing without tests", () => {
    // There should be no review->complete variant that skips test requirements
    // Only review->complete (with gate) and approval->complete (research skip) should exist
    const taskBlock = wfContent.match(/'task':\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*(?:'bug'|\/\/)/);
    expect(taskBlock).not.toBeNull();
    // Count review->complete variants — should be exactly 1
    const matches = taskBlock![1].match(/'review->complete[^']*'/g) || [];
    expect(matches.length).toBe(1);
  });
});
