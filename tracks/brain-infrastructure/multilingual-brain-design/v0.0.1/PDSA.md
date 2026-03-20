# PDSA: Multilingual Embedding Model Migration

**Task:** multilingual-brain-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-BRAIN-002

## Problem

Brain uses English-primary embedding model. Thomas works in German and English. Multilingual model needed for cross-language semantic search.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | BGE-M3 (BAAI/bge-m3) | Best multilingual performance. 1024 dims. Supports 100+ languages. Apache 2.0 license. Outperforms multilingual-e5-large on MTEB. |
| D2 | New collection + swap (not in-place) | Zero downtime. Old collection stays as fallback. Swap once re-embedding complete. |
| D3 | Batch re-embed with progress tracking | ~7500 vectors. ~2 vectors/sec on CX22 CPU. ~1 hour. Track progress in /tmp/reembed-progress.json. |

### Migration Steps

```
Phase 1: Prepare
  1. Install BGE-M3 model (onnx runtime, ~500MB download)
  2. Create new Qdrant collection: best_practices_v2 (1024 dims)
  3. Update Hive config: EMBEDDING_MODEL=bge-m3

Phase 2: Re-embed
  4. Read all thoughts from best_practices collection
  5. Re-embed each with BGE-M3
  6. Insert into best_practices_v2
  7. Track progress: /tmp/reembed-progress.json

Phase 3: Swap
  8. Alias best_practices → best_practices_v2
  9. Verify search quality (sample queries)
  10. Archive best_practices_v1 (keep 30 days)
```

### Hive Config Change

```javascript
// Before
const EMBEDDING_MODEL = 'all-MiniLM-L6-v2'; // 384 dims, English
// After
const EMBEDDING_MODEL = 'bge-m3'; // 1024 dims, multilingual
const EMBEDDING_DIMS = 1024;
```

### Qdrant Collection

```javascript
await qdrant.createCollection('best_practices_v2', {
  vectors: { size: 1024, distance: 'Cosine' }
});
```

### Acceptance Criteria

- AC1: BGE-M3 model loaded and producing embeddings
- AC2: New collection created with 1024 dimensions
- AC3: All thoughts re-embedded and migrated
- AC4: Search works in both German and English
- AC5: Old collection preserved as fallback
- AC6: Hive config updated

### Test Plan

api/__tests__/multilingual-brain.test.ts
