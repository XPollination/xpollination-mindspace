/**
 * TDD tests for approval-answer-logging
 *
 * Hard gate: log human approval answer in DNA transition log.
 * When LIAISON executes requiresHumanConfirm transitions, DNA must contain:
 * - human_answer: exact text of human decision
 * - human_answer_at: ISO timestamp
 * - approval_mode: auto|semi|auto-approval|manual
 *
 * Acceptance Criteria:
 * AC-GATE1: LIAISON transition without human_answer → error
 * AC-GATE2: LIAISON transition without human_answer_at → error
 * AC-GATE3: LIAISON transition without approval_mode → error
 * AC-GATE4: Invalid approval_mode → error
 * AC-GATE5: LIAISON transition with all 3 fields → succeeds
 * AC-GATE6: Non-liaison actors NOT affected by this gate
 * AC-GATE7: Fields persist in DNA after transition (audit trail, not cleared)
 * AC-GATE8: All 5 requiresHumanConfirm transitions covered
 * AC-WF1: WORKFLOW.md v0.0.19 exists documenting this gate
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const CLI = path.resolve(__dirname, 'interface-cli.js');
const TEST_DB = '/tmp/test-approval-answer-logging.db';
const SCHEMA = path.resolve(__dirname, '../../data/xpollination.db');
const WF_DIR = path.resolve(__dirname, '../../tracks/process/context/workflow');

function cli(args: string): string {
  try {
    return execSync(`DATABASE_PATH=${TEST_DB} node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch (e: any) {
    return e.stderr || e.stdout || e.message;
  }
}

function createTestDb(): void {
  // Copy production DB structure
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = new Database(TEST_DB);
  db.pragma('journal_mode = WAL');

  // Create mindspace_nodes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mindspace_nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'task',
      status TEXT NOT NULL DEFAULT 'pending',
      parent_ids TEXT DEFAULT '[]',
      slug TEXT UNIQUE,
      dna_json TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      change_seq INTEGER DEFAULT 0
    )
  `);

  // Create system_settings for approval mode
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.close();
}

function insertTask(slug: string, status: string, role: string, extraDna: Record<string, any> = {}): void {
  const db = new Database(TEST_DB);
  const dna = JSON.stringify({ title: `Test ${slug}`, role, ...extraDna });
  db.prepare(
    'INSERT INTO mindspace_nodes (id, type, status, slug, dna_json) VALUES (?, ?, ?, ?, ?)'
  ).run(`id-${slug}`, 'task', status, slug, dna);
  db.close();
}

function setApprovalMode(mode: string): void {
  const db = new Database(TEST_DB);
  db.prepare(
    "INSERT OR REPLACE INTO system_settings (key, value, updated_by) VALUES ('liaison_approval_mode', ?, 'test')"
  ).run(mode);
  db.close();
}

function getDna(slug: string): Record<string, any> {
  const output = cli(`get ${slug}`);
  try {
    const parsed = JSON.parse(output);
    return parsed.dna || {};
  } catch {
    return {};
  }
}

describe('approval-answer-logging: human answer audit trail gate', () => {

  beforeEach(() => {
    createTestDb();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  // === AC-GATE1: Missing human_answer ===

  describe('AC-GATE1: LIAISON transition without human_answer → error', () => {
    it('approval→approved without human_answer should fail', () => {
      setApprovalMode('semi');
      insertTask('gate1-test', 'approval', 'liaison', {
        human_answer_at: '2026-03-12T15:00:00Z',
        approval_mode: 'semi',
      });
      const result = cli('transition gate1-test approved liaison');
      expect(result).toMatch(/human_answer/i);
    });
  });

  // === AC-GATE2: Missing human_answer_at ===

  describe('AC-GATE2: LIAISON transition without human_answer_at → error', () => {
    it('approval→approved without human_answer_at should fail', () => {
      setApprovalMode('semi');
      insertTask('gate2-test', 'approval', 'liaison', {
        human_answer: 'Approve',
        approval_mode: 'semi',
      });
      const result = cli('transition gate2-test approved liaison');
      expect(result).toMatch(/human_answer_at/i);
    });
  });

  // === AC-GATE3: Missing approval_mode ===

  describe('AC-GATE3: LIAISON transition without approval_mode → error', () => {
    it('approval→approved without approval_mode should fail', () => {
      setApprovalMode('semi');
      insertTask('gate3-test', 'approval', 'liaison', {
        human_answer: 'Approve',
        human_answer_at: '2026-03-12T15:00:00Z',
      });
      const result = cli('transition gate3-test approved liaison');
      expect(result).toMatch(/approval_mode/i);
    });
  });

  // === AC-GATE4: Invalid approval_mode ===

  describe('AC-GATE4: Invalid approval_mode → error', () => {
    it('approval_mode="invalid" should be rejected', () => {
      setApprovalMode('semi');
      insertTask('gate4-test', 'approval', 'liaison', {
        human_answer: 'Approve',
        human_answer_at: '2026-03-12T15:00:00Z',
        approval_mode: 'invalid',
      });
      const result = cli('transition gate4-test approved liaison');
      expect(result).toMatch(/approval_mode|invalid/i);
    });
  });

  // === AC-GATE5: All fields present → succeeds ===

  describe('AC-GATE5: LIAISON transition with all 3 fields → succeeds', () => {
    it('approval→approved with human_answer, human_answer_at, approval_mode should succeed', () => {
      setApprovalMode('semi');
      insertTask('gate5-test', 'approval', 'liaison', {
        human_answer: 'Approve (Recommended)',
        human_answer_at: '2026-03-12T15:00:00Z',
        approval_mode: 'semi',
      });
      const result = cli('transition gate5-test approved liaison');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transition).toBe('approval->approved');
    });

    it('should work with auto mode and AUTO-APPROVE prefix', () => {
      setApprovalMode('auto');
      insertTask('gate5-auto', 'approval', 'liaison', {
        human_answer: 'AUTO-APPROVE: Design is solid',
        human_answer_at: '2026-03-12T15:00:00Z',
        approval_mode: 'auto',
      });
      const result = cli('transition gate5-auto approved liaison');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('should work with manual mode', () => {
      setApprovalMode('manual');
      insertTask('gate5-manual', 'approval', 'liaison', {
        human_answer: 'Approved via viz',
        human_answer_at: '2026-03-12T15:00:00Z',
        approval_mode: 'manual',
        human_confirmed: true,
        human_confirmed_via: 'viz',
      });
      const result = cli('transition gate5-manual approved liaison');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('should work with auto-approval mode', () => {
      setApprovalMode('auto-approval');
      insertTask('gate5-autoappr', 'approval', 'liaison', {
        human_answer: 'Approve recommended',
        human_answer_at: '2026-03-12T15:00:00Z',
        approval_mode: 'auto-approval',
      });
      const result = cli('transition gate5-autoappr approved liaison');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  // === AC-GATE6: Non-liaison actors NOT affected ===

  describe('AC-GATE6: Non-liaison actors NOT affected', () => {
    it('QA transition should not require human_answer fields', () => {
      insertTask('gate6-qa', 'review', 'qa');
      // QA does review→review (forward to pdsa) — no human_answer needed
      const result = cli('transition gate6-qa review qa');
      // Should succeed without human_answer fields
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('DEV transition should not require human_answer fields', () => {
      insertTask('gate6-dev', 'active', 'dev');
      const result = cli('transition gate6-dev review dev');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  // === AC-GATE7: Fields persist after transition ===

  describe('AC-GATE7: Fields persist in DNA after transition (audit trail)', () => {
    it('human_answer, human_answer_at, approval_mode should remain in DNA after transition', () => {
      setApprovalMode('semi');
      insertTask('gate7-persist', 'approval', 'liaison', {
        human_answer: 'Approve (Recommended)',
        human_answer_at: '2026-03-12T15:00:00Z',
        approval_mode: 'semi',
      });
      cli('transition gate7-persist approved liaison');
      const dna = getDna('gate7-persist');
      expect(dna.human_answer).toBe('Approve (Recommended)');
      expect(dna.human_answer_at).toBe('2026-03-12T15:00:00Z');
      expect(dna.approval_mode).toBe('semi');
    });
  });

  // === AC-GATE8: All 5 transitions covered ===

  describe('AC-GATE8: All requiresHumanConfirm transitions enforce the gate', () => {
    it('source code should check human_answer for requiresHumanConfirm transitions', () => {
      const cliSrc = fs.readFileSync(CLI, 'utf-8');
      // Should have validation for human_answer in the requiresHumanConfirm block
      expect(cliSrc).toMatch(/human_answer/);
      expect(cliSrc).toMatch(/human_answer_at/);
      expect(cliSrc).toMatch(/approval_mode/);
    });

    it('human_answer gate should be inside requiresHumanConfirm block', () => {
      const cliSrc = fs.readFileSync(CLI, 'utf-8');
      // The human_answer check should be near the requiresHumanConfirm check
      const confirmIdx = cliSrc.indexOf('requiresHumanConfirm');
      const answerIdx = cliSrc.indexOf('human_answer', confirmIdx);
      // human_answer should appear after requiresHumanConfirm (within ~2000 chars)
      expect(answerIdx).toBeGreaterThan(confirmIdx);
      expect(answerIdx - confirmIdx).toBeLessThan(2000);
    });

    it('approval_mode validation should check valid enum values', () => {
      const cliSrc = fs.readFileSync(CLI, 'utf-8');
      // Should validate against auto, semi, auto-approval, manual
      const hasEnumCheck =
        /auto.*semi.*auto-approval.*manual|includes.*approval_mode|auto.*semi.*manual/s.test(cliSrc);
      expect(hasEnumCheck).toBe(true);
    });
  });

  // === AC-WF1: WORKFLOW v0.0.19 ===

  describe('AC-WF1: WORKFLOW.md v0.0.19 exists', () => {
    it('v0.0.19 directory should exist in tracks/process/context/workflow/', () => {
      const v19 = path.join(WF_DIR, 'v0.0.19');
      expect(fs.existsSync(v19)).toBe(true);
    });

    it('WORKFLOW.md in v0.0.19 should document human_answer gate', () => {
      const wfPath = path.join(WF_DIR, 'v0.0.19', 'WORKFLOW.md');
      if (!fs.existsSync(wfPath)) {
        expect(fs.existsSync(wfPath)).toBe(true);
        return;
      }
      const wf = fs.readFileSync(wfPath, 'utf-8');
      expect(wf).toMatch(/human_answer/);
      expect(wf).toMatch(/human_answer_at/);
      expect(wf).toMatch(/approval_mode/);
    });
  });
});
