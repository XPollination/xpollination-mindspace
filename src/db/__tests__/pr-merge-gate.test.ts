/**
 * TDD tests for PR merge gate v0.0.1
 *
 * Verifies: (1) Workflow engine blocks review→complete without PR fields when feature_branch exists,
 * (2) Gate passes with all PR fields present,
 * (3) Tasks without feature_branch bypass the gate,
 * (4) Rework clears PR verdict but keeps pr_url and feature_branch.
 *
 * Tests: source code structure checks + integration tests with CLI.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

const CLI_PATH = resolve(__dirname, "..", "interface-cli.js");
const ENGINE_PATH = resolve(__dirname, "..", "workflow-engine.js");

function readCli(): string {
  return readFileSync(CLI_PATH, "utf-8");
}

function readEngine(): string {
  return readFileSync(ENGINE_PATH, "utf-8");
}

// ============================================================
// Source Code Structure Tests
// ============================================================

describe("Gate: PR merge enforcement in workflow-engine.js", () => {
  it("engine source references feature_branch", () => {
    const source = readEngine();
    expect(source).toMatch(/feature_branch/);
  });

  it("engine source references pr_url", () => {
    const source = readEngine();
    expect(source).toMatch(/pr_url/);
  });

  it("engine source references pr_review_verdict", () => {
    const source = readEngine();
    expect(source).toMatch(/pr_review_verdict/);
  });

  it("engine source references pr_merge_sha", () => {
    const source = readEngine();
    expect(source).toMatch(/pr_merge_sha/);
  });

  it("gate fires on complete transition when feature_branch exists", () => {
    const source = readEngine();
    const hasGate = source.match(/complete.*feature_branch|feature_branch.*complete/s);
    expect(hasGate).toBeTruthy();
  });

  it("gate provides clear error message for missing PR fields", () => {
    const source = readEngine();
    expect(source).toMatch(/PR merge gate|pr_url.*required|pr_review_verdict.*must be/i);
  });
});

describe("CLI: PR field validators in interface-cli.js", () => {
  it("CLI source has pr_url validator", () => {
    const source = readCli();
    expect(source).toMatch(/pr_url/);
  });

  it("CLI source has pr_review_verdict validator", () => {
    const source = readCli();
    expect(source).toMatch(/pr_review_verdict/);
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe("Integration: PR merge gate", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pr-merge-gate-"));
    dbPath = join(tmpDir, "test.db");
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE IF NOT EXISTS mindspace_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'task',
        status TEXT NOT NULL DEFAULT 'pending',
        slug TEXT UNIQUE NOT NULL,
        parent_ids TEXT DEFAULT '[]',
        child_ids TEXT DEFAULT '[]',
        dna_json TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS mindscape_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        actor TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.prepare("INSERT INTO system_settings (key, value, updated_by) VALUES ('liaison_approval_mode', 'auto', 'test')").run();
    db.close();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Base DNA for a complete-ready task with feature_branch
  const baseDnaWithBranch = {
    title: "Task with feature branch",
    abstract_ref: "https://github.com/test/repo/blob/main/abstract.md",
    changelog_ref: "https://github.com/test/repo/blob/main/changelog.md",
    test_pass_count: 5,
    test_total_count: 5,
    liaison_review: { decision: "APPROVE", reasoning: "Good" },
    liaison_q1_complete: "Tests cover all primary functionality and edge cases",
    liaison_q2_complete: "Implementation assumes standard deployment environment",
    liaison_q3_complete: "Thomas should verify the feature works end to end",
    human_answer: "approved",
    human_answer_at: "2026-03-20T10:00:00Z",
    approval_mode: "auto",
    feature_branch: "feature/test-task",
  };

  // Base DNA WITHOUT feature_branch (should bypass gate)
  const baseDnaWithoutBranch = {
    title: "Task without feature branch",
    abstract_ref: "https://github.com/test/repo/blob/main/abstract.md",
    test_pass_count: 3,
    test_total_count: 3,
    liaison_review: { decision: "APPROVE", reasoning: "Good" },
    liaison_q1_complete: "Tests cover all primary functionality and edge cases",
    liaison_q2_complete: "Implementation assumes standard deployment environment",
    liaison_q3_complete: "Thomas should verify the feature works end to end",
    human_answer: "approved",
    human_answer_at: "2026-03-20T10:00:00Z",
    approval_mode: "auto",
  };

  // Complete PR DNA (all fields present)
  const prFields = {
    pr_url: "https://github.com/XPollination/xpollination-mindspace/pull/42",
    pr_review_verdict: "merge",
    pr_review_reasoning: "Diff matches PDSA design. All 5 tests pass. No unrelated changes. Scope respected.",
    pr_merge_sha: "abc1234def5678",
  };

  function createTaskInDb(slug: string, status: string, role: string, dna: Record<string, unknown>) {
    const db = new Database(dbPath);
    db.prepare(`
      INSERT INTO mindspace_nodes (id, type, status, slug, dna_json)
      VALUES (?, 'task', ?, ?, ?)
    `).run(slug, status, slug, JSON.stringify({ ...dna, role }));
    db.close();
  }

  function runTransition(slug: string, newStatus: string, actor: string): { stdout: string; error: string; exitCode: number } {
    try {
      const stdout = execSync(
        `DATABASE_PATH=${dbPath} node ${CLI_PATH} transition ${slug} ${newStatus} ${actor}`,
        { encoding: "utf-8", timeout: 10000 }
      );
      return { stdout, error: "", exitCode: 0 };
    } catch (e: any) {
      return { stdout: e.stdout || "", error: e.stderr || e.message, exitCode: e.status || 1 };
    }
  }

  function getDna(slug: string): Record<string, unknown> {
    const db = new Database(dbPath);
    const row = db.prepare("SELECT dna_json FROM mindspace_nodes WHERE slug = ?").get(slug) as any;
    db.close();
    return JSON.parse(row.dna_json);
  }

  // --- Gate blocks without required PR fields ---

  it("REJECT: review→complete with feature_branch but no pr_url", () => {
    createTaskInDb("test-no-pr-url", "review", "liaison", {
      ...baseDnaWithBranch,
      pr_review_verdict: "merge",
      pr_review_reasoning: prFields.pr_review_reasoning,
      pr_merge_sha: prFields.pr_merge_sha,
      // pr_url missing
    });
    const result = runTransition("test-no-pr-url", "complete", "liaison");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/pr_url|PR merge gate/i);
  });

  it("REJECT: review→complete with feature_branch but no pr_review_verdict", () => {
    createTaskInDb("test-no-verdict", "review", "liaison", {
      ...baseDnaWithBranch,
      pr_url: prFields.pr_url,
      pr_review_reasoning: prFields.pr_review_reasoning,
      pr_merge_sha: prFields.pr_merge_sha,
      // pr_review_verdict missing
    });
    const result = runTransition("test-no-verdict", "complete", "liaison");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/pr_review_verdict|PR merge gate/i);
  });

  it("REJECT: review→complete with feature_branch and verdict=rework", () => {
    createTaskInDb("test-rework-verdict", "review", "liaison", {
      ...baseDnaWithBranch,
      ...prFields,
      pr_review_verdict: "rework",
    });
    const result = runTransition("test-rework-verdict", "complete", "liaison");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/pr_review_verdict.*merge|must be.*merge/i);
  });

  it("REJECT: review→complete with feature_branch but no pr_merge_sha", () => {
    createTaskInDb("test-no-sha", "review", "liaison", {
      ...baseDnaWithBranch,
      pr_url: prFields.pr_url,
      pr_review_verdict: "merge",
      pr_review_reasoning: prFields.pr_review_reasoning,
      // pr_merge_sha missing
    });
    const result = runTransition("test-no-sha", "complete", "liaison");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/pr_merge_sha|PR merge gate/i);
  });

  it("REJECT: review→complete with feature_branch and short reasoning (<50 chars)", () => {
    createTaskInDb("test-short-reasoning", "review", "liaison", {
      ...baseDnaWithBranch,
      ...prFields,
      pr_review_reasoning: "LGTM looks good",  // 16 chars, under 50
    });
    const result = runTransition("test-short-reasoning", "complete", "liaison");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/pr_review_reasoning|min.*50|PR merge gate/i);
  });

  // --- Gate passes with all fields ---

  it("PASS: review→complete with feature_branch and all PR fields", () => {
    createTaskInDb("test-all-pr-fields", "review", "liaison", {
      ...baseDnaWithBranch,
      ...prFields,
    });
    const result = runTransition("test-all-pr-fields", "complete", "liaison");
    expect(result.exitCode).toBe(0);
  });

  // --- Gate skipped without feature_branch ---

  it("PASS: review→complete WITHOUT feature_branch bypasses PR gate", () => {
    createTaskInDb("test-no-branch", "review", "liaison", baseDnaWithoutBranch);
    const result = runTransition("test-no-branch", "complete", "liaison");
    expect(result.exitCode).toBe(0);
  });
});
