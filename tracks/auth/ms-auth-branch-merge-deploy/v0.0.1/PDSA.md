# PDSA: Auth Branch Merge + Deploy

**Task:** ms-auth-branch-merge-deploy
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.14 Phase 1

## Problem

After branch consolidation, auth code is on develop. Need to rebuild Docker DEV with auth enabled and validate the full auth flow on port 4201.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Rebuild Docker DEV image from develop branch | Auth code needs to be in the running container |
| D2 | Run E2E auth flow on 4201 (DEV environment) | Validate real deployment, not just tests |
| D3 | Document any deployment issues in DNA findings | Capture operational knowledge for future deploys |
| D4 | Verify login page, invite flow, API auth all work | Full user journey validation in deployed environment |
| D5 | Verify seed data creates Thomas as admin | Bootstrap admin must work on fresh deploy |

### Acceptance Criteria

- AC1: Docker DEV image rebuilt from develop branch with auth code
- AC2: Login page accessible at http://10.33.33.1:4201/login
- AC3: Admin login works with seeded credentials
- AC4: Invite flow works end-to-end
- AC5: API routes protected (401 without auth)
- AC6: Any issues documented in DNA findings

### Test Plan

1. `docker compose build` from develop branch
2. `docker compose up` on DEV environment
3. curl http://10.33.33.1:4201/login → 200 with login page
4. curl http://10.33.33.1:4201/api/data → 401
5. Login with Thomas credentials → JWT cookie → data access

## Do

(DEV agent executes deployment)

## Study

(Deployment validation results)

## Act

(Operational learnings)
