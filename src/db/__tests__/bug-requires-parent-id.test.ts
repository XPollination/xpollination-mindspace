/**
 * TDD tests for bug-requires-parent-id v0.0.1
 *
 * Gate in cmdCreate(): when type=bug, parent_ids must be a non-empty array.
 * Tasks and other types are not affected.
 *
 * Tests verify behavior by running the CLI with test database scenarios.
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

describe("Gate exists in interface-cli.js", () => {
  it("cmdCreate checks for bug type with parent_ids", () => {
    const source = readCli();
    expect(source).toMatch(/type\s*===\s*['"]bug['"]/);
    expect(source).toMatch(/parent_ids/);
  });

  it("gate rejects when parent_ids is missing for bug type", () => {
    const source = readCli();
    // Must check for empty/missing/not-array parent_ids on bug type
    const hasCheck = source.match(/bug.*parent_ids|parent_ids.*bug/s);
    expect(hasCheck).toBeTruthy();
  });

  it("error message mentions parent_ids requirement", () => {
    const source = readCli();
    expect(source).toMatch(/parent_ids.*required|bug.*parent_ids|must link/i);
  });
});

// ============================================================
// Integration Tests (CLI execution with test database)
// ============================================================

describe("Integration: bug parent_ids enforcement", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bug-parent-test-"));
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

    db.close();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function runCreate(type: string, slug: string, dna: Record<string, unknown>): { stdout: string; error: string | null; exitCode: number } {
    try {
      const dnaJson = JSON.stringify(dna);
      const stdout = execSync(
        `DATABASE_PATH=${dbPath} node ${CLI_PATH} create ${type} ${slug} '${dnaJson}' liaison`,
        { encoding: "utf-8", timeout: 10000 }
      );
      return { stdout, error: null, exitCode: 0 };
    } catch (e: any) {
      return { stdout: e.stdout || "", error: e.stderr || e.message, exitCode: e.status || 1 };
    }
  }

  it("REJECT: bug without parent_ids", () => {
    const result = runCreate("bug", "test-bug-no-parent", {
      title: "Bug without parent",
      role: "dev"
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/parent_ids/i);
  });

  it("REJECT: bug with empty parent_ids array", () => {
    const result = runCreate("bug", "test-bug-empty-parent", {
      title: "Bug with empty parents",
      role: "dev",
      parent_ids: []
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/parent_ids/i);
  });

  it("REJECT: bug with parent_ids as non-array (string)", () => {
    const result = runCreate("bug", "test-bug-string-parent", {
      title: "Bug with string parent",
      role: "dev",
      parent_ids: "some-parent-slug"
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/parent_ids/i);
  });

  it("PASS: bug with valid parent_ids array", () => {
    const result = runCreate("bug", "test-bug-valid-parent", {
      title: "Bug with valid parent",
      role: "dev",
      parent_ids: ["parent-task-slug"]
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.type).toBe("bug");
  });

  it("PASS: task without parent_ids (no enforcement for tasks)", () => {
    const result = runCreate("task", "test-task-no-parent", {
      title: "Task without parent",
      role: "dev"
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.type).toBe("task");
  });

  it("PASS: task with parent_ids still works normally", () => {
    const result = runCreate("task", "test-task-with-parent", {
      title: "Task with parent",
      role: "dev",
      parent_ids: ["parent-task-slug"]
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
  });

  it("PASS: bug with multiple parent_ids", () => {
    const result = runCreate("bug", "test-bug-multi-parent", {
      title: "Bug with multiple parents",
      role: "dev",
      parent_ids: ["parent-1", "parent-2"]
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
  });
});
