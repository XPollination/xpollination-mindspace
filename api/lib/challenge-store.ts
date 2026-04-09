/**
 * In-memory nonce store for Ed25519 challenge-response authentication.
 * Each device key can have one pending challenge at a time.
 * Nonces expire after 60 seconds.
 */

import crypto from 'node:crypto';

interface PendingChallenge {
  nonce: Buffer;
  keyId: string;
  createdAt: number;
}

const challenges = new Map<string, PendingChallenge>();
const CHALLENGE_TTL_MS = 60_000;

/**
 * Create a new challenge nonce for a device key.
 * Returns base64-encoded nonce. Overwrites any previous pending challenge for this key.
 */
export function createChallenge(keyId: string): string {
  const nonce = crypto.randomBytes(32);
  challenges.set(keyId, { nonce, keyId, createdAt: Date.now() });
  return nonce.toString('base64');
}

/**
 * Consume a pending challenge for verification.
 * Returns the nonce Buffer if valid and not expired, null otherwise.
 * The challenge is deleted after consumption (one-time use).
 */
export function consumeChallenge(keyId: string): Buffer | null {
  const pending = challenges.get(keyId);
  if (!pending) return null;

  challenges.delete(keyId);

  if (Date.now() - pending.createdAt > CHALLENGE_TTL_MS) return null;

  return pending.nonce;
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
