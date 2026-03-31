# PDSA: runner-twin-kernel

## Plan

Implement the foundational twin kernel in `src/xp0/twin/`. This is Layer 1 — every other runner capability depends on twins.

### Key Decisions

1. **Reuse existing `src/twins/cid.js`** — the `computeCID()` function already handles DAG-JSON serialization, canonical key sorting, string trimming, volatile field exclusion, SHA-256 hashing, and CIDv1 creation. Import it rather than rewriting.

2. **TypeScript types in `src/xp0/twin/types.ts`** — define `Twin`, `TwinKind`, `SignedTwin`, `TwinContent` as TypeScript interfaces. Use discriminated unions for the 4 kinds.

3. **Pure functions** — `create()`, `validate()`, `sign()`, `verify()`, `evolve()` are all pure. No state, no storage dependency. Storage is a separate concern (runner-file-storage task).

4. **Ed25519 via `@noble/ed25519`** — already added to package.json by runner-codebase-setup.

### Types

```typescript
// src/xp0/twin/types.ts

type TwinKind = 'object' | 'relation' | 'schema' | 'principal';

interface TwinBase {
  cid: string;                      // CIDv1 computed from content
  kind: TwinKind;
  schema: string;                   // schema identifier (e.g., "xp0/task", "xp0/runner")
  owner: string;                    // DID of the creator
  content: Record<string, unknown>; // kind-specific payload
  previousVersion: string | null;   // CID of previous version (Merkle-DAG chain)
  version: number;                  // monotonically increasing
  state: string;                    // lifecycle state (e.g., "active", "archived")
  tags: string[];                   // user-defined tags
  createdAt: string;                // ISO 8601 timestamp
}

interface UnsignedTwin extends TwinBase {
  signature: null;
}

interface SignedTwin extends TwinBase {
  signature: string;                // hex-encoded Ed25519 signature
  delegatedBy: string | null;       // DID if signed by delegate
  mergedFrom: string[] | null;      // CIDs if this is a merge twin
}

type Twin = UnsignedTwin | SignedTwin;

// Kind-specific content constraints
interface RelationContent {
  source: string;    // CID of source twin
  target: string;    // CID of target twin
  relationType: string; // e.g., "depends_on", "owns", "member_of"
}

interface SchemaContent {
  jsonSchema: object; // JSON Schema definition
  schemaId: string;   // unique schema identifier
  version: string;    // schema version
}

interface PrincipalContent {
  publicKey: string;  // hex-encoded Ed25519 public key
  did: string;        // derived DID (did:key:...)
  displayName: string;
}
```

### Functions

```typescript
// src/xp0/twin/kernel.ts

/**
 * create(kind, schema, owner, content, opts?) → UnsignedTwin
 * - Computes CID from {kind, schema, owner, content, version, state, tags}
 * - Sets previousVersion=null, version=1, state="active"
 * - Does NOT sign (signing is explicit via sign())
 */

/**
 * validate(twin) → { valid: boolean, errors: string[] }
 * - Recomputes CID from content, checks it matches twin.cid
 * - Checks required fields present (kind, schema, owner, content)
 * - Kind-specific validation:
 *   - relation: source, target, relationType must be non-empty strings
 *   - schema: jsonSchema must be valid JSON Schema, schemaId non-empty
 *   - principal: publicKey and did must be present
 *   - object: content must be non-null object
 * - If signed: verifies Ed25519 signature
 */

/**
 * sign(twin, privateKey) → SignedTwin
 * - Computes signature over canonical CID bytes using Ed25519
 * - Returns new twin with signature field set
 * - Does NOT mutate input (immutability principle)
 */

/**
 * verify(twin) → boolean
 * - Extracts public key from twin.owner DID
 * - Verifies signature against CID
 * - Returns false if unsigned or signature invalid
 */

/**
 * evolve(twin, changes) → UnsignedTwin
 * - Creates new twin with:
 *   - previousVersion = twin.cid (Merkle-DAG link)
 *   - version = twin.version + 1
 *   - content merged: { ...twin.content, ...changes }
 *   - New CID recomputed
 * - Original twin is NOT modified (immutability)
 */
```

### File Layout

```
src/xp0/twin/
  index.ts       — re-exports from kernel.ts and types.ts
  types.ts       — Twin, TwinKind, SignedTwin interfaces
  kernel.ts      — create, validate, sign, verify, evolve functions
  kernel.test.ts — vitest tests for all functions
```

### CID Computation

Reuse `src/twins/cid.js` `computeCID()`. The kernel wraps it:
1. Build canonical object: `{kind, schema, owner, content, version, state, tags}`
2. Exclude volatile fields (cid, signature, previousVersion, createdAt, delegatedBy, mergedFrom)
3. Call `computeCID(canonical)` → CIDv1 string

**Why exclude signature from CID:** signature depends on the CID (signs the CID), so including it would create a circular dependency. CID = content identity, signature = authorship attestation.

**Why exclude previousVersion from CID:** the CID represents THIS version's content identity. The chain link (previousVersion) is metadata, not content.

### Ed25519 Signing

```typescript
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// sign: sha512(CID bytes) → Ed25519 signature
// verify: check signature against owner's public key
```

**Note:** `@noble/ed25519` needs `@noble/hashes` for sha512. Add `@noble/hashes` to package.json.

### Acceptance Criteria Mapping

| Criterion | Function | Test |
|-----------|----------|------|
| CID recomputable from content | `create()` | Create twin, strip CID, recompute, assert equal |
| Ed25519 signature verifiable | `sign()`, `verify()` | Generate keypair, sign, verify returns true |
| previousVersion links correctly | `evolve()` | Evolve twin, check new.previousVersion === old.cid |
| Rejects unsigned/invalid | `validate()` | Pass invalid CID → errors, unsigned → warning |
| All 4 kinds work | `create()` | Create object, relation, schema, principal twins |

### Dev Instructions

1. Create `src/xp0/twin/types.ts` with the type definitions above
2. Create `src/xp0/twin/kernel.ts` importing from `../../twins/cid.js` and `@noble/ed25519`
3. Implement `create()`, `validate()`, `sign()`, `verify()`, `evolve()`
4. `npm install @noble/hashes` (needed by @noble/ed25519 for sha512)
5. Create `src/xp0/twin/kernel.test.ts` with tests per acceptance criteria
6. Update `src/xp0/twin/index.ts` barrel export
7. Run `npx tsc --noEmit` to verify compilation
8. Run `npx vitest run src/xp0/twin/` to verify all tests pass
9. Git add, commit, push each file

### What NOT To Do

- Do NOT rewrite CID computation — import from `src/twins/cid.js`
- Do NOT add storage logic — that's `runner-file-storage`
- Do NOT add DID derivation — that's `runner-auth-identity`
- Do NOT add schema validation (JSON Schema / ajv) — that's for `runner-schemas`
- Do NOT create abstract classes — use plain functions and interfaces
- Keep the Ed25519 signing minimal — full DID infrastructure comes later

## Study / Act

(Populated after implementation)
