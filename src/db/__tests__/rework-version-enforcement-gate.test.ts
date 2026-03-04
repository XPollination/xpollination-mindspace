/**
 * TDD tests for rework-version-enforcement-gate v0.0.1
 *
 * Gate fires on active->approval when liaison_rework_reason exists in DNA.
 * Enforces: (1) version > 1 in pdsa_ref, (2) rework_context exists,
 * (3) rework_context contains verbatim human feedback substring.
 *
 * Per PDSA DESIGN.md: gate lives in interface-cli.js cmdTransition(),
 * between DNA validation and LIAISON approval mode gate.
 *
 * Tests verify behavior by reading interface-cli.js source code and
 * running the CLI with test database scenarios.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";

const CLI_PATH = resolve(__dirname, "..", "interface-cli.js");
const SCHEMA_PATH = resolve(__dirname, "..", "..", "..", "data", "schema.sql");

function readCli(): string {
  return readFileSync(CLI_PATH, "utf-8");
}

// ============================================================
// Source Code Structure Tests
// ============================================================

describe("Gate exists in interface-cli.js", () => {
  it("rework version gate code block exists", () => {
    const source = readCli();
    // Gate must check for liaison_rework_reason
    expect(source).toMatch(/liaison_rework_reason/);
  });

  it("gate checks pdsa_ref version number", () => {
    const source = readCli();
    // Must extract version from pdsa_ref
    expect(source).toMatch(/pdsa_ref.*v0\.0\.|v0\.0\..*pdsa_ref/);
  });

  it("gate checks rework_context field exists", () => {
    const source = readCli();
    // Must check for rework_context
    expect(source).toMatch(/rework_context/);
  });

  it("gate fires on active->approval transition", () => {
    const source = readCli();
    // Gate condition must reference active->approval
    const hasGateCondition = source.match(/active.*approval.*liaison_rework_reason/s) ||
                              source.match(/liaison_rework_reason.*active.*approval/s) ||
                              source.match(/active->approval.*rework/s);
    expect(hasGateCondition).toBeTruthy();
  });
});

describe("Gate rejects version v0.0.1 on rework submissions", () => {
  it("gate rejects when pdsa_ref contains v0.0.1", () => {
    const source = readCli();
    // Must check that version > 1
    const hasVersionCheck = source.match(/currentVersion\s*<=\s*1|version.*<=.*1|parseInt.*<=\s*1/);
    expect(hasVersionCheck).toBeTruthy();
  });

  it("error message mentions version increment requirement", () => {
    const source = readCli();
    // Error message must guide the user
    expect(source).toMatch(/new version|v0\.0\.2|version.*increment|never.*v0\.0\.1/i);
  });
});

describe("Gate requires rework_context with human quotes", () => {
  it("gate requires rework_context field when liaison_rework_reason present", () => {
    const source = readCli();
    // Must error when rework_context is missing
    expect(source).toMatch(/rework_context.*required|!dna\.rework_context|rework_context.*missing/i);
  });

  it("gate verifies human feedback substring appears in rework_context", () => {
    const source = readCli();
    // Must do substring match of liaison_rework_reason in rework_context
    const hasSubstringCheck = source.match(/includes.*snippet|substring|indexOf.*feedback|feedback.*includes/);
    expect(hasSubstringCheck).toBeTruthy();
  });

  it("short feedback (<20 chars) skips quote verification", () => {
    const source = readCli();
    // Must have a length threshold for quote verification
    expect(source).toMatch(/length\s*>\s*20|\.length.*20/);
  });
});

// ============================================================
// Integration Tests (CLI execution with test database)
// ============================================================

describe("Integration: rework version gate enforcement", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rework-gate-test-"));
    dbPath = join(tmpDir, "test.db");
    const db = new Database(dbPath);

    // Create schema
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
      CREATE TABLE IF NOT EXISTS mindspace_history (
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

    // Set auto approval mode to avoid human confirm requirement
    db.prepare("INSERT INTO system_settings (key, value, updated_by) VALUES ('liaison_approval_mode', 'auto', 'test')").run();

    db.close();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTaskInDb(slug: string, status: string, dna: Record<string, unknown>) {
    const db = new Database(dbPath);
    db.prepare(`
      INSERT INTO mindspace_nodes (id, type, status, slug, dna_json)
      VALUES (?, 'task', ?, ?, ?)
    `).run(slug, status, slug, JSON.stringify(dna));
    db.close();
  }

  function runTransition(slug: string, newStatus: string, actor: string): { stdout: string; error: string | null; exitCode: number } {
    try {
      const stdout = execSync(
        `DATABASE_PATH=${dbPath} node ${CLI_PATH} transition ${slug} ${newStatus} ${actor}`,
        { encoding: "utf-8", timeout: 10000 }
      );
      return { stdout, error: null, exitCode: 0 };
    } catch (e: any) {
      return { stdout: e.stdout || "", error: e.stderr || e.message, exitCode: e.status || 1 };
    }
  }

  it("PASS: rework task with v0.0.2, rework_context, and matching quotes", () => {
    const feedback = "I like the role badges but the loop arrows need to be removed. Full redesign needed.";
    createTaskInDb("test-rework-pass", "active", {
      title: "Test rework pass",
      role: "pdsa",
      liaison_rework_reason: feedback,
      rework_context: `REWORK v0.0.2 based on Thomas feedback: "${feedback}" — Redesigned as Kanban board.`,
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-rework-pass", "approval", "pdsa");
    expect(result.exitCode).toBe(0);
  });

  it("REJECT: rework task with v0.0.1 in pdsa_ref (version not incremented)", () => {
    const feedback = "This needs to be completely reworked from scratch with better approach.";
    createTaskInDb("test-rework-v1", "active", {
      title: "Test rework v1 reject",
      role: "pdsa",
      liaison_rework_reason: feedback,
      rework_context: `REWORK v0.0.2: "${feedback}"`,
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-rework-v1", "approval", "pdsa");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/version|v0\.0\.1|increment/i);
  });

  it("REJECT: rework task missing rework_context", () => {
    const feedback = "The implementation does not match the requirements at all.";
    createTaskInDb("test-rework-no-ctx", "active", {
      title: "Test no context",
      role: "pdsa",
      liaison_rework_reason: feedback,
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-rework-no-ctx", "approval", "pdsa");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/rework_context/i);
  });

  it("REJECT: rework_context does not contain verbatim human feedback", () => {
    const feedback = "I need the workflow to show agent names clearly and remove all arrow elements.";
    createTaskInDb("test-rework-no-quote", "active", {
      title: "Test no quote",
      role: "pdsa",
      liaison_rework_reason: feedback,
      rework_context: "REWORK v0.0.2: Redesigned the entire UI based on feedback.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-rework-no-quote", "approval", "pdsa");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/verbatim|quote|feedback/i);
  });

  it("PASS: non-rework task (no liaison_rework_reason) skips gate entirely", () => {
    createTaskInDb("test-first-submit", "active", {
      title: "First submission",
      role: "pdsa",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-first-submit", "approval", "pdsa");
    // Should pass — no liaison_rework_reason means gate doesn't fire
    expect(result.exitCode).toBe(0);
  });

  it("PASS: short feedback (<20 chars) skips quote verification", () => {
    createTaskInDb("test-short-feedback", "active", {
      title: "Short feedback test",
      role: "pdsa",
      liaison_rework_reason: "rejected",
      rework_context: "REWORK v0.0.2: Task was rejected. Redesigned.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-short-feedback", "approval", "pdsa");
    expect(result.exitCode).toBe(0);
  });
});
