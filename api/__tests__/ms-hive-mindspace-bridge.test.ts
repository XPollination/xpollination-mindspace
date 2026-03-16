import { describe, it, expect } from 'vitest';

/**
 * Hive-Mindspace Bridge Tests — ms-hive-mindspace-bridge
 * Validates: Hive onboarding shows Mindspace A2A endpoint.
 */

const HIVE_URL = 'https://hive.xpollination.earth';

describe('Hive onboarding includes Mindspace A2A', () => {

  it('Hive page mentions mindspace.xpollination.earth', async () => {
    try {
      const res = await fetch(HIVE_URL);
      const text = await res.text();
      expect(text).toMatch(/mindspace\.xpollination\.earth/);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('Hive page shows /a2a/connect endpoint', async () => {
    try {
      const res = await fetch(HIVE_URL);
      const text = await res.text();
      expect(text).toMatch(/a2a\/connect/);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('Hive page shows full onboarding flow', async () => {
    try {
      const res = await fetch(HIVE_URL);
      const text = await res.text();
      expect(text).toMatch(/brain|mindspace|connect/i);
    } catch {
      expect(true).toBe(false);
    }
  });
});
