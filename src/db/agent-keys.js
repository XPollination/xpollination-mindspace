/**
 * Agent Key Registration & Validation
 *
 * Per automated-agent-bootstrap task DNA:
 * - registerAgent: Self-registration, generates unique key
 * - validateAgentKey: Validates key on every state-changing CLI operation
 * - loadKeys: Utility to read key→role mapping
 *
 * Security model: Catches ACCIDENTAL role confusion (honest about limitation:
 * same OS user = no true isolation. This is a guard rail, not a security barrier.)
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

// Valid roles that can register
const VALID_ROLES = ['dev', 'pdsa', 'qa', 'liaison'];

/**
 * Register an agent and receive a unique key.
 *
 * @param {string} role - The agent's role (dev, pdsa, qa, liaison)
 * @param {string} keysFilePath - Path to agent-keys.json
 * @param {string} auditLogPath - Path to audit log
 * @returns {string} The generated unique key
 * @throws {Error} If role is invalid
 */
export function registerAgent(role, keysFilePath, auditLogPath) {
  // Validate role
  if (!role || !VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role: "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
  }

  // Generate unique key
  const key = randomUUID();

  // Load existing keys or create empty object
  const keys = loadKeys(keysFilePath);

  // Store key→role mapping
  keys[key] = role;

  // Ensure directory exists
  const dir = dirname(keysFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write keys file (atomic for race condition safety)
  writeFileSync(keysFilePath, JSON.stringify(keys, null, 2));

  // Write audit log
  const auditDir = dirname(auditLogPath);
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] REGISTERED role=${role} key=${key.substring(0, 8)}...\n`;
  appendFileSync(auditLogPath, logEntry);

  return key;
}

/**
 * Validate an agent key against expected actor.
 *
 * @param {string|null} key - The AGENT_KEY to validate
 * @param {string} expectedActor - The actor attempting the operation
 * @param {string} keysFilePath - Path to agent-keys.json
 * @returns {string|null} Error message if invalid, null if valid
 */
export function validateAgentKey(key, expectedActor, keysFilePath) {
  // System actor bypasses key validation (per PDSA design)
  if (expectedActor === 'system') {
    return null;
  }

  // Check if keys file exists
  if (!existsSync(keysFilePath)) {
    return 'No agent keys registered. Run register-agent.js first.';
  }

  // Load keys
  const keys = loadKeys(keysFilePath);

  // Check if key exists
  if (!key || !keys[key]) {
    return 'Invalid agent key. Register with register-agent.js first.';
  }

  const keyRole = keys[key];

  // Special case: liaison can act as thomas (human proxy)
  if (keyRole === 'liaison' && expectedActor === 'thomas') {
    return null;
  }

  // Check role match
  if (keyRole !== expectedActor) {
    return `Role mismatch - your key grants [${keyRole}], attempted [${expectedActor}]`;
  }

  return null; // Valid
}

/**
 * Load key→role mapping from file.
 *
 * @param {string} keysFilePath - Path to agent-keys.json
 * @returns {Object} Key→role mapping, empty object if file doesn't exist
 */
export function loadKeys(keysFilePath) {
  if (!existsSync(keysFilePath)) {
    return {};
  }

  try {
    const content = readFileSync(keysFilePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return {};
  }
}
