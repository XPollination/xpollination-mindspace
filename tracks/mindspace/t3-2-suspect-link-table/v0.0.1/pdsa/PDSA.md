# PDSA: Suspect Link Table + CRUD Operations

**Date:** 2026-03-11
**Task:** t3-2-suspect-link-table
**Capability:** suspect-traceability
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** t2-2-rules-engine (attestation system)

## Plan

### Problem

When an upstream artifact changes (requirement version update, code refactor), downstream artifacts (tests, attestations, implementations) may be invalidated. There is no structured way to track these "suspect" relationships. Suspect links connect source changes to potentially affected targets, enabling impact analysis and targeted re-validation.

### Evidence

1. **Task DNA** — "SQLite table for suspect links: source (requirement/code/test/decision), target, reason, status (suspect/cleared/accepted-risk). CRUD operations via interface-cli."
2. **Traceability chain** — requirement → design → code → test → attestation. Any change propagates suspicion downstream.

### Design

#### REQ-SUSPECT-001: Suspect Links Table

```sql
CREATE TABLE suspect_links (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK(source_type IN ('requirement','code','test','decision')),
  source_id TEXT NOT NULL,
  source_version TEXT,
  target_type TEXT NOT NULL CHECK(target_type IN ('requirement','code','test','decision','attestation')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suspect'
    CHECK(status IN ('suspect','cleared','accepted_risk')),
  created_at TEXT DEFAULT (datetime('now')),
  cleared_at TEXT,
  cleared_by TEXT,
  project_slug TEXT NOT NULL
);
CREATE INDEX idx_suspect_source ON suspect_links(source_type, source_id);
CREATE INDEX idx_suspect_target ON suspect_links(target_type, target_id);
CREATE INDEX idx_suspect_status ON suspect_links(status);
CREATE INDEX idx_suspect_project ON suspect_links(project_slug);
```

#### REQ-SUSPECT-002: CRUD Endpoints

- `POST /api/suspect-links` — Create suspect link (auto-created by propagation, or manual)
- `GET /api/suspect-links` — List with filters: ?source_type, ?target_type, ?status, ?project_slug
- `GET /api/suspect-links/:id` — Get single link
- `PUT /api/suspect-links/:id` — Update status (suspect → cleared or accepted_risk)
- `GET /api/suspect-links/stats` — Counts per status per project

#### REQ-SUSPECT-003: Interface CLI Integration

Add `suspect-links` subcommand to interface-cli:
- `node interface-cli.js suspect-links list [--status suspect] [--project slug]`
- `node interface-cli.js suspect-links clear <id> <cleared_by>`

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/db/migrations/031-suspect-links.sql` | CREATE | Suspect links table |
| 2 | `api/routes/suspect-links.ts` | CREATE | CRUD endpoints |
| 3 | `src/db/interface-cli.js` | UPDATE | Add suspect-links subcommand |

### NOT Changed

- Attestation system — unchanged (suspect links are separate tracking layer)
- Task transitions — unchanged (deployment gate t3-6 will use this later)
- Brain API — unchanged

### Risks

1. **Link explosion** — One requirement change could create dozens of suspect links. Acceptable: that's the point — visibility into impact scope.
2. **Stale links** — Links never cleared accumulate. Future: auto-archive after 90 days.

## Do

### File Changes

As described in design. Migration creates table, routes add CRUD, CLI adds subcommand.

## Study

### Test Cases (7)

1. POST creates suspect link with default status 'suspect'
2. GET lists links with status filter
3. PUT clears link (status → cleared, cleared_at set)
4. PUT accepts risk (status → accepted_risk)
5. GET /stats returns counts per status
6. CLI `suspect-links list` outputs formatted table
7. CLI `suspect-links clear` updates status

## Act

- Suspect links table → foundation for traceability chain
- Combined with REQUIREMENT_CHANGED broadcast (t3-1) → auto-create suspect links on change
- Combined with top-down propagation (t3-3) → full impact analysis
- Future: viz dashboard showing suspect link graph
