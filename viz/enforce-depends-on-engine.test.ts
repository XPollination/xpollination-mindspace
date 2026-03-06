/**
 * TDD tests for enforce-depends-on-engine
 *
 * Two gates in cmdTransition() for pending→ready:
 * A. Dependency-aware scheduling: all depends_on tasks must be complete
 * B. Dependency reflection: must have depends_on OR depends_on_reviewed=true
 *
 * DEV IMPLEMENTATION NOTES:
 * - Add both gates in cmdTransition() for pending→ready transitions
 * - Gate A: iterate depends_on[], check each slug's status in DB, reject if any not complete
 * - Gate B: if depends_on is empty/missing and depends_on_reviewed is not true, reject
 * - Migration: bulk set depends_on_reviewed=true for existing pending tasks
 * - Only pending→ready is gated. Other transitions (rework→active, etc.) unaffected.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";

const PROJECT_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);
const CLI_PATH = resolve(PROJECT_DIR, "src/db/interface-cli.js");
const SCHEMA_PATH = resolve(PROJECT_DIR, "src/db/schema.sql");

function cli(dbPath: string, args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(
      `node ${CLI_PATH} ${args}`,
      {
        encoding: "utf-8",
        env: { ...process.env, DATABASE_PATH: dbPath },
        timeout: 10000,
        cwd: PROJECT_DIR,
      }
    );
    return { stdout, stderr: "", exitCode: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || "",
      exitCode: e.status || 1,
    };
  }
}

describe("enforce-depends-on-engine", () => {
  let tmpDir: string;
  let dbPath: string;
  let testNum = 0;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "depends-on-test-"));
    dbPath = join(tmpDir, "test.db");
    const schema = readFileSync(SCHEMA_PATH, "utf-8");
    const db = new Database(dbPath);
    db.exec(schema);
    db.close();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper: unique slug per test
  function slug(name: string): string {
    return `test-${++testNum}-${name}`;
  }

  // Helper: create task at pending with given DNA
  function createPending(taskSlug: string, dna: Record<string, any>) {
    const dnaStr = JSON.stringify(dna).replace(/'/g, "'\\''");
    return cli(dbPath, `create task ${taskSlug} '${dnaStr}' system`);
  }

  // Helper: create a complete task (for dependency targets)
  function createCompleteTask(taskSlug: string) {
    createPending(taskSlug, {
      title: `Dep: ${taskSlug}`,
      role: "dev",
      depends_on_reviewed: true,
      memory_query_session: "s1",
    });
    cli(dbPath, `transition ${taskSlug} ready system`);
    cli(dbPath, `transition ${taskSlug} active dev`);
    cli(dbPath, `update-dna ${taskSlug} '{"memory_contribution_id":"c1","abstract_ref":"https://github.com/test/abstract.md"}' dev`);
    cli(dbPath, `transition ${taskSlug} review dev`);
    cli(dbPath, `transition ${taskSlug} complete liaison`);
  }

  // --- Change A: Dependency-aware scheduling gate ---

  describe("Change A: dependency scheduling gate", () => {
    it("TEST 1: depends_on=[incomplete-task] → pending→ready REJECTED", () => {
      const depSlug = slug("incomplete-dep");
      createPending(depSlug, { title: "Incomplete dep", role: "dev", depends_on_reviewed: true, memory_query_session: "s1" });

      const taskSlug = slug("has-dep");
      createPending(taskSlug, {
        title: "Has dep",
        role: "dev",
        depends_on: [depSlug],
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/dependency|depends_on|incomplete/i);
      expect(result.stderr).toContain(depSlug);
    });

    it("TEST 2: depends_on=[complete-task] → pending→ready ALLOWED", () => {
      const depSlug = slug("complete-dep");
      createCompleteTask(depSlug);

      const taskSlug = slug("dep-met");
      createPending(taskSlug, {
        title: "Dep met",
        role: "dev",
        depends_on: [depSlug],
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.success).toBe(true);
    });

    it("TEST 3: depends_on=[nonexistent-slug] → pending→ready REJECTED with 'not found'", () => {
      const taskSlug = slug("missing-dep");
      createPending(taskSlug, {
        title: "Missing dep",
        role: "dev",
        depends_on: ["this-slug-does-not-exist"],
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/not found/i);
    });

    it("TEST 7: depends_on=[complete-a, incomplete-b] → REJECTED, lists only incomplete-b", () => {
      const completeSlug = slug("mix-complete");
      createCompleteTask(completeSlug);

      const incompleteSlug = slug("mix-incomplete");
      createPending(incompleteSlug, { title: "Incomplete", role: "dev", depends_on_reviewed: true, memory_query_session: "s1" });

      const taskSlug = slug("mixed-deps");
      createPending(taskSlug, {
        title: "Mixed deps",
        role: "dev",
        depends_on: [completeSlug, incompleteSlug],
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(incompleteSlug);
      expect(result.stderr).not.toContain(completeSlug);
    });

    it("TEST 7b (qa_note): 3 deps, only 1 incomplete → error lists only the incomplete one", () => {
      const complete1 = slug("dep-ok-1");
      const complete2 = slug("dep-ok-2");
      const incomplete1 = slug("dep-bad-1");
      createCompleteTask(complete1);
      createCompleteTask(complete2);
      createPending(incomplete1, { title: "Bad dep", role: "dev", depends_on_reviewed: true, memory_query_session: "s1" });

      const taskSlug = slug("three-deps");
      createPending(taskSlug, {
        title: "Three deps",
        role: "dev",
        depends_on: [complete1, complete2, incomplete1],
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(incomplete1);
      expect(result.stderr).not.toContain(complete1);
      expect(result.stderr).not.toContain(complete2);
    });
  });

  // --- Change B: Dependency reflection gate ---

  describe("Change B: dependency reflection gate", () => {
    it("TEST 4: depends_on=[] and no depends_on_reviewed → pending→ready REJECTED", () => {
      const taskSlug = slug("no-reviewed");
      createPending(taskSlug, {
        title: "No reviewed flag",
        role: "dev",
        depends_on: [],
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/depends_on_reviewed|reflection/i);
    });

    it("TEST 5: depends_on=[] and depends_on_reviewed=true → pending→ready ALLOWED", () => {
      const taskSlug = slug("reviewed-ok");
      createPending(taskSlug, {
        title: "Reviewed OK",
        role: "dev",
        depends_on: [],
        depends_on_reviewed: true,
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.success).toBe(true);
    });

    it("TEST 6: no depends_on field and no depends_on_reviewed → pending→ready REJECTED", () => {
      const taskSlug = slug("no-field");
      createPending(taskSlug, {
        title: "No depends_on field at all",
        role: "dev",
        memory_query_session: "s1",
      });

      const result = cli(dbPath, `transition ${taskSlug} ready system`);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/depends_on_reviewed|reflection/i);
    });
  });

  // --- Non-pending transitions unaffected ---

  describe("non-pending transitions unaffected", () => {
    it("TEST 8: rework→active does NOT check depends_on", () => {
      // Create task, advance to rework state
      const taskSlug = slug("rework-no-check");
      createPending(taskSlug, {
        title: "Rework test",
        role: "dev",
        depends_on: ["nonexistent-should-not-matter"],
        depends_on_reviewed: true,
        memory_query_session: "s1",
      });
      // Need to get to rework. Simplest: pending→ready→active→review→rework
      // But depends_on blocks pending→ready... so use depends_on_reviewed + no depends_on for this test
      // Actually, let me create with a met dependency
      const depSlug = slug("rework-dep");
      createCompleteTask(depSlug);

      const taskSlug2 = slug("rework-test");
      createPending(taskSlug2, {
        title: "Rework test 2",
        role: "dev",
        depends_on: [depSlug],
        memory_query_session: "s1",
      });
      cli(dbPath, `transition ${taskSlug2} ready system`);
      cli(dbPath, `transition ${taskSlug2} active dev`);
      cli(dbPath, `update-dna ${taskSlug2} '{"memory_contribution_id":"c1"}' dev`);
      cli(dbPath, `transition ${taskSlug2} review dev`);
      cli(dbPath, `transition ${taskSlug2} rework qa`);

      // Now in rework+dev. Add a broken depends_on to DNA
      cli(dbPath, `update-dna ${taskSlug2} '{"depends_on":["totally-broken-dep"],"memory_query_session":"s2"}' dev`);

      // rework→active should NOT check depends_on
      const result = cli(dbPath, `transition ${taskSlug2} active dev`);
      expect(result.exitCode).toBe(0);
    });
  });
});
