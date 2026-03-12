# PDSA: Viz Data Polling Architecture

**Task:** `viz-data-polling-architecture`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The viz dashboard polls `/api/data` for all mindspace nodes. When data changes, the full payload (~2.2 MB for `project=all`) is sent over the wire. ETag/304 correctly avoids transfer when data is unchanged, and adaptive polling (5s→30s) reduces frequency during idle periods. But when any single node changes (status transition, DNA update), the entire dataset is re-serialized and sent.

**Current measurements:**
- 350 nodes across 2 projects (xpollination-mcp-server: 313, HomePage: 37)
- DNA averages 3,056 bytes/node — top node is 28,466 bytes
- DNA is ~89% of payload; JSON structure overhead is ~11%
- `project=all` pretty-printed: 2,284 KB; compact: 2,089 KB
- On a typical poll cycle with one node changed: 2,089 KB sent for ~3 KB of actual change

**Goal per DNA:** Keep payload under ~50 KB for typical update cycles.

### Investigation Findings

**What works well (keep):**
- ETag/304 for idle detection — zero bytes on unchanged data
- Adaptive polling interval (5s→30s) — reduces poll frequency during idle
- Visibility detection — stops polling when tab hidden
- Client-side hash comparison — safety net for ETag failures

**What doesn't work well (fix):**
- Full payload on any change — 2 MB for a single field update
- No delta/incremental sync capability
- `dna_json` sent in full even when client already has it
- Pretty-printed JSON (`null, 2`) adds ~7% overhead
- Two separate endpoints per cycle (`/api/data` + `/api/stats`)

### Design Decisions

**D1: Incremental sync via `updated_at` watermark — not SSE or WebSocket.**

SSE and WebSocket require persistent connections, server-side connection management, and reconnection logic. The viz is a single-file server with no framework. The polling pattern works well — the problem is payload size, not latency. An incremental sync that sends only changed rows since the client's last watermark solves the payload problem while keeping the polling architecture intact.

SSE can be added later as a transport optimization (push notifications to trigger immediate poll) without changing the data protocol.

**D2: Server tracks a global change sequence number, not timestamps.**

`updated_at` timestamps have precision issues (multiple changes within the same second) and clock sensitivity. A monotonically increasing sequence number (`change_seq`) is simpler and guaranteed unique. The server increments it on every write operation.

Implementation: Add a `change_seq INTEGER` column to `mindspace_nodes`. The `interface-cli.js` update/transition commands set `change_seq = (SELECT MAX(change_seq)+1 FROM mindspace_nodes)` on each write.

**D3: Client sends `since` parameter; server returns only changed nodes.**

First request (no `since`): Full payload (bootstrap). Subsequent requests: `GET /api/data?since=42` → only nodes with `change_seq > 42`. Response includes `max_seq` so client knows what to send next.

**D4: Compact JSON (no pretty-printing) for data endpoint.**

`JSON.stringify(data, null, 2)` adds ~7% overhead and makes ETag computation slower. Switch to `JSON.stringify(data)` for the `/api/data` endpoint. The data is consumed programmatically, not read by humans.

**D5: Merge `/api/stats` into `/api/data` response.**

Currently the client makes two fetches per cycle. Stats (queue_count, active_count, completed_count) are already computed from the same node data. Include them in the `/api/data` response to eliminate the second request.

**D6: DNA-lite mode for bulk responses.**

The full `dna_json` is the dominant payload cost (89%). For the Kanban view, the client only needs: `title`, `role`, `status`, `description` (truncated), `depends_on`, `group`, `environment`. A `dna_lite` object with just these fields reduces per-node DNA from ~3 KB to ~200 bytes.

Full DNA is still available via the existing node detail panel (already fetched on-demand via `GET /api/nodes/:id` or the proposed `GET /api/tasks/:slug`).

**D7: Deleted nodes are signaled via a `deleted_seqs` array.**

When a node is deleted (rare but possible), the server can't include it in the `changed_nodes` response (it no longer exists). The response includes `deleted_slugs: ["slug1", "slug2"]` for any nodes deleted since the client's `since` value. Implementation: a small `deleted_nodes` table or a `deleted_at` column.

### Protocol Specification

#### Bootstrap Request (first load)

```
GET /api/data?project=all
→ 200 OK
{
  "max_seq": 847,
  "node_count": 350,
  "queue_count": 12,
  "active_count": 5,
  "completed_count": 333,
  "stations": [...],
  "nodes": [
    {
      "id": "abc-123",
      "slug": "my-task",
      "type": "task",
      "status": "active",
      "parent_ids": [],
      "change_seq": 845,
      "created_at": "2026-03-12T10:00:00",
      "updated_at": "2026-03-12T10:00:00",
      "dna": {
        "title": "My Task",
        "role": "dev",
        "description": "Short description...",
        "depends_on": ["other-task"],
        "group": "H1",
        "environment": "test"
      }
    }
  ]
}
```

- `dna` is the lite version (not full `dna_json`)
- `max_seq` is the highest `change_seq` in the dataset
- Client stores `max_seq` for next request

#### Incremental Request (subsequent polls)

```
GET /api/data?project=all&since=845
→ 200 OK
{
  "max_seq": 847,
  "since": 845,
  "changed_count": 2,
  "deleted_slugs": [],
  "queue_count": 11,
  "active_count": 6,
  "completed_count": 333,
  "nodes": [
    { "slug": "my-task", "status": "review", "change_seq": 846, "dna": { ... } },
    { "slug": "other-task", "status": "active", "change_seq": 847, "dna": { ... } }
  ]
}
```

- Only nodes with `change_seq > 845` are returned
- Client merges changed nodes into its local dataset
- `deleted_slugs` lists any nodes removed since seq 845
- No `stations` in incremental response (stations rarely change; include only if station change_seq also tracked, or always include — they're ~1 KB)

#### Unchanged Response (ETag still works)

```
GET /api/data?project=all&since=847
If-None-Match: "abc123"
→ 304 Not Modified
```

ETag still applies to incremental responses. If nothing changed since seq 847, the response is identical to the last one, so 304 fires.

#### Client Merge Logic

```javascript
function mergeIncrementalData(response) {
  // Remove deleted nodes
  for (const slug of response.deleted_slugs || []) {
    const idx = nodes.findIndex(n => n.slug === slug);
    if (idx >= 0) nodes.splice(idx, 1);
  }

  // Update or insert changed nodes
  for (const changed of response.nodes) {
    const idx = nodes.findIndex(n => n.slug === changed.slug);
    if (idx >= 0) {
      nodes[idx] = { ...nodes[idx], ...changed };
    } else {
      nodes.push(changed);
    }
  }

  // Update stats
  lastSeq = response.max_seq;
  updateStats(response);
}
```

### Estimated Payload Sizes

| Scenario | Current | Proposed |
|----------|---------|----------|
| No change (304) | 0 bytes | 0 bytes |
| 1 node changed | 2,089 KB | ~0.5 KB |
| 5 nodes changed | 2,089 KB | ~2.5 KB |
| 50 nodes changed | 2,089 KB | ~25 KB |
| Bootstrap (first load) | 2,089 KB | ~250 KB* |

*Bootstrap with DNA-lite (~200 bytes/node × 350 nodes + structure) ≈ 70 KB nodes + 1 KB stations + overhead ≈ ~100 KB. The current 2 MB shrinks to ~100 KB because DNA goes from 3,056 bytes avg to ~200 bytes avg.

### Implementation Plan

#### Phase 1: `change_seq` Column (interface-cli.js + schema)

Add `change_seq INTEGER DEFAULT 0` to `mindspace_nodes`:

```sql
ALTER TABLE mindspace_nodes ADD COLUMN change_seq INTEGER DEFAULT 0;
```

In `interface-cli.js`, on every update/transition:
```javascript
// After existing update logic
db.prepare(
  'UPDATE mindspace_nodes SET change_seq = (SELECT COALESCE(MAX(change_seq),0)+1 FROM mindspace_nodes) WHERE id = ?'
).run(nodeId);
```

Backfill existing rows:
```sql
UPDATE mindspace_nodes SET change_seq = rowid WHERE change_seq = 0;
```

#### Phase 2: Incremental `/api/data` Endpoint (server.js)

Modify the existing endpoint to accept `?since=N`:

```javascript
if (since) {
  // Incremental: only changed nodes
  const changedNodes = db.prepare(
    'SELECT * FROM mindspace_nodes WHERE change_seq > ? ORDER BY change_seq ASC'
  ).all(since);
  // ... build lite DNA, return with max_seq
} else {
  // Bootstrap: all nodes
  const allNodes = db.prepare(
    'SELECT * FROM mindspace_nodes ORDER BY created_at ASC'
  ).all();
  // ... build lite DNA, return with max_seq
}
```

#### Phase 3: DNA-lite Transformation (server.js)

```javascript
function toLiteDna(dnaJson) {
  const dna = typeof dnaJson === 'string' ? JSON.parse(dnaJson) : dnaJson;
  return {
    title: dna.title || null,
    role: dna.role || null,
    description: (dna.description || '').substring(0, 200),
    depends_on: dna.depends_on || [],
    group: dna.group || null,
    environment: dna.environment || null
  };
}
```

#### Phase 4: Client Incremental Merge (index.html)

Update `pollData()`:
```javascript
async function pollData() {
  const sinceParam = lastSeq ? `&since=${lastSeq}` : '';
  const projectParam = currentProject ? `?project=${currentProject}` : '?project=all';
  const url = '/api/data' + projectParam + sinceParam;

  const headers = {};
  if (lastEtag) headers['If-None-Match'] = lastEtag;

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    idleTickCount++;
    adaptPollingInterval();
    return;
  }

  const etag = response.headers.get('etag');
  if (etag) lastEtag = etag;

  const data = await response.json();

  if (data.since) {
    // Incremental update
    mergeIncrementalData(data);
    if (data.changed_count > 0) {
      idleTickCount = 0;
      renderVisualization();
    } else {
      idleTickCount++;
    }
  } else {
    // Bootstrap
    nodes = data.nodes;
    stations = data.stations;
    renderVisualization();
  }

  lastSeq = data.max_seq;
  adaptPollingInterval();
}
```

#### Phase 5: Remove Pretty-Printing

Change `JSON.stringify(data, null, 2)` to `JSON.stringify(data)` in server.js ETag computation and response.

### Files Changed

| File | Change |
|------|--------|
| `src/db/interface-cli.js` | Set `change_seq` on update/transition operations |
| `viz/versions/v0.0.{next}/server.js` | Incremental `since` support, DNA-lite, compact JSON, merge stats |
| `viz/versions/v0.0.{next}/index.html` | Incremental merge, `lastSeq` state, updated `pollData()` |
| `viz/versions/v0.0.{next}/changelog.json` | Version metadata |

### Risks and Mitigations

**R1: Sequence gaps on concurrent writes.** Two simultaneous CLI commands could compute the same `MAX(change_seq)+1`. Mitigation: SQLite serializes writes by default (WAL mode still serializes writers). Single writer = no gaps.

**R2: Client drift.** If the client misses a sequence range (e.g., network error), it may have stale data. Mitigation: On any fetch error, reset `lastSeq = null` to trigger a full bootstrap on next poll.

**R3: `deleted_slugs` without a tracking table.** Without tracking deletions, the server can't tell the client about removed nodes. Mitigation: Nodes are rarely deleted (they go to `cancelled` status instead). Phase 1 can skip deletion tracking; add a `deleted_nodes` table later if needed.

### Out of Scope

- **SSE/WebSocket push:** Could eliminate polling entirely, but requires persistent connection management. Can be layered on later as a notification trigger ("something changed, poll now") without changing the data protocol.
- **GraphQL:** Over-engineered for a single-file server with 2 endpoints.
- **Compression (gzip):** Node's `http.createServer` doesn't compress by default. Adding `zlib.createGzip()` would help but is a separate concern from the data protocol.
- **Pagination:** With DNA-lite, bootstrap is ~100 KB — no need to paginate.

### Verification Plan

1. **Bootstrap size:** First load with no `since` param → measure payload. Should be ~100-150 KB (down from 2,089 KB).
2. **Incremental size:** Change one node via CLI, poll with `since` → payload should be <1 KB.
3. **ETag on incremental:** Poll twice with same `since` → second poll returns 304.
4. **Client merge:** After incremental update, verify the changed node is correctly updated in the Kanban view without full re-render glitch.
5. **Sequence monotonicity:** Run 10 rapid transitions → `change_seq` values are strictly increasing with no gaps.
6. **Error recovery:** Kill network mid-poll → next successful poll bootstraps correctly (full dataset).
7. **Stats merged:** Verify `queue_count`, `active_count`, `completed_count` appear in `/api/data` response without separate `/api/stats` call.
8. **Multi-project:** `project=all` with `since` → only returns nodes from projects that had changes.
9. **Backward compatibility:** Client without `since` param still gets full bootstrap (no breaking change for old clients).

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
