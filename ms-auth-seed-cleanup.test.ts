/**
 * TDD tests for ms-auth-seed-cleanup v0.0.2
 *
 * Seed Cleanup — admin bootstrap with password & invites.
 *
 * AC-1: Seed array contains ONLY Thomas Pichler
 * AC-2: Test users deleted via DELETE statement
 * AC-3: Thomas has is_system_admin=1 and invite_quota=999
 * AC-4: Password hash from ADMIN_PASSWORD env var, bcrypt 12 rounds
 * AC-5: COALESCE update handles existing rows
 * AC-6: Seed is idempotent (INSERT OR IGNORE)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '.');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

const SEED_PATH = path.join(PROJECT_ROOT, 'api/db/seed.ts');

// ─── AC-1: Seed array contains ONLY Thomas ───

describe('AC-1: Seed array contains only Thomas', () => {
  it('should have thomas.pichler@xpollination.earth in seed', () => {
    const content = readFile(SEED_PATH);
    expect(content).toContain('thomas.pichler@xpollination.earth');
  });

  it('should NOT have robin in seed array', () => {
    const content = readFile(SEED_PATH);
    // Find the users array — robin should not be in it
    const usersSection = content.split('const users')[1]?.split('];')[0] || '';
    expect(usersSection).not.toContain('robin@');
  });

  it('should NOT have maria in seed array', () => {
    const content = readFile(SEED_PATH);
    const usersSection = content.split('const users')[1]?.split('];')[0] || '';
    expect(usersSection).not.toContain('maria@');
  });
});

// ─── AC-2: Test users deleted ───

describe('AC-2: Test users deleted via DELETE', () => {
  it('should have DELETE FROM users for test emails', () => {
    const content = readFile(SEED_PATH);
    expect(content).toMatch(/DELETE.*FROM.*users/i);
    expect(content).toContain('robin@xpollination.dev');
    expect(content).toContain('maria@xpollination.dev');
    expect(content).toContain('test@xpollination.dev');
  });
});

// ─── AC-3: Thomas is system admin with unlimited invites ───

describe('AC-3: Thomas has is_system_admin=1 and invite_quota=999', () => {
  it('should set is_system_admin=1', () => {
    const content = readFile(SEED_PATH);
    expect(content).toContain('is_system_admin');
    // Should have value 1 in INSERT
    expect(content).toMatch(/is_system_admin.*1|1.*is_system_admin/);
  });

  it('should set invite_quota=999', () => {
    const content = readFile(SEED_PATH);
    expect(content).toContain('invite_quota');
    expect(content).toContain('999');
  });
});

// ─── AC-4: Password hash from env var ───

describe('AC-4: Password hash from ADMIN_PASSWORD env var', () => {
  it('should read ADMIN_PASSWORD from environment', () => {
    const content = readFile(SEED_PATH);
    expect(content).toContain('ADMIN_PASSWORD');
    expect(content).toMatch(/process\.env\.ADMIN_PASSWORD|process\.env\[['"]ADMIN_PASSWORD/);
  });

  it('should use bcrypt with cost 12', () => {
    const content = readFile(SEED_PATH);
    expect(content).toMatch(/bcrypt/);
    expect(content).toContain('12');
  });
});

// ─── AC-5: COALESCE update for existing rows ───

describe('AC-5: COALESCE update handles existing rows', () => {
  it('should have COALESCE or conditional update for password_hash', () => {
    const content = readFile(SEED_PATH);
    expect(content).toMatch(/COALESCE|coalesce/);
  });

  it('should update existing Thomas row if password_hash is missing', () => {
    const content = readFile(SEED_PATH);
    expect(content).toMatch(/UPDATE.*users.*password_hash/is);
  });
});

// ─── AC-6: Seed is idempotent ───

describe('AC-6: Seed is idempotent', () => {
  it('should use INSERT OR IGNORE for users', () => {
    const content = readFile(SEED_PATH);
    expect(content).toMatch(/INSERT OR IGNORE.*users/i);
  });
});
