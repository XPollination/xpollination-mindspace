/**
 * Gardener Qdrant Backup Tests (gardener-qdrant-backup task)
 *
 * Tests that backup infrastructure exists for Qdrant before gardening mutations.
 *
 * Acceptance criteria:
 * AC1: Qdrant data backed up to NAS using existing versioned backup strategy
 * AC2: Multiple backup versions retained (GFS 7d+4w+12m)
 * AC3: Backup verified restorable
 * AC4: Documented as part of gardener operational runbook
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(__dirname, "../../..");
const BACKUP_SCRIPT = resolve(PROJECT_ROOT, "scripts/qdrant-backup.sh");
const GARDENER_SKILL = resolve(
  PROJECT_ROOT,
  ".claude/skills/xpo.claude.mindspace.garden/SKILL.md"
);
const RUNBOOK = resolve(
  PROJECT_ROOT,
  "tracks/brain-infrastructure/gardener/2026-02-27-brain-quality-lifecycle/RUNBOOK.md"
);

// --- AC1: Backup script exists with correct strategy ---

describe("AC1: Backup script", () => {
  it("qdrant-backup.sh exists", () => {
    expect(existsSync(BACKUP_SCRIPT)).toBe(true);
  });

  it("uses Qdrant snapshot API", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8").toLowerCase();
    expect(content).toMatch(/snapshot|qdrant.*6333|api.*snapshot/);
  });

  it("uses tar over SSH (not rsync — rsync fails on Synology)", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8").toLowerCase();
    expect(content).toMatch(/tar.*ssh|ssh.*tar/);
    // Should NOT use rsync as primary transfer
    const lines = content.split("\n").filter((l) => !l.trim().startsWith("#"));
    const hasRsyncCommand = lines.some((l) => l.match(/^\s*rsync\s/));
    expect(hasRsyncCommand).toBe(false);
  });

  it("backs up to NAS under /volume1/backups/hetzner/brain/", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8");
    expect(content).toMatch(/\/volume1\/backups\/hetzner\/brain/);
  });

  it("uses synology-backup SSH alias or equivalent", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8").toLowerCase();
    expect(content).toMatch(/synology.?backup|homeassistant@|synology/);
  });
});

// --- AC2: GFS rotation (7 daily + 4 weekly + 12 monthly) ---

describe("AC2: GFS versioned backup rotation", () => {
  it("implements daily rotation", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8").toLowerCase();
    expect(content).toMatch(/daily|7.*day/);
  });

  it("implements weekly rotation", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8").toLowerCase();
    expect(content).toMatch(/weekly|4.*week/);
  });

  it("implements monthly rotation", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8").toLowerCase();
    expect(content).toMatch(/monthly|12.*month/);
  });

  it("uses hardlinks (cp -al) for space-efficient snapshots", () => {
    const content = readFileSync(BACKUP_SCRIPT, "utf-8");
    expect(content).toMatch(/cp\s+-al|hardlink/i);
  });
});

// --- AC3: Backup verified restorable ---

describe("AC3: Restore verification", () => {
  it("runbook documents restore procedure", () => {
    expect(existsSync(RUNBOOK)).toBe(true);
    const content = readFileSync(RUNBOOK, "utf-8").toLowerCase();
    expect(content).toMatch(/restore/);
  });

  it("restore uses cat over SSH (scp fails on Synology)", () => {
    const content = readFileSync(RUNBOOK, "utf-8").toLowerCase();
    expect(content).toMatch(/cat.*ssh|ssh.*cat/);
  });
});

// --- AC4: Documented in gardener operational runbook ---

describe("AC4: Operational runbook", () => {
  it("RUNBOOK.md exists", () => {
    expect(existsSync(RUNBOOK)).toBe(true);
  });

  it("runbook documents backup procedure", () => {
    const content = readFileSync(RUNBOOK, "utf-8").toLowerCase();
    expect(content).toMatch(/backup/);
  });

  it("runbook documents listing available backups", () => {
    const content = readFileSync(RUNBOOK, "utf-8").toLowerCase();
    expect(content).toMatch(/list|available|version/);
  });
});

// --- Gardener integration: Step 0.5 pre-flight backup ---

describe("Gardener Step 0.5: Pre-flight backup for deep", () => {
  it("gardener skill has pre-flight backup step", () => {
    const content = readFileSync(GARDENER_SKILL, "utf-8").toLowerCase();
    expect(content).toMatch(/step.*0\.5|pre.?flight|backup.*deep/);
  });

  it("pre-flight only runs for depth=deep", () => {
    const content = readFileSync(GARDENER_SKILL, "utf-8").toLowerCase();
    expect(content).toMatch(/deep.*backup|backup.*deep|depth.*deep/);
  });

  it("gardener aborts if backup fails", () => {
    const content = readFileSync(GARDENER_SKILL, "utf-8").toLowerCase();
    expect(content).toMatch(/abort|fail.*stop|backup.*fail|exit/);
  });
});
