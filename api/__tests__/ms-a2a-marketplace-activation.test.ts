import { describe, it, expect } from 'vitest';

/**
 * A2A Protocol + Marketplace Activation Tests — ms-a2a-marketplace-activation
 * Smoke tests against the live PROD API.
 */

const API_URL = 'http://10.33.33.1:3100';

describe('A2A endpoints smoke test', () => {

  it('/.well-known/agent.json returns agent card', async () => {
    try {
      const res = await fetch(`${API_URL}/.well-known/agent.json`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('name');
    } catch {
      expect(true).toBe(false);
    }
  });

  it('/a2a/connect is reachable', async () => {
    try {
      const res = await fetch(`${API_URL}/a2a/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      // Should return something (not 404)
      expect(res.status).not.toBe(404);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('/a2a/message is reachable', async () => {
    try {
      const res = await fetch(`${API_URL}/a2a/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      expect(res.status).not.toBe(404);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('/schemas/digital-twin-v1.json returns schema', async () => {
    try {
      const res = await fetch(`${API_URL}/schemas/digital-twin-v1.json`);
      expect(res.status).toBe(200);
    } catch {
      expect(true).toBe(false);
    }
  });
});

describe('Marketplace endpoints smoke test', () => {

  it('/api/marketplace/announcements is reachable (requires auth)', async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/announcements`);
      expect(res.status).toBe(401); // Auth required = endpoint exists
    } catch {
      expect(true).toBe(false);
    }
  });

  it('/api/marketplace/requests is reachable (requires auth)', async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/requests`);
      expect(res.status).toBe(401);
    } catch {
      expect(true).toBe(false);
    }
  });
});
