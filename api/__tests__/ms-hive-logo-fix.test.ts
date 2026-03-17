import { describe, it, expect } from 'vitest';

/**
 * Hive Logo Fix Tests — ms-hive-logo-fix
 * Validates: correct Mindspace logo, updated onboarding instructions.
 */

const HIVE_URL = 'https://hive.xpollination.earth';

describe('Hive page uses correct logo', () => {

  it('page does NOT reference xpollination-logo-256', async () => {
    try {
      const res = await fetch(HIVE_URL);
      const text = await res.text();
      expect(text).not.toMatch(/xpollination-logo-256/);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('page uses mindspace-logo (120 or similar)', async () => {
    try {
      const res = await fetch(HIVE_URL);
      const text = await res.text();
      expect(text).toMatch(/mindspace-logo/);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('onboarding mentions direct API port for A2A (not nginx)', async () => {
    try {
      const res = await fetch(HIVE_URL);
      const text = await res.text();
      // Should reference direct API port since nginx doesn't proxy A2A
      expect(text).toMatch(/3100|direct.*api|api.*port/i);
    } catch {
      expect(true).toBe(false);
    }
  });
});
