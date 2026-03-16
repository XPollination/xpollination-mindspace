import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Admin Password Reset CLI Tests — ms-auth-admin-password-reset
 * Tests for: node api/scripts/reset-password.js <email> <new-password>
 * CLI only (no API endpoint). Bcrypt 12 rounds.
 */

const SCRIPT_PATH = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/api/scripts/reset-password.js');
let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;

  // Create test user
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash('OldPassword123', 12);
  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    'reset-test-user', 'reset@example.com', hash, 'Reset User'
  );
});

afterAll(() => {
  teardownTestDb();
});

// ==========================================================================
// Script existence and structure
// ==========================================================================

describe('Reset password script exists', () => {

  it('api/scripts/reset-password.js file exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('script uses bcrypt for hashing', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toMatch(/bcrypt/i);
    }
  });

  it('script validates email argument exists', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      // Should check for email/argv arguments
      expect(content).toMatch(/argv|args|email/i);
    }
  });

  it('script checks that user email exists in database', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      // Should query users table
      expect(content).toMatch(/SELECT|users|email/i);
    }
  });

  it('script does NOT expose an API endpoint', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      // Should NOT have express/router/app.post patterns
      expect(content).not.toMatch(/Router\(\)|app\.post|app\.get/);
    }
  });
});

// ==========================================================================
// No API endpoint for password reset (security)
// ==========================================================================

describe('No API endpoint for password reset', () => {

  it('POST /api/auth/reset-password does not exist (404)', async () => {
    // Import supertest and app for this check
    const request = await import('supertest');
    const { createTestApp: getApp } = await import('../test-helpers/setup.js');
    const { app } = await getApp();

    const res = await request.default(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', new_password: 'NewPass123' });
    expect(res.status).toBe(404);
  });
});
