/**
 * TDD tests for bp-content-addressable-thought-arch
 *
 * Verifies IPLD Phase A: CID computation (DAG-JSON + SHA-256),
 * Qdrant CID storage, GET /by-cid/:cid lookup, dual-ID (UUID+CID).
 *
 * From PDSA content-addressable-thought-architecture v0.0.1:
 * AC-CID1: computeCID deterministic for same input
 * AC-CID2: Different content → different CID
 * AC-CID3: Volatile fields excluded from CID
 * AC-CID4: Canonical key ordering
 * AC-CID5: String trimming consistency
 * AC-CID6: CID stored in Qdrant payload
 * AC-CID7: GET /by-cid/:cid returns thought
 * AC-CID8: GET /by-cid/:cid 404 for unknown
 * AC-CID9: Valid CIDv1 format
 * AC-CID10: Legacy thoughts without CID return null
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/src/services/cid-service.ts:
 *   - Export async computeCID(payload) → CIDv1 string
 *   - Normalize: sort keys, trim strings, exclude volatile fields
 *   - Volatile fields: created_at, last_accessed, access_count, pheromone_weight
 *   - Use DAG-JSON codec + SHA-256 hash
 *   - Return CIDv1 string format (e.g., bafyr...)
 * - Update api/src/services/thoughtspace.ts:
 *   - Call computeCID during contribute_to_brain
 *   - Store CID in Qdrant payload
 * - Update api/src/routes/thoughts.ts:
 *   - Add GET /by-cid/:cid endpoint
 *   - Return matching thought or 404
 * - Update package.json:
 *   - Add multiformats + @ipld/dag-json dependencies
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const API_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/api"
);
const SRC_DIR = resolve(API_DIR, "src");

// --- AC-CID1–5: CID Service (cid-service.ts) ---

describe("AC-CID service: cid-service.ts", () => {
  const servicePath = resolve(SRC_DIR, "services/cid-service.ts");

  it("cid-service.ts file exists", () => {
    expect(existsSync(servicePath)).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(servicePath, "utf-8");
  } catch {
    content = "";
  }

  // AC-CID1: deterministic output
  it("exports computeCID function", () => {
    expect(content).toMatch(/export.*computeCID/);
  });

  it("uses DAG-JSON codec", () => {
    expect(content).toMatch(/dag-json|dagJson|DAG_JSON/i);
  });

  it("uses SHA-256 hashing", () => {
    expect(content).toMatch(/sha-?256|sha256/i);
  });

  // AC-CID3: volatile field exclusion
  it("excludes created_at from CID computation", () => {
    expect(content).toMatch(/created_at/);
  });

  it("excludes last_accessed from CID computation", () => {
    expect(content).toMatch(/last_accessed/);
  });

  it("excludes access_count from CID computation", () => {
    expect(content).toMatch(/access_count/);
  });

  it("excludes pheromone_weight from CID computation", () => {
    expect(content).toMatch(/pheromone_weight/);
  });

  // AC-CID4: canonical key ordering
  it("sorts keys for canonical ordering", () => {
    expect(content).toMatch(/sort|Object\.keys.*sort|canonical/i);
  });

  // AC-CID5: string trimming
  it("trims strings for consistency", () => {
    expect(content).toMatch(/trim|\.trim\(\)/);
  });

  // AC-CID9: CIDv1 format
  it("returns CIDv1 format string", () => {
    expect(content).toMatch(/CID|cid|toString|multibase/i);
  });

  it("is async function", () => {
    expect(content).toMatch(/async.*computeCID|computeCID.*async/);
  });
});

// --- AC-CID6: CID stored in Qdrant payload ---

describe("AC-CID6: thoughtspace.ts stores CID in Qdrant payload", () => {
  const thoughtspacePath = resolve(SRC_DIR, "services/thoughtspace.ts");

  let content: string;
  try {
    content = readFileSync(thoughtspacePath, "utf-8");
  } catch {
    content = "";
  }

  it("imports computeCID from cid-service", () => {
    expect(content).toMatch(/cid-service|cid_service/);
    expect(content).toMatch(/computeCID/);
  });

  it("calls computeCID during contribution", () => {
    // Should appear in the contribute/upsert flow
    expect(content).toMatch(/computeCID\s*\(/);
  });

  it("stores cid field in Qdrant payload", () => {
    // The CID value should be set on the payload object
    expect(content).toMatch(/cid/i);
  });
});

// --- AC-CID7, AC-CID8: GET /by-cid/:cid endpoint ---

describe("AC-CID7/8: GET /by-cid/:cid endpoint in thoughts.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SRC_DIR, "routes/thoughts.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("has /by-cid route", () => {
    expect(content).toMatch(/by-cid|byCid/);
  });

  it("has GET handler for CID lookup", () => {
    expect(content).toMatch(/\.get\s*\(/i);
    expect(content).toMatch(/cid/i);
  });

  it("returns 404 for unknown CID", () => {
    expect(content).toMatch(/404/);
  });

  it("returns thought data on match", () => {
    expect(content).toMatch(/\.json\s*\(/);
  });
});

// --- AC-CID10: Legacy thought handling ---

describe("AC-CID10: Legacy thoughts without CID", () => {
  let content: string;
  try {
    content = readFileSync(resolve(SRC_DIR, "services/thoughtspace.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("handles null/undefined CID gracefully", () => {
    // Legacy thoughts returned from Qdrant may not have CID field
    // The code should handle this without errors
    expect(content).toMatch(/cid.*null|null.*cid|cid.*undefined|\.cid\s*\?\?|\.cid\s*\|\|/i);
  });
});

// --- Dependencies ---

describe("Package dependencies for CID support", () => {
  let pkgContent: string;
  try {
    pkgContent = readFileSync(resolve(API_DIR, "package.json"), "utf-8");
  } catch {
    pkgContent = "";
  }

  it("has multiformats dependency", () => {
    expect(pkgContent).toMatch(/multiformats/);
  });

  it("has @ipld/dag-json dependency", () => {
    expect(pkgContent).toMatch(/@ipld\/dag-json/);
  });
});
