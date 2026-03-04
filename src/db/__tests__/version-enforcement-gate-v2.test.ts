/**
 * TDD tests for version-enforcement-gate-v2
 *
 * Broadens v0.0.1 gate to cover:
 * - QA-initiated rework (rework_reason, not just liaison_rework_reason)
 * - Dev submissions (active→review, not just active→approval)
 * - First submission enforcement (must use v0.0.1)
 *
 * Tests are source code checks + integration tests with CLI.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

const CLI_PATH = resolve(__dirname, "..", "interface-cli.js");

function readCli(): string {
  return readFileSync(CLI_PATH, "utf-8");
}

// ============================================================
// Source Code Structure Tests
// ============================================================

describe("Gate broadened to cover all rework paths", () => {
  it("gate detects rework_reason (QA-initiated rework)", () => {
    const source = readCli();
    expect(source).toMatch(/rework_reason/);
  });

  it("gate detects rework_count as rework indicator", () => {
    const source = readCli();
    expect(source).toMatch(/rework_count/);
  });

  it("gate fires on active→review (dev submissions)", () => {
    const source = readCli();
    // Must check for review as target status, not just approval
    const hasReviewTrigger = source.match(/newStatus.*===.*review|review.*newStatus/s) ||
                              source.match(/active.*review.*version|version.*active.*review/s);
    expect(hasReviewTrigger).toBeTruthy();
  });

  it("first submission enforces v0.0.1", () => {
    const source = readCli();
    // Must check first submission requires v0.0.1
    expect(source).toMatch(/currentVersion\s*!==\s*1|version.*!==.*1|first.*v0\.0\.1/i);
  });

  it("quote check remains specific to liaison_rework_reason", () => {
    const source = readCli();
    // Quote/snippet check must be inside a liaison_rework_reason conditional
    const hasQuoteInLiaison = source.match(/liaison_rework_reason.*snippet|liaison_rework_reason.*includes/s);
    expect(hasQuoteInLiaison).toBeTruthy();
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe("Integration: broadened version enforcement gate", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "version-gate-v2-"));
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

  // --- QA-initiated rework path ---

  it("REJECT: QA rework with v0.0.1 in pdsa_ref (rework_reason set)", () => {
    createTaskInDb("test-qa-rework-v1", "active", {
      title: "QA rework v0.0.1",
      role: "pdsa",
      rework_reason: "Tests fail: 3 of 10 assertions wrong",
      rework_context: "REWORK v0.0.2: Fixed failing assertions per QA feedback.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-qa-rework-v1", "approval", "pdsa");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/version|v0\.0\.1|rework/i);
  });

  it("PASS: QA rework with v0.0.2 in pdsa_ref (no quote requirement)", () => {
    createTaskInDb("test-qa-rework-v2", "active", {
      title: "QA rework v0.0.2",
      role: "pdsa",
      rework_reason: "Tests fail: 3 of 10 assertions wrong",
      rework_context: "REWORK v0.0.2: Fixed failing assertions per QA feedback.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-qa-rework-v2", "approval", "pdsa");
    expect(result.exitCode).toBe(0);
  });

  it("REJECT: rework_count >= 1 with v0.0.1 in pdsa_ref", () => {
    createTaskInDb("test-rework-count", "active", {
      title: "Rework count indicator",
      role: "pdsa",
      rework_count: 1,
      rework_context: "REWORK v0.0.2: Second iteration.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-rework-count", "approval", "pdsa");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/version|rework/i);
  });

  // --- Dev submission path (active→review) ---

  it("REJECT: dev rework submission (active→review) with v0.0.1", () => {
    createTaskInDb("test-dev-rework-v1", "active", {
      title: "Dev rework submission",
      role: "dev",
      rework_reason: "Implementation does not match design",
      rework_context: "REWORK v0.0.2: Reimplemented per design spec.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-dev-rework-v1", "review", "dev");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/version|rework/i);
  });

  it("PASS: dev rework submission (active→review) with v0.0.2", () => {
    createTaskInDb("test-dev-rework-v2", "active", {
      title: "Dev rework v0.0.2",
      role: "dev",
      rework_reason: "Implementation does not match design",
      rework_context: "REWORK v0.0.2: Reimplemented per design spec.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-dev-rework-v2", "review", "dev");
    expect(result.exitCode).toBe(0);
  });

  // --- First submission enforcement ---

  it("PASS: first submission with v0.0.1 in pdsa_ref", () => {
    createTaskInDb("test-first-v1", "active", {
      title: "First submission v0.0.1",
      role: "pdsa",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-first-v1", "approval", "pdsa");
    expect(result.exitCode).toBe(0);
  });

  it("REJECT: first submission with v0.0.2 in pdsa_ref (should be v0.0.1)", () => {
    createTaskInDb("test-first-v2", "active", {
      title: "First submission with wrong version",
      role: "pdsa",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-first-v2", "approval", "pdsa");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/first.*v0\.0\.1|v0\.0\.1.*first|version/i);
  });

  // --- Guard clause: no pdsa_ref skips gate ---

  it("PASS: task without pdsa_ref skips gate entirely", () => {
    createTaskInDb("test-no-pdsa-ref", "active", {
      title: "No pdsa_ref task",
      role: "dev",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-no-pdsa-ref", "review", "dev");
    expect(result.exitCode).toBe(0);
  });

  // --- LIAISON rework still requires quotes ---

  it("REJECT: LIAISON rework without verbatim quote in rework_context", () => {
    const feedback = "The design completely misses the requirement for real-time updates and notifications.";
    createTaskInDb("test-liaison-no-quote", "active", {
      title: "LIAISON rework no quote",
      role: "pdsa",
      liaison_rework_reason: feedback,
      rework_context: "REWORK v0.0.2: Redesigned based on feedback about real-time features.",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-liaison-no-quote", "approval", "pdsa");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/verbatim|quote|feedback/i);
  });

  it("PASS: LIAISON rework with verbatim quote in rework_context", () => {
    const feedback = "The design completely misses the requirement for real-time updates and notifications.";
    createTaskInDb("test-liaison-quote", "active", {
      title: "LIAISON rework with quote",
      role: "pdsa",
      liaison_rework_reason: feedback,
      rework_context: `REWORK v0.0.2 based on Thomas: "${feedback}" — Added WebSocket support.`,
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.2/pdsa/DESIGN.md",
      memory_query_session: "test-session-id",
      memory_contribution_id: "test-contribution-id"
    });

    const result = runTransition("test-liaison-quote", "approval", "pdsa");
    expect(result.exitCode).toBe(0);
  });
});
