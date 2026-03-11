# PDSA: Attestation Version Check

**Task:** t3-5-attestation-version-check
**Version:** v0.0.1
**Status:** Design
**Depends on:** t2-2-rules-engine (complete), t3-2-suspect-link-table (complete)

## Plan

Cross-reference attestation requirement versions against current requirement versions. An attestation made against an old requirement version is automatically invalid. Flag mismatches as suspect.

### Problem

Attestations record `rules_version` but don't track the requirement version they were validated against. When a requirement version changes, existing attestations should be invalidated because they verified against an outdated specification.

### Design (2 changes)

#### 1. Version check service (api/services/attestation-version-check.ts)

New service with two functions:

```ts
// Check if an attestation's requirement version matches current
export function checkAttestationVersion(params: {
  attestation_id: string;
  project_slug: string;
}): VersionCheckResult

interface VersionCheckResult {
  valid: boolean;
  attestation_version: string | null;  // version at time of attestation
  current_version: string | null;       // current requirement version
  mismatch: boolean;
}

// Batch check: scan all valid attestations for a project, flag stale ones
export function scanStaleAttestations(params: {
  project_slug: string;
}): ScanResult

interface ScanResult {
  checked: number;
  invalidated: number;
  suspect_links_created: number;
  details: Array<{
    attestation_id: string;
    task_slug: string;
    attestation_version: string;
    current_version: string;
  }>;
}
```

**Logic for `checkAttestationVersion`:**
1. Load attestation record
2. Get the task's DNA `requirement_refs` array
3. For each requirement ref, compare the attestation's `rules_version` against the requirement's current version (from task DNA `pdsa_ref` version path)
4. Return mismatch=true if versions differ

**Logic for `scanStaleAttestations`:**
1. Query all `valid=1` attestations for the project
2. For each, call `checkAttestationVersion`
3. If mismatch: set `valid=0`, create suspect link (requirement→attestation), return in details

#### 2. Integration into attestation gate (api/services/attestation-gate.ts)

Enhance `checkAttestationGate` to also call `checkAttestationVersion` before allowing a transition:

```ts
// After finding a valid attestation, verify version freshness
const versionCheck = checkAttestationVersion({ attestation_id: attestation.id, project_slug });
if (versionCheck.mismatch) {
  // Invalidate and create suspect link
  return {
    allowed: false,
    reason: `Attestation ${attestation.id} was validated against version ${versionCheck.attestation_version} but current is ${versionCheck.current_version}`
  };
}
```

### Migration: Add req_version Column to Attestations

```sql
ALTER TABLE attestations ADD COLUMN req_version TEXT;
```

When creating an attestation, record the requirement version at that time. This enables version comparison later.

### Files to Create/Change

1. `api/services/attestation-version-check.ts` — CREATE: version check + batch scan
2. `api/services/attestation-gate.ts` — UPDATE: integrate version check
3. `api/db/migrations/030-attestation-req-version.sql` — CREATE: add req_version column

### Endpoint

```
POST /api/projects/:slug/attestations/scan-stale
Response: ScanResult
```

### Tests (QA writes)

- `checkAttestationVersion` returns valid=true when versions match
- `checkAttestationVersion` returns mismatch=true when versions differ
- `scanStaleAttestations` invalidates stale attestations and creates suspect links
- Gate blocks transition when attestation version is stale
- New attestations record req_version

## Do

Implementation by DEV agent.

## Study

- Verify version mismatch creates suspect links
- Verify gate blocks on stale attestation
- Verify scan-stale endpoint returns correct counts
- Verify req_version is recorded on new attestations

## Act

Integrate with t3-3 (top-down propagation) for complete bidirectional traceability chain.
