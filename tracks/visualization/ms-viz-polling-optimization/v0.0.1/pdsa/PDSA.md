# PDSA: Viz Polling Optimization — Mobile-Friendly Data Strategy

**Task:** ms-viz-polling-optimization
**Version:** v0.0.1
**Status:** Design

## Plan

### Current State (v0.0.15)

The viz dashboard polls `/api/data?project=<name>` every **5 seconds** (`POLL_INTERVAL_MS = 5000`). Each poll downloads the full dataset (all nodes, stations, counts). Client-side hash comparison (`lastDataHash`) avoids re-rendering if data unchanged, but the **full payload is still transferred**.

Existing optimizations:
- **Visibility API**: Polling stops when tab is hidden, resumes on focus
- **Client-side hash**: Only re-renders when data actually changed

**Not yet present:**
- Server-side change detection (ETag/Last-Modified)
- Delta/diff payloads
- Viz-client SSE (only agent SSE exists via `sse-manager.ts`)

### Investigation Results

1. **Polling interval**: 5 seconds
2. **Payload**: Full dataset per project (nodes + stations + counts) — size depends on project
3. **Data transferred per minute**: ~12 full fetches/min when tab is visible
4. **SSE infrastructure (ms-a11-3-sse-infra)**: Agent-to-agent SSE only (`sendToAgent()`). Does NOT serve viz dashboard clients. The viz dashboard is a browser client, not an agent with an SSE subscription.
5. **SSE migration will NOT automatically fix this** — the existing SSE is scoped to agent notifications (LEASE_WARNING, ATTESTATION_REJECTED, etc.), not viz data pushes.

### Proposed Design: Server-Side ETag + Adaptive Polling

A lightweight approach that reduces unnecessary data transfer without requiring SSE for the viz client.

#### 1. Server-Side ETag (API change)

Add ETag header to `/api/data` response based on a hash of the response body:

```js
// In viz/server.js or wherever /api/data is handled
app.get('/api/data', (req, res) => {
  const data = queryData(req.query.project);
  const json = JSON.stringify(data);
  const etag = '"' + crypto.createHash('md5').update(json).digest('hex') + '"';

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();  // Not Modified — zero body transfer
  }

  res.set('ETag', etag);
  res.json(data);
});
```

#### 2. Client Conditional Fetch (Viz change)

Send `If-None-Match` header with stored ETag:

```js
async function pollData() {
  const headers = {};
  if (lastETag) headers['If-None-Match'] = lastETag;

  const response = await fetch('/api/data' + projectParam, { headers });

  if (response.status === 304) return;  // No change — skip processing

  lastETag = response.headers.get('ETag');
  const data = await response.json();
  // ... existing render logic
}
```

#### 3. Adaptive Polling Interval

Increase interval when data is stable, reset to fast when changes detected:

```js
const POLL_MIN_MS = 5000;   // 5s when active changes
const POLL_MAX_MS = 30000;  // 30s when idle
let currentPollMs = POLL_MIN_MS;

async function pollData() {
  // ... fetch with ETag ...
  if (response.status === 304) {
    currentPollMs = Math.min(currentPollMs * 1.5, POLL_MAX_MS);
  } else {
    currentPollMs = POLL_MIN_MS;
  }
  // Reschedule with new interval
  clearInterval(pollInterval);
  pollInterval = setInterval(pollData, currentPollMs);
}
```

### Files to Change

1. `viz/server.js` — UPDATE: Add ETag header generation + 304 response for `/api/data`
2. `viz/versions/v0.0.16/index.html` — CREATE (copy v0.0.15): Add conditional fetch + adaptive polling
3. `viz/index.html` — UPDATE: Mirror changes
4. `viz/active` — UPDATE symlink → v0.0.16
5. `viz/changelog.json` — UPDATE: Add v0.0.16 entry

### Why Not SSE for Viz Client?

SSE for viz would be ideal long-term but is a larger architectural change:
- Requires a new SSE endpoint for browser clients (separate from agent SSE)
- Needs subscription management for multiple browser tabs
- Needs to push data diffs, not full datasets
- Current agent SSE (`sse-manager.ts`) is not designed for this

ETag + adaptive polling gives 90% of the benefit with ~20% of the effort. SSE for viz can be a future task.

## Do

Implementation by DEV agent.

## Study

- 304 responses returned when data unchanged (verify via network tab)
- Polling interval adapts (5s → up to 30s when idle)
- Full payload only sent when data actually changes
- Mobile data usage reduced proportionally to idle time

## Act

Measure before/after: count full payloads vs 304s over a 5-minute window.
