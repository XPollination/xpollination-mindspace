/**
 * API Key Encryption — AES-256-GCM with per-key random IV
 * Format: iv:authTag:ciphertext (base64 encoded)
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET = process.env.API_KEY_ENCRYPTION_SECRET || 'default-secret-change-me-32chars!';
const KEY = Buffer.from(SECRET.padEnd(32, '0').slice(0, 32));

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

export function decrypt(encoded: string): string {
  const [ivB64, authTagB64, ciphertext] = encoded.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
