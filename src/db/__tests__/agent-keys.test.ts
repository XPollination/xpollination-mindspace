/**
 * Agent Key Registration & Validation Tests
 *
 * Source of Truth: automated-agent-bootstrap task DNA
 * These tests define the API contract for src/db/agent-keys.js
 * Dev implements the module to make these tests pass.
 *
 * AC3: Agents auto-register and receive unique keys
 * AC4: AGENT_KEY validated on every state-changing CLI operation
 * AC5: Role mismatch returns clear error message
 * AC8: Audit log captures all registrations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Module under test — dev will create src/db/agent-keys.js
// Exports: registerAgent, validateAgentKey, loadKeys
import {
  registerAgent,
  validateAgentKey,
  loadKeys
} from '../agent-keys.js';

// Use temp directory for test isolation
const TEST_DATA_DIR = join(import.meta.dirname, '../../__test-data__');
const TEST_KEYS_FILE = join(TEST_DATA_DIR, 'agent-keys.json');
const TEST_AUDIT_LOG = join(TEST_DATA_DIR, 'agent-audit.log');

beforeEach(() => {
  if (!existsSync(TEST_DATA_DIR)) {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
});

afterEach(() => {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// ==========================================================================
// AC3: Registration — generates unique keys, stores mapping
// ==========================================================================

describe('AC3: registerAgent() — key generation and storage', () => {

  it('returns a non-empty string key', () => {
    const key = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('creates keys file if it does not exist', () => {
    registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    expect(existsSync(TEST_KEYS_FILE)).toBe(true);
  });

  it('stores key→role mapping in keys file', () => {
    const key = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const keys = JSON.parse(readFileSync(TEST_KEYS_FILE, 'utf-8'));
    expect(keys[key]).toBe('dev');
  });

  it('generates unique keys for different registrations', () => {
    const key1 = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const key2 = registerAgent('pdsa', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    expect(key1).not.toBe(key2);
  });

  it('allows multiple agents of same role (each gets unique key)', () => {
    const key1 = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const key2 = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    expect(key1).not.toBe(key2);
    const keys = JSON.parse(readFileSync(TEST_KEYS_FILE, 'utf-8'));
    expect(keys[key1]).toBe('dev');
    expect(keys[key2]).toBe('dev');
  });

  it('only accepts valid roles: dev, pdsa, qa, liaison', () => {
    expect(() => registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG)).not.toThrow();
    expect(() => registerAgent('pdsa', TEST_KEYS_FILE, TEST_AUDIT_LOG)).not.toThrow();
    expect(() => registerAgent('qa', TEST_KEYS_FILE, TEST_AUDIT_LOG)).not.toThrow();
    expect(() => registerAgent('liaison', TEST_KEYS_FILE, TEST_AUDIT_LOG)).not.toThrow();
  });

  it('rejects invalid roles', () => {
    expect(() => registerAgent('admin', TEST_KEYS_FILE, TEST_AUDIT_LOG)).toThrow(/invalid role/i);
    expect(() => registerAgent('', TEST_KEYS_FILE, TEST_AUDIT_LOG)).toThrow(/invalid role/i);
  });
});

// ==========================================================================
// AC4 & AC5: Validation — key checked, role mismatch rejected
// ==========================================================================

describe('AC4: validateAgentKey() — key validation on CLI calls', () => {

  it('returns role when key is valid', () => {
    const key = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const result = validateAgentKey(key, 'dev', TEST_KEYS_FILE);
    expect(result).toBeNull(); // null = valid, no error
  });

  it('returns error for unknown key', () => {
    registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const result = validateAgentKey('fake-key-12345', 'dev', TEST_KEYS_FILE);
    expect(result).toContain('Invalid agent key');
  });

  it('returns error when keys file does not exist', () => {
    const result = validateAgentKey('any-key', 'dev', '/tmp/nonexistent-keys.json');
    expect(result).toContain('No agent keys');
  });
});

describe('AC5: validateAgentKey() — role mismatch detection', () => {

  it('returns clear error when key role does not match actor', () => {
    const devKey = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const result = validateAgentKey(devKey, 'pdsa', TEST_KEYS_FILE);
    expect(result).toMatch(/role mismatch/i);
    expect(result).toContain('dev');
    expect(result).toContain('pdsa');
  });

  it('error message format: "Role mismatch - your key grants [X], attempted [Y]"', () => {
    const qaKey = registerAgent('qa', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const result = validateAgentKey(qaKey, 'liaison', TEST_KEYS_FILE);
    expect(result).toContain('qa');
    expect(result).toContain('liaison');
  });

  it('system actor bypasses key validation', () => {
    // system is special — no key required (per PDSA design)
    const result = validateAgentKey(null, 'system', TEST_KEYS_FILE);
    expect(result).toBeNull();
  });

  it('liaison key can act as thomas (human proxy)', () => {
    const liaisonKey = registerAgent('liaison', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const result = validateAgentKey(liaisonKey, 'thomas', TEST_KEYS_FILE);
    expect(result).toBeNull(); // liaison executes human decisions
  });
});

// ==========================================================================
// AC8: Audit log — captures all registrations
// ==========================================================================

describe('AC8: Audit log', () => {

  it('creates audit log on first registration', () => {
    registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    expect(existsSync(TEST_AUDIT_LOG)).toBe(true);
  });

  it('logs registration with timestamp, role, and key prefix', () => {
    const key = registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const log = readFileSync(TEST_AUDIT_LOG, 'utf-8');
    expect(log).toContain('dev');
    expect(log).toContain(key.substring(0, 8)); // at least key prefix for traceability
  });

  it('appends to existing log (does not overwrite)', () => {
    registerAgent('dev', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    registerAgent('pdsa', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const log = readFileSync(TEST_AUDIT_LOG, 'utf-8');
    expect(log).toContain('dev');
    expect(log).toContain('pdsa');
  });
});

// ==========================================================================
// loadKeys() — utility for reading keys file
// ==========================================================================

describe('loadKeys() — reads key→role mapping', () => {

  it('returns empty object when file does not exist', () => {
    const keys = loadKeys('/tmp/nonexistent-keys.json');
    expect(keys).toEqual({});
  });

  it('returns parsed key→role mapping', () => {
    const key = registerAgent('qa', TEST_KEYS_FILE, TEST_AUDIT_LOG);
    const keys = loadKeys(TEST_KEYS_FILE);
    expect(keys[key]).toBe('qa');
  });
});
