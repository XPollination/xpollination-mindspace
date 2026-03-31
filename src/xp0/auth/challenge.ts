import { randomUUID } from 'node:crypto';
import { extractPublicKeyFromDID } from './identity.js';

export function createChallenge(): string {
  return `${randomUUID()}-${Date.now()}`;
}

export async function signChallenge(challenge: string, privateKey: Uint8Array): Promise<string> {
  const ed = await import('@noble/ed25519');
  const bytes = new TextEncoder().encode(challenge);
  const signature = await ed.signAsync(bytes, privateKey);
  return Array.from(signature)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyChallenge(
  challenge: string,
  signature: string,
  publicDID: string,
): Promise<boolean> {
  try {
    const ed = await import('@noble/ed25519');
    const publicKey = extractPublicKeyFromDID(publicDID);
    const sigBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const msgBytes = new TextEncoder().encode(challenge);
    return await ed.verifyAsync(sigBytes, msgBytes, publicKey);
  } catch {
    return false;
  }
}
