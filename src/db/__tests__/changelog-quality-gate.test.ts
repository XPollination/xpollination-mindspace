/**
 * TDD tests for changelog-quality-gate v0.0.2
 *
 * Verifies: (1) Quality gate in interface-cli.js rejects complete without changelog_ref,
 * (2) Viz detail panel shows changelog_ref as clickable link,
 * (3) PM status skill mentions changelog in management abstract.
 *
 * Tests: source code checks + integration tests with CLI.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

const CLI_PATH = resolve(__dirname, "..", "interface-cli.js");

const VIZ_DIR = resolve(__dirname, "..", "..", "..", "viz");
function readViz(): string {
  const activeIndex = join(VIZ_DIR, "active", "index.html");
  if (existsSync(activeIndex)) {
    return readFileSync(activeIndex, "utf-8");
  }
  return readFileSync(join(VIZ_DIR, "index.html"), "utf-8");
}

function readCli(): string {
  return readFileSync(CLI_PATH, "utf-8");
}

const SKILL_PATH = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md"
);

// ============================================================
// Source Code Structure Tests
// ============================================================

describe("Gate: changelog_ref enforcement in interface-cli.js", () => {
  it("CLI source references changelog_ref", () => {
    const source = readCli();
    expect(source).toMatch(/changelog_ref/);
  });

  it("gate fires on review->complete or a completion transition", () => {
    const source = readCli();
    // Must check for complete as target status with changelog_ref validation
    const hasCompleteGate = source.match(/complete.*changelog_ref|changelog_ref.*complete/s) ||
                             source.match(/newStatus.*complete.*changelog|changelog.*newStatus.*complete/s);
    expect(hasCompleteGate).toBeTruthy();
  });

  it("gate provides clear error message when changelog missing", () => {
    const source = readCli();
    expect(source).toMatch(/changelog.*missing|missing.*changelog|changelog_ref.*required/i);
  });
});

describe("Viz: changelog_ref in detail panel", () => {
  it("detail panel renders changelog_ref field", () => {
    const source = readViz();
    expect(source).toMatch(/changelog_ref/);
  });

  it("changelog_ref rendered as clickable link", () => {
    const source = readViz();
    // Must be an <a> tag with href referencing changelog_ref
    const hasChangelogLink = source.match(/changelog_ref.*href|href.*changelog_ref/s) ||
                              source.match(/changelog_ref.*<a|<a.*changelog_ref/s);
    expect(hasChangelogLink).toBeTruthy();
  });
});

describe("PM Status: changelog in management abstract", () => {
  it("skill file mentions changelog in WHAT WAS DONE or template", () => {
    if (!existsSync(SKILL_PATH)) {
      expect.fail("Skill file not found");
      return;
    }
    const source = readFileSync(SKILL_PATH, "utf-8");
    expect(source).toMatch(/changelog/i);
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe("Integration: changelog_ref quality gate", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "changelog-gate-"));
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

  function createTaskInDb(slug: string, status: string, role: string, dna: Record<string, unknown>) {
    const db = new Database(dbPath);
    db.prepare(`
      INSERT INTO mindspace_nodes (id, type, status, slug, dna_json)
      VALUES (?, 'task', ?, ?, ?)
    `).run(slug, status, slug, JSON.stringify({ ...dna, role }));
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

  it("REJECT: review->complete without changelog_ref", () => {
    createTaskInDb("test-no-changelog", "review", "liaison", {
      title: "Task without changelog",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      abstract_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      qa_review: "PASS",
      human_confirmed: true
    });

    const result = runTransition("test-no-changelog", "complete", "liaison");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/changelog/i);
  });

  it("PASS: review->complete with changelog_ref", () => {
    createTaskInDb("test-with-changelog", "review", "liaison", {
      title: "Task with changelog",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      abstract_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      changelog_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/changelog.md",
      qa_review: "PASS",
      human_confirmed: true
    });

    const result = runTransition("test-with-changelog", "complete", "liaison");
    expect(result.exitCode).toBe(0);
  });

  it("PASS: task without pdsa_ref skips changelog gate", () => {
    createTaskInDb("test-no-pdsa-ref", "review", "liaison", {
      title: "Simple task no pdsa_ref",
      abstract_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/abstract.md",
      human_confirmed: true
    });

    const result = runTransition("test-no-pdsa-ref", "complete", "liaison");
    expect(result.exitCode).toBe(0);
  });

  it("REJECT: changelog_ref is empty string", () => {
    createTaskInDb("test-empty-changelog", "review", "liaison", {
      title: "Empty changelog ref",
      pdsa_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      abstract_ref: "https://github.com/test/repo/blob/main/tracks/test/v0.0.1/pdsa/DESIGN.md",
      changelog_ref: "",
      qa_review: "PASS",
      human_confirmed: true
    });

    const result = runTransition("test-empty-changelog", "complete", "liaison");
    expect(result.exitCode).not.toBe(0);
    expect(result.error).toMatch(/changelog/i);
  });
});
