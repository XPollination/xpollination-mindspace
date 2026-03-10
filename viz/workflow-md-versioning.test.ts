/**
 * TDD tests for workflow-md-versioning
 *
 * Verifies WORKFLOW.md versioning pattern:
 * - Frozen copy at tracks/process/context/workflow/v0.0.17/WORKFLOW.md
 *   (originally v16, renamed to v0.0.17 per v0.0.X convention)
 * - Symlink at tracks/process/context/WORKFLOW.md → workflow/v0.0.17/WORKFLOW.md
 * - Old v16/ directory removed (cleanup in workflow-complete-role-reset v0.0.6)
 * - Content identical, references still resolve
 * - Other context files NOT restructured (lazy pattern)
 *
 * DEV IMPLEMENTATION NOTES:
 * - v16/ was the original versioned directory (workflow-md-versioning task)
 * - v0.0.17/ replaced v17/ (workflow-complete-role-reset v0.0.5)
 * - v16/ deleted (workflow-complete-role-reset v0.0.6)
 * - Symlink now points to workflow/v0.0.17/WORKFLOW.md
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { existsSync, lstatSync, readlinkSync, readFileSync } from "node:fs";

const CONTEXT_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context"
);

describe("workflow-md-versioning", () => {
  // --- Test 1: Current versioned copy exists (v0.0.17) ---
  it("versioned copy exists at workflow/v0.0.17/WORKFLOW.md", () => {
    const versionedPath = resolve(CONTEXT_DIR, "workflow/v0.0.17/WORKFLOW.md");
    expect(existsSync(versionedPath)).toBe(true);
  });

  it("versioned copy is a regular file (not symlink)", () => {
    const versionedPath = resolve(CONTEXT_DIR, "workflow/v0.0.17/WORKFLOW.md");
    const stat = lstatSync(versionedPath);
    expect(stat.isFile()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);
  });

  it("versioned copy contains WORKFLOW.md content", () => {
    const versionedPath = resolve(CONTEXT_DIR, "workflow/v0.0.17/WORKFLOW.md");
    const content = readFileSync(versionedPath, "utf-8");
    expect(content).toMatch(/WORKFLOW|workflow/i);
    expect(content.length).toBeGreaterThan(100);
  });

  // --- Test 2: Old v16/ directory removed ---
  it("old v16/ directory no longer exists", () => {
    const oldPath = resolve(CONTEXT_DIR, "workflow/v16");
    expect(existsSync(oldPath)).toBe(false);
  });

  // --- Test 3: Symlink at original path ---
  it("tracks/process/context/WORKFLOW.md is a symlink", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const stat = lstatSync(symlinkPath);
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("symlink points to workflow/v0.0.17/WORKFLOW.md", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const target = readlinkSync(symlinkPath);
    expect(target).toBe("workflow/v0.0.17/WORKFLOW.md");
  });

  // --- Test 4: Symlink resolves and content matches ---
  it("symlink resolves: reading WORKFLOW.md returns content", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const content = readFileSync(symlinkPath, "utf-8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("content via symlink matches versioned copy exactly", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const versionedPath = resolve(CONTEXT_DIR, "workflow/v0.0.17/WORKFLOW.md");
    const symlinkContent = readFileSync(symlinkPath, "utf-8");
    const versionedContent = readFileSync(versionedPath, "utf-8");
    expect(symlinkContent).toBe(versionedContent);
  });

  // --- Test 5: Other context files NOT restructured ---
  it("DOCUMENTATION.md is NOT a symlink (lazy pattern: untouched)", () => {
    const docPath = resolve(CONTEXT_DIR, "DOCUMENTATION.md");
    if (existsSync(docPath)) {
      const stat = lstatSync(docPath);
      expect(stat.isSymbolicLink()).toBe(false);
    }
  });

  it("TEMPLATE.pdsa.md is NOT a symlink (lazy pattern: untouched)", () => {
    const templatePath = resolve(CONTEXT_DIR, "TEMPLATE.pdsa.md");
    if (existsSync(templatePath)) {
      const stat = lstatSync(templatePath);
      expect(stat.isSymbolicLink()).toBe(false);
    }
  });
});
