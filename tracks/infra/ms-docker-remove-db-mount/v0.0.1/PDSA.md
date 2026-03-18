# PDSA: Docker — Remove xpollination.db Volume Mount

**Task:** ms-docker-remove-db-mount
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.15 Phase 1.5c

## Problem

After Viz reads through API only (ms-viz-api-only), the xpollination.db read-only mount in Docker is unnecessary and a security surface. Container should not have direct DB access.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Remove `./data/xpollination.db:/app/data/xpollination.db:ro` from docker-compose.prod.yml | Container no longer needs DB file |
| D2 | Remove same line from docker-compose.dev-standalone.yml | Consistency across environments |
| D3 | Verify container starts without DB mount | No startup failures |
| D4 | Verify Viz loads tasks via API (not direct DB) | Functional validation |
| D5 | Verify DB path inside container returns file-not-found | Security validation |

### Acceptance Criteria

- AC1: docker-compose.prod.yml has no xpollination.db volume mount
- AC2: docker-compose.dev-standalone.yml has no xpollination.db volume mount
- AC3: Container starts successfully without DB file
- AC4: Viz loads task data via API
- AC5: `/app/data/xpollination.db` does not exist inside container

### Files to Change

- `docker-compose.prod.yml` — Remove DB volume mount line
- `docker-compose.dev-standalone.yml` — Remove DB volume mount line

### Test Plan

1. Remove mount lines from both compose files
2. `docker compose build && docker compose up`
3. Verify Viz serves data (loads from API)
4. `docker exec container ls /app/data/` → no xpollination.db

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
