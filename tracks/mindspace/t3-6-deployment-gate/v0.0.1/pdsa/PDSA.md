# PDSA: Deployment Gate — All Suspects Cleared = Release Possible

**Task:** t3-6-deployment-gate
**Version:** v0.0.1
**Status:** Design

## Plan

### Goal

Block release sealing while unresolved suspect links exist. A release can only be sealed when all suspect links in the project are cleared or accepted_risk. Provide a readiness check endpoint and integrate with the existing seal workflow.

### Existing Infrastructure

- **Releases**: `releases` table + `releases.ts` routes. `POST /:releaseId/seal` seals a release (requires 'testing' status, creates git tag)
- **Suspect links**: `suspect_links` table with statuses: `suspect`, `cleared`, `accepted_risk`
- **Suspect stats**: `GET /suspect-links/stats` returns counts by status

### Design

#### 1. Deployment Readiness Check

New endpoint `GET /api/projects/:slug/deployment-readiness`:

```ts
// Response
{
  ready: boolean,
  suspect_links: {
    total: number,
    suspect: number,      // unresolved — blocks deployment
    cleared: number,
    accepted_risk: number
  },
  blocking_reason: string | null  // e.g., "3 unresolved suspect links"
}
```

#### 2. Gate in Release Seal Endpoint

Enhance `POST /:releaseId/seal` to check suspect links before allowing seal:

```ts
// Before sealing, check for unresolved suspects
const unresolved = db.prepare(
  "SELECT COUNT(*) as count FROM suspect_links WHERE project_slug = ? AND status = 'suspect'"
).get(slug);

if (unresolved.count > 0) {
  return res.status(409).json({
    error: `Cannot seal: ${unresolved.count} unresolved suspect link(s). Clear all suspects before sealing.`,
    suspect_count: unresolved.count
  });
}
```

#### 3. Feature Flag

Add a `deployment_gate_enabled` feature flag (default: true) so the gate can be bypassed during development if needed:

```ts
const gateEnabled = db.prepare(
  "SELECT value FROM feature_flags WHERE key = 'deployment_gate_enabled'"
).get();

if (gateEnabled?.value !== 'false') {
  // enforce suspect link check
}
```

### Files to Change

1. `api/routes/releases.ts` — UPDATE: Add suspect link gate to seal endpoint
2. `api/routes/projects.ts` — UPDATE: Add `GET /:slug/deployment-readiness` endpoint
3. `api/db/migrations/033-deployment-gate-flag.sql` — CREATE: Seed feature flag

### Out of Scope

- Dashboard visualization of deployment readiness (t3-7-suspect-viz)
- Automated suspect clearing pipeline

## Do

Implementation by DEV agent.

## Study

- Seal blocked when suspect links exist (409 response)
- Seal succeeds when all suspects cleared/accepted_risk
- Feature flag allows bypass
- Readiness endpoint returns accurate counts

## Act

Test seal with/without suspect links on TEST (:4200).
