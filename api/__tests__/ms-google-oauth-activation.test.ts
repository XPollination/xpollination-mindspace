import { describe, it, expect } from 'vitest';

/**
 * Google OAuth Activation Tests — ms-google-oauth-activation
 * Validates: OAuth endpoint exists, redirects to Google, callback URL configured.
 */

const PROD_API = 'https://mindspace.xpollination.earth';
const DEV_API = 'http://10.33.33.1:3101';

describe('Google OAuth endpoint', () => {

  it('GET /api/auth/oauth/google initiates OAuth flow (redirect)', async () => {
    try {
      const res = await fetch(`${PROD_API}/api/auth/oauth/google`, { redirect: 'manual' });
      // Should redirect to Google's OAuth consent screen
      expect([301, 302, 303]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toMatch(/accounts\.google\.com|googleapis\.com/);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('OAuth callback URL is configured (returns error for invalid code, not 404)', async () => {
    try {
      const res = await fetch(`${PROD_API}/api/auth/oauth/google/callback?code=invalid&state=test`);
      // Should NOT be 404 (endpoint exists). May be 400/401/500 for invalid code.
      expect(res.status).not.toBe(404);
    } catch {
      expect(true).toBe(false);
    }
  });
});

describe('OAuth environment configuration', () => {

  it('DEV API oauth route exists', async () => {
    try {
      const res = await fetch(`${DEV_API}/api/auth/oauth/google`, { redirect: 'manual' });
      expect(res.status).not.toBe(404);
    } catch {
      expect(true).toBe(false);
    }
  });
});
