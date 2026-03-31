# PDSA: runner-file-storage

## Plan

Implement the bootstrap FileStorageAdapter in `src/xp0/storage/`. JSON files on disk — human-readable, debug-friendly, simplest possible adapter. Satisfies the StorageAdapter interface so it's swappable to Postgres/SQLite later.

### Key Decisions

1. **File layout: `{storeDir}/{cid-prefix}/{cid}.json`** — first 4 chars of CID as prefix directory to avoid flat directory with thousands of files. Each twin is one JSON file.

2. **Index file: `{storeDir}/_index/{logicalId}.json`** — maps logical IDs (schema + owner + content identity) to CID arrays for `heads()`. Updated on `dock()`. This avoids full directory scans for head resolution.

3. **CID integrity verification on resolve** — when reading a file, recompute CID from content and compare. Reject tampered files.

4. **`forget()` replaces content** — writes `{state: "forgotten", forgottenAt: ISO8601}` to the JSON file, preserving the file (and CID reference) but purging PII. The Merkle-DAG chain doesn't break because previousVersion CIDs still resolve to the marker file.

5. **No in-memory caching** — filesystem IS the cache. Keep it simple. Performance optimization is a future concern.

### Interface

```typescript
// src/xp0/storage/types.ts

interface StorageAdapter {
  dock(twin: Twin): Promise<void>;
  resolve(cid: string): Promise<Twin | null>;
  query(filter: QueryFilter): Promise<Twin[]>;
  heads(logicalId: string): Promise<string[]>;
  history(cid: string): Promise<Twin[]>;
  undock(cid: string): Promise<void>;
  forget(cid: string): Promise<void>;
}

interface QueryFilter {
  kind?: TwinKind;
  schema?: string;
  tags?: string[];
  state?: string;
  owner?: string;
  limit?: number;
}
```

### File Layout

```
src/xp0/storage/
  index.ts                    — re-exports StorageAdapter interface + FileStorageAdapter
  types.ts                    — StorageAdapter interface, QueryFilter
  file-storage-adapter.ts     — FileStorageAdapter implementation
  file-storage-adapter.test.ts — vitest tests
```

### Implementation Design

```typescript
// src/xp0/storage/file-storage-adapter.ts

class FileStorageAdapter implements StorageAdapter {
  constructor(private storeDir: string) {}

  /**
   * dock(twin): Write twin as JSON to {storeDir}/{cid[0:4]}/{cid}.json
   * - Verify CID matches content before writing (reject corrupted twins)
   * - Update _index/{logicalId}.json with this CID
   * - logicalId = twin.schema + ":" + twin.owner (or content-derived identity)
   * - Create directories as needed (mkdir -p equivalent)
   */

  /**
   * resolve(cid): Read {storeDir}/{cid[0:4]}/{cid}.json
   * - Parse JSON, recompute CID, verify integrity
   * - Return null if file doesn't exist
   * - Throw if CID mismatch (tampered file)
   */

  /**
   * query(filter): Scan all JSON files in storeDir
   * - Filter by kind, schema, tags (any match), state, owner
   * - Apply limit
   * - O(n) scan — acceptable for file-based adapter
   * - Skips _index directory
   */

  /**
   * heads(logicalId): Read _index/{logicalId}.json
   * - Returns array of CIDs that have no successors
   * - Normal: 1 head. Conflict: 2+ heads.
   * - Computed: all CIDs in index minus those referenced as previousVersion
   */

  /**
   * history(cid): Walk previousVersion chain
   * - resolve(cid) → twin → resolve(twin.previousVersion) → ... → null
   * - Returns array from newest to oldest (genesis last)
   */

  /**
   * undock(cid): Delete {storeDir}/{cid[0:4]}/{cid}.json
   * - Remove CID from relevant index entries
   */

  /**
   * forget(cid): GDPR purge
   * - Read twin, replace content with {state: "forgotten", forgottenAt: now}
   * - Rewrite file (CID marker preserved as filename, content purged)
   * - NOTE: CID will no longer verify against content (expected for forgotten twins)
   */
}
```

### Logical ID Design

The `logicalId` identifies a twin lineage (all versions of the same logical entity). Options:
- `schema:owner:contentKey` — e.g., `xp0/task:did:key:abc:my-task-slug`
- Derived from first-version CID — use genesis CID as permanent lineage ID
- Explicit: twin.content.logicalId — if present in content

**Decision:** Use `twin.content.logicalId` if present, otherwise fall back to genesis CID. The `_index` maps whichever ID to the list of all version CIDs.

### Acceptance Criteria Mapping

| Criterion | Method | Test |
|-----------|--------|------|
| dock creates valid JSON, CID recomputable | dock() | Dock twin, read file, recompute CID |
| resolve reads + verifies CID | resolve() | Dock, resolve, compare |
| query returns correct subset | query() | Dock 10+ twins, query by kind/schema/tags |
| heads returns 1 normal, 2+ conflict | heads() | Dock chain, check 1 head. Dock divergent evolution, check 2 heads |
| history walks full chain | history() | Evolve 3 times, history returns 4 twins (3 evolutions + genesis) |
| forget purges content, chain intact | forget() | Dock chain, forget middle, history still walks |
| Satisfies StorageAdapter interface | TypeScript | Class implements interface, tsc compiles |

### Dev Instructions

1. Create `src/xp0/storage/types.ts` with StorageAdapter interface and QueryFilter
2. Create `src/xp0/storage/file-storage-adapter.ts` implementing all 7 methods
3. Create `src/xp0/storage/file-storage-adapter.test.ts` with tests per acceptance criteria
4. Use `os.tmpdir()` + random suffix for test store directories (cleanup after each test)
5. Update `src/xp0/storage/index.ts` barrel export
6. Run `npx tsc --noEmit` to verify compilation
7. Run `npx vitest run src/xp0/storage/` to verify all tests pass
8. Git add, commit, push each file

### Dependencies

- `src/xp0/twin/` — imports Twin type and computeCID for integrity checks
- `node:fs/promises` — file operations
- `node:path` — path construction
- No external deps needed — pure Node.js fs

### What NOT To Do

- Do NOT add in-memory caching — filesystem is the store
- Do NOT add file locking — concurrent access is a future concern
- Do NOT implement MemoryAdapter or PostgresAdapter — separate tasks
- Do NOT add compression or encryption — future concerns
- Do NOT optimize query() beyond simple scan — acceptable for bootstrap adapter

## Study / Act

(Populated after implementation)
