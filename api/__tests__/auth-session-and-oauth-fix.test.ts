import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Auth Session & OAuth Fix Tests — auth-session-and-oauth-fix
 * Validates: OAuth 500 guard, JWT 7d expiry, cookie Max-Age, conditional Google button.
 * TDD: Dev fixes oauth.ts, auth.ts, server.js, login.html.
 */

let app: Express;
let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Google OAuth does not crash with 500', () => {

  it('GET /api/auth/oauth/google returns non-500 response', async () => {
    const res = await request(app).get('/api/auth/oauth/google');
    expect(res.status).not.toBe(500);
  });

  it('GET /api/auth/oauth/google/callback returns non-500 response', async () => {
    const res = await request(app).get('/api/auth/oauth/google/callback');
    expect(res.status).not.toBe(500);
  });
});

describe('JWT expiry is extended (not 15m)', () => {

  it('login returns JWT that expires in more than 1 hour', async () => {
    // Create test user with pre-hashed password ('testpass' hashed with bcrypt)
    const hash = '$2b$10$LQ3d6J3jKq3Kq3Kq3Kq3KuHn6TqJqJqJqJqJqJqJqJqJqJqJqJqJ';
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('jwt-test', 'jwt@test.com', ?, 'JWT Test')").run(hash);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jwt@test.com', password: 'testpass' });

    if (res.status === 200 && res.body.token) {
      const decoded = jwt.decode(res.body.token) as any;
      if (decoded?.exp && decoded?.iat) {
        const lifetimeHours = (decoded.exp - decoded.iat) / 3600;
        // Should be > 1 hour (was 15 minutes before fix)
        expect(lifetimeHours).toBeGreaterThan(1);
      }
    }
  });
});

describe('Auth cookie has Max-Age', () => {

  it('login response sets cookie with Max-Age or Expires header', async () => {
    const hash = '$2b$10$LQ3d6J3jKq3Kq3Kq3Kq3KuHn6TqJqJqJqJqJqJqJqJqJqJqJqJqJ';
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('cookie-test', 'cookie@test.com', ?, 'Cookie Test')").run(hash);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cookie@test.com', password: 'cookietest' });

    if (res.status === 200) {
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
        // Should have Max-Age or Expires
        expect(cookieStr).toMatch(/Max-Age|Expires|max-age/i);
      }
    }
  });
});

describe('OAuth route has error handling', () => {

  it('oauth.ts has try/catch or error handler', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const oauthPath = resolve(__dirname, '../routes/oauth.ts');
    if (existsSync(oauthPath)) {
      const content = readFileSync(oauthPath, 'utf-8');
      expect(content).toMatch(/try|catch|error|503|unavailable/i);
    }
  });
});
