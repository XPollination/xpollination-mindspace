# PDSA: Harvest Status Tracking

**Date:** 2026-03-11
**Task:** ms-a15-3-harvest-tracking
**Capability:** marketplace-community
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a15-1-community-needs (community needs endpoint)

## Plan

### Problem

Community feature requests have no lifecycle tracking. Once submitted, there's no way to know if a need was considered, planned, implemented, or declined. This makes the community needs endpoint a black hole — input goes in, no status comes out.

### Evidence

1. **Task DNA** — "Migration: community_needs table. Track lifecycle: unharvested/under_consideration/planned/implemented/declined."
2. **GET /community-needs** — queries brain for raw thoughts, no lifecycle state.

### Design

#### REQ-HARVEST-001: Community Needs Table

SQLite migration creating `community_needs` table:
```sql
CREATE TABLE community_needs (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  brain_thought_id TEXT,
  status TEXT NOT NULL DEFAULT 'unharvested'
    CHECK(status IN ('unharvested','under_consideration','planned','implemented','declined')),
  task_id TEXT,
  declined_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_community_needs_topic ON community_needs(topic);
CREATE INDEX idx_community_needs_status ON community_needs(status);
```

#### REQ-HARVEST-002: CRUD Endpoints

- `POST /api/marketplace/community-needs` — Create tracked need (from brain thought or manual)
- `GET /api/marketplace/community-needs` — List with filters: ?status, ?topic
- `PUT /api/marketplace/community-needs/:id` — Update status, link task_id when planned
- `GET /api/marketplace/community-needs/stats` — Counts per status

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/db/migrations/027-community-needs.sql` | CREATE | Community needs table |
| 2 | `api/routes/marketplace-community.ts` | UPDATE | Add CRUD endpoints for tracked needs |

### NOT Changed

- Brain-based community needs query — still available for raw discovery
- Marketplace matching, announcements, requests — unchanged

### Risks

1. **Dual source** — Brain has raw thoughts, DB has tracked needs. May diverge. Acceptable: DB is the lifecycle tracker, brain is the discovery channel.

## Do

### File Changes

As described in design. Migration creates table, routes add CRUD with status transitions.

## Study

### Test Cases (6)

1. POST creates community need with default status 'unharvested'
2. GET lists needs with status filter
3. PUT updates status (e.g., unharvested → under_consideration)
4. PUT with task_id links need to implementation task
5. GET /stats returns count per status
6. Invalid status value returns 400

## Act

- Lifecycle tracking → community sees their needs are being processed
- Stats endpoint → dashboard can show pipeline health
- Future: auto-create community_need when brain thought submitted with feature_request category
