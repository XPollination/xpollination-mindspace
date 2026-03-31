import { describe, it, expect } from 'vitest';
import { EnvSecretProvider } from './secret-provider.js';
import type { SecretProvider } from './secret-provider.js';

// ─── AC1: Runner can read ANTHROPIC_API_KEY from env ───

describe('EnvSecretProvider', () => {
  it('reads existing env var', async () => {
    const originalValue = process.env.TEST_SECRET_KEY;
    process.env.TEST_SECRET_KEY = 'sk-test-123';
    try {
      const provider: SecretProvider = new EnvSecretProvider();
      const value = await provider.getSecret('TEST_SECRET_KEY');
      expect(value).toBe('sk-test-123');
    } finally {
      if (originalValue !== undefined) {
        process.env.TEST_SECRET_KEY = originalValue;
      } else {
        delete process.env.TEST_SECRET_KEY;
      }
    }
  });

  it('throws for missing env var', async () => {
    delete process.env.NONEXISTENT_KEY_12345;
    const provider: SecretProvider = new EnvSecretProvider();
    await expect(provider.getSecret('NONEXISTENT_KEY_12345')).rejects.toThrow();
  });

  it('reads ANTHROPIC_API_KEY when set', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-value';
    try {
      const provider = new EnvSecretProvider();
      const value = await provider.getSecret('ANTHROPIC_API_KEY');
      expect(value).toBe('sk-ant-test-value');
    } finally {
      if (original !== undefined) {
        process.env.ANTHROPIC_API_KEY = original;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });
});

// ─── AC3: Key never appears in twin content or logs ───

describe('secret security', () => {
  it('getSecret returns the raw value (no logging)', async () => {
    process.env.SECRET_TEST = 'sensitive-value';
    try {
      const provider = new EnvSecretProvider();
      const value = await provider.getSecret('SECRET_TEST');
      // Value should be returned for use, but never logged
      expect(value).toBe('sensitive-value');
      // Provider should not have a toString that leaks the value
      expect(String(provider)).not.toContain('sensitive-value');
    } finally {
      delete process.env.SECRET_TEST;
    }
  });
});

// ─── AC4: SecretProvider interface allows swap ───

describe('SecretProvider interface', () => {
  it('EnvSecretProvider implements SecretProvider interface', () => {
    const provider: SecretProvider = new EnvSecretProvider();
    expect(typeof provider.getSecret).toBe('function');
  });
});

// ─── AC5: Missing key — runner does not start ───

describe('missing key detection', () => {
  it('throws descriptive error for missing required secret', async () => {
    delete process.env.REQUIRED_SECRET_MISSING;
    const provider = new EnvSecretProvider();
    try {
      await provider.getSecret('REQUIRED_SECRET_MISSING');
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('REQUIRED_SECRET_MISSING');
    }
  });
});
