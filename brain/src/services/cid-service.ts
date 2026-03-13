import * as dagJson from "@ipld/dag-json";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";

// Volatile fields excluded from CID computation — these change over time
// and should not affect content identity
const VOLATILE_FIELDS = [
  "created_at",
  "last_accessed",
  "access_count",
  "pheromone_weight",
];

/**
 * Compute a content-addressable CID (CIDv1) for a thought payload.
 * Uses DAG-JSON codec + SHA-256 hash.
 * Normalizes input: sorts keys canonically, trims strings, excludes volatile fields.
 */
export async function computeCID(
  payload: Record<string, unknown>,
): Promise<string> {
  // Remove volatile fields
  const stable: Record<string, unknown> = {};
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

function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

function trimStrings(obj: unknown): unknown {
  if (typeof obj === "string") return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimStrings);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = trimStrings(value);
    }
    return result;
  }
  return obj;
}
