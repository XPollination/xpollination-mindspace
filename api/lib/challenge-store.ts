/**
 * In-memory nonce store for Ed25519 challenge-response authentication.
 * Multiple concurrent challenges per device key are supported (e.g. 4 agent bodies
 * starting in parallel with the same key). Nonces expire after 60 seconds.
 */

import crypto from 'node:crypto';

interface PendingChallenge {
  nonce: Buffer;
  keyId: string;
  createdAt: number;
}

// Map: keyId -> array of pending challenges (multiple concurrent allowed)
const challenges = new Map<string, PendingChallenge[]>();
const CHALLENGE_TTL_MS = 60_000;

/**
 * Create a new challenge nonce for a device key.
 * Returns base64-encoded nonce. Multiple concurrent challenges per key are supported.
 */
export function createChallenge(keyId: string): string {
  const nonce = crypto.randomBytes(32);
  const list = challenges.get(keyId) || [];
  list.push({ nonce, keyId, createdAt: Date.now() });
  challenges.set(keyId, list);
  return nonce.toString('base64');
}

/**
 * Consume any pending non-expired challenge for the given key.
 * Returns the nonce Buffer if any valid challenge exists, null otherwise.
 * The verification compares the signature against ANY pending nonce — the server
 * doesn't know which challenge the client is responding to, so it tries each one.
 * Used internally by the verify path.
 */
export function getPendingChallenges(keyId: string): Buffer[] {
  const list = challenges.get(keyId) || [];
  const now = Date.now();
  const valid = list.filter(c => now - c.createdAt <= CHALLENGE_TTL_MS);
  return valid.map(c => c.nonce);
}

/**
 * Remove a specific challenge after successful verification.
 */
export function removeChallenge(keyId: string, nonce: Buffer): void {
  const list = challenges.get(keyId) || [];
  const filtered = list.filter(c => !c.nonce.equals(nonce));
  if (filtered.length === 0) {
    challenges.delete(keyId);
  } else {
    challenges.set(keyId, filtered);
  }
}

/**
 * @deprecated Use getPendingChallenges + removeChallenge instead.
 * Kept for backward compat — returns the FIRST valid nonce and removes it.
 */
export function consumeChallenge(keyId: string): Buffer | null {
  const list = challenges.get(keyId) || [];
  const now = Date.now();
  const idx = list.findIndex(c => now - c.createdAt <= CHALLENGE_TTL_MS);
  if (idx < 0) return null;
  const nonce = list[idx].nonce;
  list.splice(idx, 1);
  if (list.length === 0) challenges.delete(keyId);
  else challenges.set(keyId, list);
  return nonce;
}

/**
 * Remove expired challenges. Call periodically.
 */
export function cleanupExpired(): void {
  const now = Date.now();
  for (const [keyId, pending] of challenges) {
    if (now - pending.createdAt > CHALLENGE_TTL_MS) {
      challenges.delete(keyId);
    }
  }
}
