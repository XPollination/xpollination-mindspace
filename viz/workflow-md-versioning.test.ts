/**
 * TDD tests for workflow-md-versioning
 *
 * Verifies WORKFLOW.md has been moved into the versioning pattern:
 * - Frozen copy at tracks/process/context/workflow/v16/WORKFLOW.md
 * - Symlink at tracks/process/context/WORKFLOW.md → workflow/v16/WORKFLOW.md
 * - Content identical, references still resolve
 * - Other context files NOT restructured (lazy pattern)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create tracks/process/context/workflow/v16/ directory
 * - Copy current WORKFLOW.md to workflow/v16/WORKFLOW.md
 * - Replace tracks/process/context/WORKFLOW.md with symlink to workflow/v16/WORKFLOW.md
 * - Do NOT touch DOCUMENTATION.md or TEMPLATE.pdsa.md
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { existsSync, lstatSync, readlinkSync, readFileSync } from "node:fs";

const CONTEXT_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/tracks/process/context"
);

describe("workflow-md-versioning", () => {
  // --- Test 1: Frozen copy exists ---
  it("frozen copy exists at workflow/v16/WORKFLOW.md", () => {
    const frozenPath = resolve(CONTEXT_DIR, "workflow/v16/WORKFLOW.md");
    expect(existsSync(frozenPath)).toBe(true);
  });

  it("frozen copy is a regular file (not symlink)", () => {
    const frozenPath = resolve(CONTEXT_DIR, "workflow/v16/WORKFLOW.md");
    const stat = lstatSync(frozenPath);
    expect(stat.isFile()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);
  });

  it("frozen copy contains WORKFLOW.md content (v16 header)", () => {
    const frozenPath = resolve(CONTEXT_DIR, "workflow/v16/WORKFLOW.md");
    const content = readFileSync(frozenPath, "utf-8");
    // WORKFLOW.md should have version identifier
    expect(content).toMatch(/WORKFLOW|workflow/i);
    expect(content.length).toBeGreaterThan(100);
  });

  // --- Test 2: Symlink at original path ---
  it("tracks/process/context/WORKFLOW.md is a symlink", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const stat = lstatSync(symlinkPath);
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("symlink points to workflow/v16/WORKFLOW.md", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const target = readlinkSync(symlinkPath);
    expect(target).toBe("workflow/v16/WORKFLOW.md");
  });

  // --- Test 3: Symlink resolves and content matches ---
  it("symlink resolves: reading WORKFLOW.md returns content", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const content = readFileSync(symlinkPath, "utf-8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("content via symlink matches frozen copy exactly", () => {
    const symlinkPath = resolve(CONTEXT_DIR, "WORKFLOW.md");
    const frozenPath = resolve(CONTEXT_DIR, "workflow/v16/WORKFLOW.md");
    const symlinkContent = readFileSync(symlinkPath, "utf-8");
    const frozenContent = readFileSync(frozenPath, "utf-8");
    expect(symlinkContent).toBe(frozenContent);
  });

  // --- Test 4: Other context files NOT restructured ---
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
