import { describe, it, expect } from 'vitest';

/**
 * nginx + HTTPS Tests — ms-nginx-https-mindspace
 * Validates: mindspace.xpollination.earth resolves and serves HTTPS.
 */

const DOMAIN = 'mindspace.xpollination.earth';

describe('mindspace.xpollination.earth deployment', () => {

  it('HTTPS endpoint is reachable', async () => {
    try {
      const res = await fetch(`https://${DOMAIN}/`, { redirect: 'follow' });
      expect(res.status).toBe(200);
    } catch {
      // Domain not yet configured — expected to fail until deployment
      expect(true).toBe(false);
    }
  });

  it('HTTPS serves login page', async () => {
    try {
      const res = await fetch(`https://${DOMAIN}/login`);
      const text = await res.text();
      expect(text).toMatch(/login|password|mindspace/i);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('HTTP redirects to HTTPS', async () => {
    try {
      const res = await fetch(`http://${DOMAIN}/`, { redirect: 'manual' });
      expect([301, 302, 308]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toMatch(/^https:\/\//);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('API is accessible through reverse proxy', async () => {
    try {
      const res = await fetch(`https://${DOMAIN}/health`);
      expect(res.status).toBe(200);
    } catch {
      expect(true).toBe(false);
    }
  });
});
