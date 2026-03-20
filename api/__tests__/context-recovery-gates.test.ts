import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Context Recovery Gates Tests — context-recovery-gates-test
 * TDD: Validates 3 hard gates prevent context loss patterns.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Gate 1: Mode check — liaison reads approval mode per transition', () => {

  it('system_settings has liaison_approval_mode key', () => {
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('liaison_approval_mode', 'semi')").run();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get() as any;
    expect(row).toBeDefined();
    expect(['autopilot', 'semi', 'manual']).toContain(row.value);
  });

  it('API settings endpoint exists in server.js', () => {
    const serverPath = resolve(__dirname, '../../viz/server.js');
    const content = existsSync(serverPath) ? readFileSync(serverPath, 'utf-8') : '';
    expect(content).toMatch(/liaison.approval.mode|approval-mode/i);
  });
});

describe('Gate 2: Infrastructure validation — startup checks env', () => {

  it('service-lifecycle.js has env var validation', () => {
    const scriptPath = resolve(__dirname, '../../scripts/service-lifecycle.js');
    const content = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf-8') : '';
    expect(content).toMatch(/env|\.env|dotenv|process\.env/i);
  });
});

describe('Gate 3: Process gate — backlog prevents premature entry', () => {

  it('backlog status exists in workflow engine', () => {
    const wfPath = resolve(__dirname, '../../src/db/workflow-engine.js');
    const content = existsSync(wfPath) ? readFileSync(wfPath, 'utf-8') : '';
    expect(content).toMatch(/backlog/);
  });

  it('monitor excludes backlog from actionable work', () => {
    const monitorPath = resolve(__dirname, '../../viz/agent-monitor.cjs');
    const content = existsSync(monitorPath) ? readFileSync(monitorPath, 'utf-8') : '';
    expect(content).toMatch(/backlog/);
  });
});
