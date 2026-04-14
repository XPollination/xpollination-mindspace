import { base58btc } from 'multiformats/bases/base58';

export async function generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  const ed = await import('@noble/ed25519');
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

export function deriveDID(publicKey: Uint8Array): string {
  // Ed25519 multicodec prefix 0xed01 (varint) + raw public key
  const bytes = new Uint8Array(2 + publicKey.length);
  bytes[0] = 0xed;
  bytes[1] = 0x01;
  bytes.set(publicKey, 2);
  // base58btc.encode returns "z..." (z = multibase prefix for base58btc)
  return `did:key:${base58btc.encode(bytes)}`;
}

export function extractPublicKeyFromDID(did: string): Uint8Array {
  const encoded = did.replace('did:key:', '');
  const decoded = base58btc.decode(encoded);
  // Strip 0xed01 multicodec prefix
  return decoded.slice(2);
}
