import * as dagJson from '@ipld/dag-json';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { base58btc } from 'multiformats/bases/base58';
import type { Twin, UnsignedTwin, SignedTwin, TwinKind } from './types.js';

// CID is computed from content-identity fields only: kind, schema, owner, content.
// Volatile fields (cid, signature, previousVersion, version, state, tags, createdAt)
// are excluded — same content always produces the same CID.
async function computeTwinCID(
  kind: TwinKind,
  schema: string,
  owner: string,
  content: Record<string, unknown>,
): Promise<string> {
  const payload = sortKeys({ content, kind, owner, schema });
  const trimmed = trimStrings(payload);
  const bytes = dagJson.encode(trimmed);
  const hash = await sha256.digest(bytes);
  return CID.createV1(dagJson.code, hash).toString();
}

export async function create(
  kind: TwinKind,
  schema: string,
  owner: string,
  content: Record<string, unknown>,
): Promise<UnsignedTwin> {
  const cid = await computeTwinCID(kind, schema, owner, content);
  return {
    cid,
    kind,
    schema,
    owner,
    content: { ...content },
    previousVersion: null,
    signature: null,
    version: 1,
    state: 'active',
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

export async function validate(twin: Twin): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  const expectedCid = await computeTwinCID(twin.kind, twin.schema, twin.owner, twin.content);
  if (twin.cid !== expectedCid) {
    errors.push(`CID mismatch: expected ${expectedCid}, got ${twin.cid}`);
  }

  const c = twin.content;
  switch (twin.kind) {
    case 'relation':
      if (!c.source) errors.push('relation twin missing required field: source');
      if (!c.target) errors.push('relation twin missing required field: target');
      if (!c.relationType) errors.push('relation twin missing required field: relationType');
      break;
    case 'schema':
      if (!c.jsonSchema) errors.push('schema twin missing required field: jsonSchema');
      if (!c.schemaId) errors.push('schema twin missing required field: schemaId');
      break;
    case 'principal':
      if (!c.publicKey) errors.push('principal twin missing required field: publicKey');
      if (!c.did) errors.push('principal twin missing required field: did');
      break;
  }

  return { valid: errors.length === 0, errors };
}

export async function sign(twin: Twin, privateKey: Uint8Array): Promise<SignedTwin> {
  const ed = await import('@noble/ed25519');
  const cidBytes = new TextEncoder().encode(twin.cid);
  const signature = await ed.signAsync(cidBytes, privateKey);
  const sigHex = Array.from(signature).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { ...twin, signature: sigHex } as SignedTwin;
}

export async function verify(twin: Twin): Promise<boolean> {
  if (!twin.signature) return false;
  try {
    const ed = await import('@noble/ed25519');
    const prefix = 'did:key:z';
    if (!twin.owner.startsWith(prefix)) return false;
    const encoded = twin.owner.slice('did:key:'.length);
    let publicKey: Uint8Array;
    // Try base58btc did:key format (z + base58btc(0xed01 + pubkey))
    try {
      const decoded = base58btc.decode(encoded);
      if (decoded[0] === 0xed && decoded[1] === 0x01) {
        publicKey = decoded.slice(2);
      } else {
        throw new Error('not ed25519 multicodec');
      }
    } catch {
      // Fall back to hex-encoded pubkey (legacy: did:key:z{hex})
      const pubHex = encoded.slice(1); // skip 'z'
      publicKey = new Uint8Array(pubHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    }
    const sigBytes = new Uint8Array(twin.signature.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const cidBytes = new TextEncoder().encode(twin.cid);
    return await ed.verifyAsync(sigBytes, cidBytes, publicKey);
  } catch {
    return false;
  }
}

export async function evolve(twin: Twin, changes: Record<string, unknown>): Promise<UnsignedTwin> {
  const newContent = { ...twin.content, ...changes };
  const cid = await computeTwinCID(twin.kind, twin.schema, twin.owner, newContent);
  return {
    cid,
    kind: twin.kind,
    schema: twin.schema,
    owner: twin.owner,
    content: newContent,
    previousVersion: twin.cid,
    signature: null,
    version: twin.version + 1,
    state: twin.state,
    tags: [...twin.tags],
    createdAt: twin.createdAt,
  };
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

function trimStrings(obj: unknown): unknown {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimStrings);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = trimStrings(value);
    }
    return result;
  }
  return obj;
}
