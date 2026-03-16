import { describe, it, expect } from 'vitest';

/**
 * Auth Branch Merge + Deploy Validation — ms-auth-branch-merge-deploy
 * Post-deployment checks: auth code on develop, Docker DEV running with auth.
 * These tests validate the deployment state, not the code (code is tested in ms-auth-e2e).
 */

const DEV_URL = 'http://10.33.33.1:4201';
const API_URL = 'http://10.33.33.1:3101';

describe('Auth deployment validation', () => {

  it('DEV viz server (4201) is reachable', async () => {
    try {
      const res = await fetch(`${DEV_URL}/login`);
      expect(res.status).toBe(200);
    } catch {
      // Server not running — expected to fail until deployment
      expect(true).toBe(false); // Force fail with clear message
    }
  });

  it('DEV viz serves login page (not raw data)', async () => {
    try {
      const res = await fetch(`${DEV_URL}/login`);
      const text = await res.text();
      expect(text).toMatch(/<html|<!DOCTYPE/i);
      expect(text).toMatch(/login|password|email/i);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('DEV API (3101) health check passes', async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      expect(res.status).toBe(200);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('DEV API auth endpoint exists', async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test', password: 'test' })
      });
      // Should return 400 or 401, NOT 404
      expect([400, 401]).toContain(res.status);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('DEV API blocks unauthenticated data access', async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`);
      expect(res.status).toBe(401);
    } catch {
      expect(true).toBe(false);
    }
  });
});
