# PDSA: Git-Linked Projects — API-Based Project Management

**Task:** ms-git-linked-projects
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.17 Phase 6

## Problem

Projects discovered by filesystem scanning (discover-projects.cjs). Breaks in Docker, doesn't work for remote users. Need API-based project registration by Git URL.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | POST /api/projects with git_url field for registration | API-first, no filesystem dependency |
| D2 | Project stores git_url, clone_path, connection_status | Track registration and health |
| D3 | Viz discovers projects from API (GET /api/projects) | Replace filesystem scanner |
| D4 | agent-monitor.cjs discovers projects from API | Consistent discovery path |
| D5 | Remove workspace volume mount from Docker | Security: container doesn't need host filesystem |
| D6 | Per-project API token grants | Access control for test group |

### Acceptance Criteria

- AC1: POST /api/projects accepts git_url field
- AC2: Projects table has git_url, clone_path, connection_status columns
- AC3: Viz loads project list from API, not filesystem scan
- AC4: agent-monitor.cjs loads projects from API
- AC5: Docker compose has no workspace volume mount
- AC6: Per-project token grants control access

### Files to Change

- `api/routes/projects.ts` — Add git_url to POST
- `viz/server.js` or `viz/discover-projects.cjs` — Replace filesystem scan with API call
- `viz/agent-monitor.cjs` — Replace filesystem scan with API call
- `docker-compose.*.yml` — Remove workspace volume mount
- Migration — Add git_url, clone_path, connection_status to projects table

### Test Plan

1. POST /api/projects with git_url → project created
2. GET /api/projects → includes git_url
3. Viz loads projects from API
4. agent-monitor finds projects via API
5. Docker starts without workspace mount

## Do / Study / Act

(To be completed)
