# PDSA: Fix Capability Detail Endpoint Crash

**Task:** `viz-capability-detail-crash`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

Clicking a capability card in Mission Dashboard does nothing. `GET /api/capabilities/:capId` returns `{"error":"Capability not found"}` even when the capability exists.

**Root cause:** In v0.0.23 `server.js` lines 280-286, the requirements query JOINs `capability_requirements → requirements`. The `requirements` table does not exist in the database. `SqliteError: no such table: requirements` is thrown inside the inner try block (line 275). The catch at line 325 swallows it, skipping the `sendJson` response at line 311. Execution falls through to the 404 response at line 329.

The capability WAS found (line 278), but the error occurs after the `cap` lookup and before `sendJson`, so the valid response never sends.

### Design Decision

**D1: Wrap the requirements query in its own try/catch, defaulting to empty array.**

This is graceful degradation — capability detail works even without a requirements table. The requirements table will be created later when that feature is needed. No schema changes required now.

### Fix (v0.0.24 server.js)

```javascript
// BEFORE (lines 280-286):
const requirements = db.prepare(
  `SELECT r.id, r.req_id_human, r.title, r.status, r.priority
   FROM capability_requirements cr
   JOIN requirements r ON r.id = cr.requirement_ref
   WHERE cr.capability_id = ?
   ORDER BY r.req_id_human ASC`
).all(capId);

// AFTER:
let requirements = [];
try {
  requirements = db.prepare(
    `SELECT r.id, r.req_id_human, r.title, r.status, r.priority
     FROM capability_requirements cr
     JOIN requirements r ON r.id = cr.requirement_ref
     WHERE cr.capability_id = ?
     ORDER BY r.req_id_human ASC`
  ).all(capId);
} catch (e) { /* requirements table may not exist yet */ }
```

### Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.24/server.js` | Wrap requirements query in try/catch (lines 280-286) |

### Verification Plan

1. `curl /api/capabilities/:capId` returns valid JSON with capability data (not 404)
2. `requirements` field is `[]` (empty array, since table doesn't exist)
3. Tasks, mission context, breadcrumb still work correctly
4. No regression on mission-overview endpoint

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
