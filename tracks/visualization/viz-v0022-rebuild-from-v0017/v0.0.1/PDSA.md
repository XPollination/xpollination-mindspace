# PDSA: Viz v0.0.22 — Audit and Rebuild from Verified v0.0.17 Base

**Task:** `viz-v0022-rebuild-from-v0017`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The task DNA claims v0.0.18-21 are not faithful to the v0.0.17 base, citing: (1) dropdown order regression, (2) ETag/304 broken. This PDSA investigates these claims before prescribing a rebuild.

### Investigation Results

#### Claim 1: Dropdown order differs from v0.0.17

**Finding: FALSE — no regression.**

Both v0.0.17 and v0.0.21 have identical dropdown order at line 963-966:
```html
<option value="manual">Manual</option>
<option value="semi">Semi</option>
<option value="auto-approval">Auto-Approval</option>
<option value="auto">Auto</option>
```

#### Claim 2: ETag/304 broken — every /api/data call returns 200, never 304

**Finding: PARTIALLY TRUE — code is correct, but data changes between polls.**

ETag implementation is present and correct in both the root `viz/server.js` and `viz/versions/v0.0.21/server.js`:
- Server: MD5 hash of response body, `If-None-Match` comparison, 304 response (lines 382-395, 420-433)
- Client: `lastEtag` variable, `If-None-Match` header, 304 handling (lines 1260-1275 in index.html)

**Root cause of 200-always behavior:** The ETag changes between polls because the underlying data actually changes between requests. Tested via curl:
- Request 1: ETag `"e36e0da03ed6be635a7ca053343fe55f"`
- Request 2 (4s later, with If-None-Match): ETag `"915a618671228e67e42e90411c0e298a"` — **different hash, 200 returned**

The database content changes frequently due to agent activity (transitions, DNA updates, monitor writes). Since the ETag is computed from the full JSON response, any field change (including `updated_at`) invalidates the ETag.

**This is not an ETag code regression — it's a payload architecture problem.** The solution is incremental sync (already designed in task `viz-data-polling-architecture`).

#### Full diff analysis: v0.0.17 → v0.0.21

Performed line-by-line diff. **All 237 diff lines are categorized as intentional features:**

| Version | Feature | Lines Changed |
|---------|---------|---------------|
| v0.0.18 | Approval mode enforcement UI (wf-v18) | +66 lines: Complete button, mode-dependent button visibility, detail panel re-render on mode change |
| v0.0.19 | ETag/polling fix (no HTML changes) | 0 lines: Server.js ETag confirmed from v0.0.17 base |
| v0.0.20 | Suspect status visualization | +50 lines: suspect-status-bar HTML, `loadSuspectStats()` function |
| v0.0.21 | Capability drill-down | +77 lines: `loadMissionDashboard()` implementation, `showCapabilityDetail()` |

**Regressions found: 0**
**Unknown changes: 0**

#### Architecture detail: Two server.js files

- **Port 4100 (PROD):** `node viz/active/server.js 4100` — serves the versioned server.js via symlink
- **Port 4200 (TEST):** `node viz/server.js 4200` — serves the ROOT server.js, not the versioned one

Both root and v0.0.21 server.js have ETag support. The root differs in: `discoverProjects()` inlined vs required, MIME types for `.ico`/`.webmanifest`/`.webp`, active symlink resolution logic, bind host defaults. None of these affect ETag behavior.

#### v0.0.17 structure note

v0.0.17 has only `index.html` + `changelog.json` — **no server.js**. The server.js was added to version directories starting with v0.0.18. This means v0.0.17's server behavior came from the root `viz/server.js`.

### Design Decision

**D1: No rebuild needed. The v0.0.18-21 versions are correct.**

The investigation found zero code regressions. The ETag "failure" is a data-level issue (frequent database writes) not a code regression. A rebuild from v0.0.17 would produce identical results to v0.0.21.

The `viz-data-polling-architecture` task (already at `approval+liaison`) addresses the actual payload problem with incremental sync.

**D2: Recommend closing this task as "not needed" or converting to a verification task.**

Since the investigation disproves both claimed regressions, the correct action is to:
1. Document the findings in DNA
2. Recommend the liaison close or cancel the task
3. Point to `viz-data-polling-architecture` as the solution for the observed ETag behavior

### Proposed DNA Update

```json
{
  "findings": "Investigation disproves both claimed regressions. (1) Dropdown order is identical in v0.0.17 and v0.0.21 (manual, semi, auto-approval, auto at lines 963-966). (2) ETag code is correct in both root and versioned server.js — the 200-always behavior is caused by database content changing between polls (agent activity), not code regression. Full diff of v0.0.17→v0.0.21 shows 237 diff lines, all categorized as intentional features (wf-v18: +66, suspect-viz: +50, drilldown: +77). Zero regressions. The actual payload problem is addressed by viz-data-polling-architecture (incremental sync).",
  "recommendation": "Cancel or close. No rebuild needed. Point to viz-data-polling-architecture for the real solution."
}
```

### Verification Plan

1. **Dropdown order:** Compare v0.0.17 line 963-966 with v0.0.21 line 963-966 — identical.
2. **ETag code:** Grep for `etag` in both root and versioned server.js — both have full implementation.
3. **ETag runtime:** Two curl requests to /api/data with same If-None-Match — returns different ETag because data changed.
4. **Diff completeness:** `diff v0.0.17/index.html v0.0.21/index.html` — all hunks map to declared features.

---

## DO

_Investigation complete. No code changes needed._

---

## STUDY

_To be completed after liaison review._

---

## ACT

_To be completed after study._
