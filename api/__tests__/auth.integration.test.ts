import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

let app: Express;
let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;
});

afterAll(() => {
  teardownTestDb();
});

// --- Registration ---
describe('Registration', () => {
  it('returns 201 for valid registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', name: 'Test User', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.name).toBe('Test User');
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-pass@example.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', name: 'Bad', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', name: 'Short', password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', name: 'Dupe', password: 'password123' });
    expect(res.status).toBe(409);
  });
});

// --- Login ---
describe('Login', () => {
  it('returns 200 with token for valid login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('returns 401 for wrong password (invalid credentials)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });
});

// --- JWT validation ---
describe('JWT validation', () => {
  let validToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    validToken = res.body.token;
  });

  it('accepts valid Bearer Authorization token on protected route', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('id');
  });

  it('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer invalid-token-here');
    expect(res.status).toBe(401);
  });

  it('rejects request with missing token (no Authorization header)', async () => {
    const res = await request(app)
      .get('/api/protected');
    expect(res.status).toBe(401);
  });

  it('rejects expired token', async () => {
    const expiredToken = jwt.sign(
      { sub: 'test-id', email: 'test@example.com', name: 'Test' },
      'test-jwt-secret-for-integration-tests',
      { expiresIn: '0s' }
    );
    // Small delay to ensure token is expired
    await new Promise(r => setTimeout(r, 100));
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

// --- API key lifecycle ---
describe('API key lifecycle', () => {
  let userId: string;
  let apiKeyRaw: string;
  let apiKeyId: string;

  beforeAll(async () => {
    // Register a user to get an ID
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'apikey-user@example.com', name: 'API User', password: 'password123' });
    userId = res.body.id;
  });

  it('generates a new API key', async () => {
    const res = await request(app)
      .post('/api/keys')
      .send({ user_id: userId, name: 'Test Key' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('key');
    expect(res.body.key).toMatch(/^xpo_/);
    apiKeyRaw = res.body.key;
    apiKeyId = res.body.id;
  });

  it('lists keys for a user', async () => {
    const res = await request(app)
      .get('/api/keys')
      .query({ user_id: userId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('authenticates with valid X-API-Key on protected-combined route', async () => {
    const res = await request(app)
      .get('/api/protected-combined')
      .set('X-API-Key', apiKeyRaw);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('id');
  });

  it('rejects invalid API key', async () => {
    const res = await request(app)
      .get('/api/protected-combined')
      .set('X-API-Key', 'xpo_invalidkey');
    expect(res.status).toBe(401);
  });

  it('revokes (soft-delete) an API key', async () => {
    const res = await request(app)
      .delete(`/api/keys/${apiKeyId}`);
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
  });

  it('rejects revoked API key', async () => {
    const res = await request(app)
      .get('/api/protected-combined')
      .set('X-API-Key', apiKeyRaw);
    expect(res.status).toBe(401);
  });
});

// --- Combined middleware ---
describe('Combined middleware (API key bypasses JWT)', () => {
  it('API key bypasses JWT — X-API-Key works without Bearer token', async () => {
    // Create a fresh key for this test
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'combined@example.com', name: 'Combined', password: 'password123' });
    const keyRes = await request(app)
      .post('/api/keys')
      .send({ user_id: regRes.body.id });
    const res = await request(app)
      .get('/api/protected-combined')
      .set('X-API-Key', keyRes.body.key);
    expect(res.status).toBe(200);
  });

  it('returns 401 when both API key and JWT are missing', async () => {
    const res = await request(app)
      .get('/api/protected-combined');
    expect(res.status).toBe(401);
  });
});

// --- Token expiry ---
describe('Token expiry', () => {
  it('near-expiry token still works', async () => {
    const token = jwt.sign(
      { sub: 'test-id', email: 'test@example.com', name: 'Test' },
      'test-jwt-secret-for-integration-tests',
      { expiresIn: '10s' }
    );
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('expired token is rejected', async () => {
    const token = jwt.sign(
      { sub: 'test-id', email: 'test@example.com', name: 'Test' },
      'test-jwt-secret-for-integration-tests',
      { expiresIn: '0s' }
    );
    await new Promise(r => setTimeout(r, 100));
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
