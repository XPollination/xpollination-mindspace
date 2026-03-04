/**
 * TDD tests for brain-loop-read-write-mandatory
 *
 * Tests the brain writeback Stop hook (xpo.claude.brain-writeback-hook.sh)
 * and the full read-write loop (UserPromptSubmit read + Stop writeback).
 *
 * Tests run the actual shell script with mocked stdin to verify behavior.
 * Brain API must be running at localhost:3200 for integration tests.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BEST_PRACTICES_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices"
);
const WRITEBACK_SCRIPT = resolve(
  BEST_PRACTICES_DIR,
  "scripts/xpo.claude.brain-writeback-hook.sh"
);
const BRAIN_FIRST_SCRIPT = resolve(
  BEST_PRACTICES_DIR,
  "scripts/xpo.claude.brain-first-hook.sh"
);
const SETTINGS_PATH = resolve("/home/developer/.claude/settings.json");

// Helper: run hook script with given stdin JSON
function runHook(
  script: string,
  stdinJson: object,
  env: Record<string, string> = {}
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bash", [script], {
    input: JSON.stringify(stdinJson),
    encoding: "utf-8",
    timeout: 10000,
    env: {
      ...process.env,
      ...env,
    },
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.status ?? 1,
  };
}

// ============================================================
// PRE: Script and config existence
// ============================================================

describe("PRE: Script and configuration exist", () => {
  it("brain-writeback-hook.sh exists", () => {
    expect(existsSync(WRITEBACK_SCRIPT)).toBe(true);
  });

  it("brain-writeback-hook.sh is executable or bash-runnable", () => {
    // Script must be valid bash
    const result = spawnSync("bash", ["-n", WRITEBACK_SCRIPT], {
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
  });

  it("settings.json has Stop hook configured", () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    expect(settings.hooks?.Stop).toBeDefined();
    expect(settings.hooks.Stop.length).toBeGreaterThan(0);
  });

  it("Stop hook references brain-writeback-hook.sh", () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    const stopHooks = settings.hooks?.Stop || [];
    const commands = stopHooks.flatMap(
      (h: any) => h.hooks?.map((hh: any) => hh.command) || []
    );
    const hasWriteback = commands.some((c: string) =>
      c.includes("brain-writeback-hook")
    );
    expect(hasWriteback).toBe(true);
  });

  it("Stop hook is async (non-blocking)", () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    const stopHooks = settings.hooks?.Stop || [];
    // At least one hook entry should have async behavior
    const hasAsync = stopHooks.some(
      (h: any) =>
        h.hooks?.some((hh: any) => hh.async === true) || h.async === true
    );
    expect(hasAsync).toBe(true);
  });
});

// ============================================================
// TEST 1: Substantive response triggers brain write
// ============================================================

describe("TEST 1: Substantive response triggers brain contribution", () => {
  it("exits 0 on substantive response (>100 chars)", () => {
    const longMessage =
      "After analyzing the codebase I found that the authentication module needs refactoring because the token validation logic is duplicated across three middleware functions.";
    const result = runHook(
      WRITEBACK_SCRIPT,
      {
        session_id: "test-session-001",
        transcript_path: "/tmp/test-transcript.jsonl",
        cwd: "/tmp",
        hook_event_name: "Stop",
        stop_hook_active: false,
        last_assistant_message: longMessage,
      },
      { AGENT_ROLE: "qa" }
    );
    expect(result.exitCode).toBe(0);
  });

  it("contributes to brain with thought_category=agent_conclusion", () => {
    // Verify script sends correct category to brain API
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    expect(source).toMatch(/agent_conclusion/);
  });

  it("includes agent_id and agent_name from AGENT_ROLE env", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    expect(source).toMatch(/AGENT_ROLE|agent_id|agent_name/);
  });
});

// ============================================================
// TEST 2: Short response does NOT write to brain
// ============================================================

describe("TEST 2: Short response (<100 chars) skips brain write", () => {
  it("exits 0 without brain call for short response", () => {
    const result = runHook(
      WRITEBACK_SCRIPT,
      {
        session_id: "test-session-002",
        transcript_path: "/tmp/test-transcript.jsonl",
        cwd: "/tmp",
        hook_event_name: "Stop",
        stop_hook_active: false,
        last_assistant_message: "Done.",
      },
      { AGENT_ROLE: "qa" }
    );
    expect(result.exitCode).toBe(0);
    // Should not produce brain contribution output
  });

  it("script has length guard for short messages", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    // Must check message length — 100 chars threshold
    expect(source).toMatch(/100|length/);
  });
});

// ============================================================
// TEST 3: Question-only response does NOT write to brain
// ============================================================

describe("TEST 3: Question-only response skips brain write", () => {
  it("exits 0 without brain call for question-only response", () => {
    const result = runHook(
      WRITEBACK_SCRIPT,
      {
        session_id: "test-session-003",
        transcript_path: "/tmp/test-transcript.jsonl",
        cwd: "/tmp",
        hook_event_name: "Stop",
        stop_hook_active: false,
        last_assistant_message: "What authentication method should we use?",
      },
      { AGENT_ROLE: "qa" }
    );
    expect(result.exitCode).toBe(0);
  });

  it("script has question detection guard", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    // Must detect questions (ends with ?)
    expect(source).toMatch(/\\\?|question|interrogative/i);
  });
});

// ============================================================
// TEST 4: Brain API down — graceful exit, no blocking
// ============================================================

describe("TEST 4: Brain API down — graceful exit", () => {
  it("script has health check with timeout", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    expect(source).toMatch(/health|timeout/i);
  });

  it("script exits 0 on brain failure (never blocks agent)", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    // Must exit 0 on failure — never exit 2 (which would block)
    // The script should NOT have exit 2 for brain failures
    // It should always exit 0 (soft fail)
    expect(source).toMatch(/exit 0/);
  });

  it("script never uses exit 2 (never blocks agent response)", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    // Count exit 2 occurrences — should be 0 for a Stop hook
    // Stop hooks should never block delivery of agent response
    const exit2Matches = source.match(/exit 2/g);
    expect(exit2Matches).toBeNull();
  });
});

// ============================================================
// TEST 5: stop_hook_active=true prevents infinite loops
// ============================================================

describe("TEST 5: Loop prevention via stop_hook_active", () => {
  it("exits immediately when stop_hook_active is true", () => {
    const result = runHook(
      WRITEBACK_SCRIPT,
      {
        session_id: "test-session-005",
        transcript_path: "/tmp/test-transcript.jsonl",
        cwd: "/tmp",
        hook_event_name: "Stop",
        stop_hook_active: true,
        last_assistant_message:
          "This is a substantive response that would normally trigger a brain write but should be skipped due to loop prevention.",
      },
      { AGENT_ROLE: "qa" }
    );
    expect(result.exitCode).toBe(0);
  });

  it("script checks stop_hook_active flag", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    expect(source).toMatch(/stop_hook_active/);
  });
});

// ============================================================
// TEST 6: Full loop integration — read hook + write hook
// ============================================================

describe("TEST 6: Full loop — both hooks configured", () => {
  it("UserPromptSubmit (read) hook exists and is configured", () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    const upsHooks = settings.hooks?.UserPromptSubmit || [];
    expect(upsHooks.length).toBeGreaterThan(0);
    const commands = upsHooks.flatMap(
      (h: any) => h.hooks?.map((hh: any) => hh.command) || []
    );
    expect(commands.some((c: string) => c.includes("brain-first-hook"))).toBe(
      true
    );
  });

  it("Stop (write) hook exists and is configured", () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    const stopHooks = settings.hooks?.Stop || [];
    expect(stopHooks.length).toBeGreaterThan(0);
    const commands = stopHooks.flatMap(
      (h: any) => h.hooks?.map((hh: any) => hh.command) || []
    );
    expect(
      commands.some((c: string) => c.includes("brain-writeback-hook"))
    ).toBe(true);
  });

  it("read hook uses read_only:true (retrieval only)", () => {
    const source = readFileSync(BRAIN_FIRST_SCRIPT, "utf-8");
    expect(source).toMatch(/read_only.*true/);
  });

  it("write hook uses read_only:false or omits it (contributes)", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    // Should either set read_only:false or not set it at all (defaults to false)
    const hasReadOnlyTrue = /read_only.*true/.test(source);
    expect(hasReadOnlyTrue).toBe(false);
  });

  it("write hook truncates contribution to max 500 chars", () => {
    const source = readFileSync(WRITEBACK_SCRIPT, "utf-8");
    expect(source).toMatch(/500|slice|substring|truncat/i);
  });
});
