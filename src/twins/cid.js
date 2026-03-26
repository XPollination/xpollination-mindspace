// CID computation for digital twins — deterministic content addressing
// Ported from brain/src/services/cid-service.ts with twin-specific volatile fields

import * as dagJson from '@ipld/dag-json';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';

// Twin-specific volatile fields excluded from CID computation
// These change during workflow and should not affect content identity
const VOLATILE_FIELDS = [
  '_created_at',
  '_updated_at',
  'status',
  'claimed_by',
  'claimed_at',
  'updated_at',
];

/**
 * Compute a content-addressable CID (CIDv1) for a twin payload.
 * Uses DAG-JSON codec + SHA-256 hash.
 * Normalizes input: sorts keys canonically, trims strings, excludes volatile fields.
 */
export async function computeCID(payload) {
  // Remove volatile fields
  const stable = {};
  for (const key of Object.keys(payload)) {
    if (!VOLATILE_FIELDS.includes(key)) {
      stable[key] = payload[key];
    }
  }

  // Canonical key ordering via sort
  const canonical = sortKeys(stable);

  // Trim string values for consistency
  const trimmed = trimStrings(canonical);

  // Encode with DAG-JSON codec
  const bytes = dagJson.encode(trimmed);

  // Hash with SHA-256
  const hash = await sha256.digest(bytes);

  // Create CIDv1
  const cid = CID.createV1(dagJson.code, hash);
  return cid.toString();
}

function sortKeys(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === 'object') {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return obj;
}

function trimStrings(obj) {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimStrings);
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = trimStrings(value);
    }
    return result;
  }
  return obj;
}
