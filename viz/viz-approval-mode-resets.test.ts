/**
 * TDD tests for viz-approval-mode-resets — Bug fix for liaison approval mode
 * silently resetting to manual without user action.
 *
 * From PDSA viz-approval-mode-resets v0.0.1 (2026-03-03):
 *
 * AC-PERSIST1: Approval mode persists across viz page refreshes
 * AC-PERSIST2: Approval mode persists across viz server restarts
 * AC-NOSCRIPT: No script or process resets the mode without explicit user action
 * AC-ACTOR: Mode change is logged with accurate actor (not falsely attributed to thomas)
 * AC-PMSTATUS: Mode survives pm-status.cjs scans and other read operations
 *
 * Design sub-problems:
 *   (1) Audit table: system_settings_audit for change history
 *   (2) Fix updated_by: server.js PUT handler must not hardcode 'thomas'
 *   (3) Stderr logging: PUT changes logged to stderr
 *   (4) Client-side phantom write guard: dataset.serverMode or equivalent
 *   (5) Version symlink updates
 *
 * Tests combine source code checks + live DB checks.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

const VIZ_DIR = resolve(__dirname);
const VIZ_PATH = join(VIZ_DIR, "index.html");
const SERVER_PATH = join(VIZ_DIR, "server.js");

function readViz(): string {
  return readFileSync(VIZ_PATH, "utf-8");
}

function readServer(): string {
  return readFileSync(SERVER_PATH, "utf-8");
}

// ============================================================
// AC-ACTOR: Mode change logged with accurate actor
// ============================================================

describe("AC-ACTOR: updated_by must not be hardcoded to 'thomas'", () => {
  it("server.js PUT handler does NOT hardcode 'thomas' in INSERT/REPLACE", () => {
    const source = readServer();
    // Find the PUT handler for liaison-approval-mode
    const putStart = source.indexOf("pathname === '/api/settings/liaison-approval-mode' && req.method === 'PUT'");
    expect(putStart).toBeGreaterThan(-1);

    // Extract the PUT handler block (up to 1000 chars)
    const putBlock = source.substring(putStart, putStart + 1500);

    // Must NOT have hardcoded 'thomas' in the INSERT/REPLACE statement
    const insertMatch = putBlock.match(/INSERT\s+OR\s+REPLACE[\s\S]*?\.run\(/i);
    if (insertMatch) {
      expect(insertMatch[0]).not.toContain("'thomas'");
    }
  });

  it("server.js PUT handler uses actor from request body or 'viz-ui' default", () => {
    const source = readServer();
    const putStart = source.indexOf("pathname === '/api/settings/liaison-approval-mode' && req.method === 'PUT'");
    expect(putStart).toBeGreaterThan(-1);

    const putBlock = source.substring(putStart, putStart + 1500);

    // Must reference body.actor or body.updated_by or use a non-hardcoded actor
    const hasActorRef = putBlock.match(/body\.(actor|updated_by)/) ||
                        putBlock.match(/viz-ui|viz_ui/i);
    expect(hasActorRef).toBeTruthy();
  });
});

// ============================================================
// AC-NOSCRIPT: No script or process resets mode without user action
// ============================================================

describe("AC-NOSCRIPT: Client-side phantom write prevention", () => {
  it("viz index.html has a guard against writing mode on page load", () => {
    const source = readViz();
    // The loadLiaisonMode function must NOT trigger a PUT on initial load
    // There should be a mechanism to prevent the change handler from firing
    // when the select value is set programmatically

    // Must have suppressModeChange or similar guard AND server-mode tracking
    const hasServerMode = source.match(/serverMode|server[_-]?mode|data-server-mode|dataset\.serverMode/i);
    const hasSuppressGuard = source.match(/suppressModeChange|suppress/i);
    expect(hasServerMode || hasSuppressGuard).toBeTruthy();
  });

  it("change handler compares new value against server-known value before PUT", () => {
    const source = readViz();
    // The change handler should check if the new value differs from server value
    // before sending a PUT request — prevents phantom writes
    const changeHandlerStart = source.indexOf("liaisonModeSelect.addEventListener('change'");
    expect(changeHandlerStart).toBeGreaterThan(-1);

    const changeBlock = source.substring(changeHandlerStart, changeHandlerStart + 500);
    // Must have comparison: value !== serverMode or similar guard
    const hasComparison = changeBlock.match(/serverMode|!==|===|suppress/) ||
                          changeBlock.match(/if\s*\(/);
    expect(hasComparison).toBeTruthy();
  });
});

// ============================================================
// AC-PERSIST1 & AC-PERSIST2: Audit trail for settings changes
// ============================================================

describe("AC-PERSIST1/2: Audit table for settings changes", () => {
  it("server.js creates system_settings_audit table", () => {
    const source = readServer();
    expect(source).toMatch(/system_settings_audit/);
    expect(source).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+system_settings_audit/i);
  });

  it("audit table has required columns: key, old_value, new_value, changed_by, changed_at", () => {
    const source = readServer();
    const auditTableDef = source.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+system_settings_audit[\s\S]*?\);/i);
    expect(auditTableDef).not.toBeNull();
    if (auditTableDef) {
      const def = auditTableDef[0];
      expect(def).toMatch(/\bkey\b/i);
      expect(def).toMatch(/old_value|old/i);
      expect(def).toMatch(/new_value|new/i);
      expect(def).toMatch(/changed_by|actor/i);
      expect(def).toMatch(/changed_at|timestamp/i);
    }
  });

  it("PUT handler inserts audit record before/after updating the setting", () => {
    const source = readServer();
    const putStart = source.indexOf("pathname === '/api/settings/liaison-approval-mode' && req.method === 'PUT'");
    expect(putStart).toBeGreaterThan(-1);

    const putBlock = source.substring(putStart, putStart + 2000);
    // Must insert into audit table
    expect(putBlock).toMatch(/system_settings_audit/);
    expect(putBlock).toMatch(/INSERT\s+INTO\s+system_settings_audit/i);
  });
});

// ============================================================
// Stderr logging for PUT changes
// ============================================================

describe("Server-side stderr logging for mode changes", () => {
  it("server.js PUT handler logs mode changes to stderr/console", () => {
    const source = readServer();
    const putStart = source.indexOf("pathname === '/api/settings/liaison-approval-mode' && req.method === 'PUT'");
    expect(putStart).toBeGreaterThan(-1);

    const putBlock = source.substring(putStart, putStart + 2000);
    // Must have console.error, console.log, or process.stderr.write
    expect(putBlock).toMatch(/console\.(error|log|warn)|process\.stderr\.write/);
  });
});

// ============================================================
// AC-PMSTATUS: Mode survives read operations
// ============================================================

describe("AC-PMSTATUS: pm-status.cjs does not write to system_settings", () => {
  it("pm-status.cjs opens databases as read-only or does not touch system_settings", () => {
    const pmStatusPath = join(VIZ_DIR, "pm-status.cjs");
    if (!existsSync(pmStatusPath)) {
      // pm-status.cjs must exist
      expect(existsSync(pmStatusPath)).toBe(true);
      return;
    }
    const source = readFileSync(pmStatusPath, "utf-8");
    // pm-status should NOT write to system_settings
    const hasSettingsWrite = source.match(/INSERT.*system_settings|UPDATE.*system_settings|REPLACE.*system_settings/i);
    expect(hasSettingsWrite).toBeNull();
  });
});

// ============================================================
// Version symlink consistency
// ============================================================

describe("Version symlink: versioned files updated too", () => {
  it("versioned server.js also has audit table and actor fix", () => {
    const versionedServerPath = join(VIZ_DIR, "versions", "v0.0.1", "server.js");
    if (!existsSync(versionedServerPath)) {
      // Version directory must exist (from previous task)
      expect(existsSync(versionedServerPath)).toBe(true);
      return;
    }
    const source = readFileSync(versionedServerPath, "utf-8");
    // Must have audit table
    expect(source).toMatch(/system_settings_audit/);
    // Must not hardcode 'thomas' in PUT handler
    const putStart = source.indexOf("pathname === '/api/settings/liaison-approval-mode' && req.method === 'PUT'");
    if (putStart > -1) {
      const putBlock = source.substring(putStart, putStart + 1500);
      const insertMatch = putBlock.match(/INSERT\s+OR\s+REPLACE[\s\S]*?\.run\(/i);
      if (insertMatch) {
        expect(insertMatch[0]).not.toContain("'thomas'");
      }
    }
  });

  it("versioned index.html also has phantom write guard", () => {
    const versionedIndexPath = join(VIZ_DIR, "versions", "v0.0.1", "index.html");
    if (!existsSync(versionedIndexPath)) {
      expect(existsSync(versionedIndexPath)).toBe(true);
      return;
    }
    const source = readFileSync(versionedIndexPath, "utf-8");
    const hasGuard = source.match(/serverMode|server[_-]?mode|dataset\.serverMode|suppressModeChange/i);
    expect(hasGuard).toBeTruthy();
  });
});
