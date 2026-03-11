# PDSA: Attestation Rules Configuration Per Project/Capability

**Date:** 2026-03-11
**Task:** t2-3-rules-config
**Capability:** attestation-traceability
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** t2-2-rules-engine (attestation-rules.ts with 4 validators)

## Plan

### Problem

Attestation rules are currently hardcoded in `attestation-rules.ts` with 4 validators (tags_present, refs_valid, tests_tagged, commits_formatted). Every project and capability uses the same rules. Different capabilities may need different required checks — e.g., a documentation capability doesn't need commits_formatted, while a core API capability needs all 4.

### Evidence

1. **Task DNA** — "Configurable rules per project and capability. Rules versioned — agents receive rules_version in ATTESTATION_REQUIRED."
2. **attestation-rules.ts** — has `validateAttestation(db, attestation)` with hardcoded rule chain.

### Design

#### REQ-RULES-CONFIG-001: Rules Configuration Table

```sql
CREATE TABLE attestation_rules (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  capability TEXT,
  rules JSON NOT NULL,
  rules_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_slug, capability)
);
```

`rules` JSON format:
```json
{
  "required": ["tags_present", "refs_valid"],
  "optional": ["tests_tagged", "commits_formatted"]
}
```

#### REQ-RULES-CONFIG-002: CRUD Endpoints

- `GET /api/attestation-rules` — List all rules configs
- `GET /api/attestation-rules/:projectSlug` — Get rules for project (optional ?capability filter)
- `PUT /api/attestation-rules/:projectSlug` — Set/update rules for project+capability (admin)
- Rules versioned: each update increments `rules_version`

#### REQ-RULES-CONFIG-003: Integration with Validator

Update `validateAttestation` to:
1. Look up rules for the task's project + capability
2. If found, use configured rules instead of hardcoded defaults
3. If not found, fall back to all 4 validators (backward compat)
4. Include `rules_version` in validation response

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/db/migrations/029-attestation-rules.sql` | CREATE | Rules configuration table |
| 2 | `api/routes/attestation-rules-config.ts` | CREATE | CRUD endpoints |
| 3 | `api/services/attestation-rules.ts` | UPDATE | Look up per-project rules in validator |

### NOT Changed

- 4 existing validators — unchanged, just selectively applied
- Attestation validate endpoint — unchanged interface
- Attestation message format — unchanged

### Risks

1. **Misconfiguration** — Admin sets empty required rules, all attestations pass. Mitigated: minimum 1 required rule enforced.
2. **Version drift** — Agent attests against old rules_version. Future: reject if rules_version doesn't match.

## Do

### File Changes

As described in design. Migration creates table, routes add CRUD, validator reads config.

## Study

### Test Cases (6)

1. PUT sets rules for project+capability
2. GET returns configured rules
3. Validator uses project-specific rules when configured
4. Validator falls back to defaults when no config exists
5. Rules_version increments on update
6. Empty required array rejected (minimum 1 rule)

## Act

- Per-project rules working → different capabilities have appropriate gates
- Rules versioning → agents know when rules changed
- Future: rules UI in viz dashboard
