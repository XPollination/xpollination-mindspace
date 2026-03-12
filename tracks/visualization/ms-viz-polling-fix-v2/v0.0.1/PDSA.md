# PDSA: Viz polling still downloads full data despite ETag fix (v2)

**Task:** `ms-viz-polling-fix-v2`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The previous fix (`ms-viz-polling-optimization`, marked complete) was **never actually implemented**. Investigation proves:

1. **Server (`viz/server.js`):** No ETag header generation. `sendJson()` (line 114-120) sends `Content-Type` and `Access-Control-Allow-Origin` only. No `ETag`, no `Last-Modified`, no `If-None-Match` handling.
2. **Client (`viz/index.html`):** No conditional fetch. `pollData()` (line 1130-1171) calls `fetch('/api/data' + projectParam)` with no headers. No `If-None-Match`. No 304 handling.
3. **No ETag code anywhere in codebase.** `grep -r "ETag\|If-None-Match" viz/` returns zero matches (only `package-lock.json` has it as a dependency reference).
4. **Polling interval:** Fixed at 5000ms (line 945). No adaptive polling.
5. **`/api/version` returns 404 on TEST** — depends on `active` symlink (line 261-262) which doesn't exist.

### Root Cause

The previous task's QA tests passed but tested mock behavior, not actual deployment. The ETag code was either never written or was lost. The browser trace confirms: 11 rapid full-data fetches with no conditional headers.

### Current Behavior

Every 5 seconds, the client:
1. Fetches full `/api/data?project=all` (all nodes, all DNA, all stations)
2. Computes a client-side hash (`computeDataHash`, line 1105-1107) — string length + node_count + stations count
3. If hash differs from last, re-renders. If same, does nothing but still downloaded the full payload.

The hash comparison avoids unnecessary re-rendering but does NOT avoid the network transfer.

### Design: 2-Part Fix

#### Part 1: Server-Side ETag Support (`viz/server.js`)

Add ETag generation and `If-None-Match` handling to the `/api/data` endpoint.

**Implementation in the `/api/data` handler (lines 184-256):**

After building the response data object (before `sendJson`), compute an ETag:

```javascript
const crypto = require('crypto');

// In the /api/data handler, after building responseData:
const responseBody = JSON.stringify(responseData, null, 2);
const etag = '"' + crypto.createHash('md5').update(responseBody).digest('hex') + '"';

// Check If-None-Match
const ifNoneMatch = req.headers['if-none-match'];
if (ifNoneMatch === etag) {
  res.writeHead(304, {
    'ETag': etag,
    'Access-Control-Allow-Origin': '*'
  });
  res.end();
  return;
}

// Send full response with ETag
res.writeHead(200, {
  'Content-Type': 'application/json',
  'ETag': etag,
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-cache'
});
res.end(responseBody);
```

**Apply to both code paths:**
- `project=all` (merged data, line 218-227)
- Single project (line 248-254)

**Why `Cache-Control: no-cache`:** Tells the browser "always revalidate with server" — the browser will send `If-None-Match` on every request but won't show stale data. This is the correct semantic for live dashboard data.

**Do NOT use `sendJson()`** for the `/api/data` endpoint after this change. The ETag logic needs to control the response directly. Other endpoints continue using `sendJson()`.

#### Part 2: Client-Side Conditional Fetch (`viz/index.html`)

Modify `pollData()` to send `If-None-Match` and handle 304.

**Current `pollData()` (line 1130-1171):**
```javascript
async function pollData() {
  try {
    const response = await fetch('/api/data' + projectParam);
    const data = await response.json();
    // ... hash comparison, re-render
  }
}
```

**New `pollData()`:**
```javascript
let lastEtag = null;

async function pollData() {
  try {
    const projectParam = currentProject ? `?project=${currentProject}` : '';
    const headers = {};
    if (lastEtag) {
      headers['If-None-Match'] = lastEtag;
    }

    const response = await fetch('/api/data' + projectParam, { headers });

    // 304 Not Modified — data unchanged, skip processing
    if (response.status === 304) {
      liveDot.classList.remove('error');
      return;
    }

    const data = await response.json();

    // Store ETag for next request
    const newEtag = response.headers.get('ETag');
    if (newEtag) {
      lastEtag = newEtag;
    }

    // Existing hash comparison + re-render logic (lines 1136-1164)
    const newHash = computeDataHash(data);
    if (newHash !== lastDataHash) {
      // ... existing re-render code unchanged
    }

    liveDot.classList.remove('error');
  } catch (error) {
    console.error('Poll failed:', error);
    liveDot.classList.add('error');
  }
}
```

**Key points:**
- `lastEtag` stored in JS variable (not localStorage — resets on page reload, which is correct)
- First fetch has no `If-None-Match` (full download)
- Subsequent fetches send `If-None-Match` and get 304 if data unchanged
- The client-side hash comparison (`computeDataHash`) is kept as a safety net but will rarely trigger since ETag catches changes first

### Out of Scope

- **Adaptive polling (5s→30s):** The DNA mentions this from the previous task but the core problem is full downloads on every poll. ETag/304 solves the bandwidth issue. Adaptive polling is a nice-to-have for a separate task.
- **`/api/version` 404:** The `active` symlink doesn't exist on TEST. This is a deployment issue, not a code bug. `checkForUpdate()` is called once on load and silently catches the error. Low impact.
- **WebSocket:** Would eliminate polling entirely but is a larger architectural change. ETag is the minimal fix.

### Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | Add `require('crypto')` at top. Add ETag generation + `If-None-Match` handling to both `/api/data` code paths. |
| `viz/index.html` | Add `lastEtag` variable. Modify `pollData()` to send `If-None-Match` header and handle 304. |

### Verification Plan

1. **Server ETag:** `curl -s -I http://10.33.33.1:4200/api/data?project=all` shows `ETag:` header
2. **304 response:** `curl -s -I -H 'If-None-Match: "<etag-value>"' http://10.33.33.1:4200/api/data?project=all` returns 304
3. **Client sends If-None-Match:** Chrome DevTools Network tab shows `If-None-Match` header on poll requests after first load
4. **304 in browser:** Subsequent polls show 304 status (not 200) when data hasn't changed
5. **Change detection still works:** Modify a task via CLI, next poll returns 200 with new ETag and updated data

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
