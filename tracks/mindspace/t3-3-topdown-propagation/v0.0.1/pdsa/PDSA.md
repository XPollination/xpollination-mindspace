# PDSA: Top-down Suspect Propagation

**Task:** t3-3-topdown-propagation
**Version:** v0.0.1
**Status:** Design
**Depends on:** t3-1-requirement-changed-broadcast (complete), t3-2-suspect-link-table (complete)

## Plan

When a requirement changes version, find all attestations referencing it and create suspect links. Old attestations (validated against previous version) become invalid. Downstream code and tests that rely on those attestations need re-verification.

### Trigger

`REQUIREMENT_CHANGED` SSE event from t3-1, containing:
```json
{
  "type": "REQUIREMENT_CHANGED",
  "req_id": "REQ-TRACE-001",
  "project_slug": "xpollination-mcp-server",
  "old_version": "v0.0.6",
  "new_version": "v0.0.7",
  "suspect_scope": ["attestation", "test", "code"]
}
```

### Design (2 files)

#### 1. Top-down propagation service (api/services/topdown-propagation.ts)

New service:

```ts
export function propagateRequirementChange(params: {
  req_id: string;          // requirement identifier
  project_slug: string;
  old_version: string;
  new_version: string;
  suspect_scope: string[]; // which artifact types to mark suspect
}): PropagationResult

interface PropagationResult {
  invalidated_attestations: number;
  suspect_links_created: number;
  affected_tasks: string[];    // task slugs with now-invalid attestations
}
```

**Logic:**
1. Find all valid attestations (`valid=1`) for tasks in this project whose DNA `requirement_refs` includes `req_id`
2. For each attestation found:
   a. Set `valid = 0` (invalidated — verified against old version)
   b. Create suspect link for each scope type:
      - `source_type='requirement', source_ref=req_id, target_type='attestation', target_ref=attestation_id`
      - If `suspect_scope` includes 'test': find test_refs from attestation and create `requirement→test` suspect links
      - If `suspect_scope` includes 'code': find code refs from task and create `requirement→code` suspect links
3. Return counts and affected task slugs

#### 2. SSE listener integration (api/services/topdown-propagation.ts)

Export a handler function that can be registered as an SSE event listener:

```ts
export function handleRequirementChanged(event: RequirementChangedEvent): void {
  const result = propagateRequirementChange({
    req_id: event.req_id,
    project_slug: event.project_slug,
    old_version: event.old_version,
    new_version: event.new_version,
    suspect_scope: event.suspect_scope
  });
  // Log propagation result
}
```

Register this handler in the SSE event processing pipeline.

### Endpoint

```
POST /api/projects/:slug/propagation/requirement-change
Body: { req_id, old_version, new_version, suspect_scope? }
Response: PropagationResult
```

Manual trigger for cases where SSE event was missed or for batch re-processing.

### Files to Create/Change

1. `api/services/topdown-propagation.ts` — CREATE: propagation logic + SSE handler
2. `api/routes/propagation.ts` — UPDATE: add requirement-change endpoint (shares route file with t3-4)

### No Migration Needed

Uses existing tables: `attestations`, `suspect_links`. Queries task DNA for `requirement_refs`.

## Do

Implementation by DEV agent.

## Study

- Verify requirement change invalidates all related attestations
- Verify suspect links created for each scope type
- Verify affected_tasks list is correct
- Verify no-op when no attestations reference the requirement
- Verify SSE handler integration

## Act

Combined with t3-4 (bottom-up), this completes bidirectional traceability propagation.
