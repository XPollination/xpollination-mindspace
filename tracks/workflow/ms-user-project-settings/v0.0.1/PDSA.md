# PDSA: Per-User Per-Project Settings (Approval Mode Scoping)

**Task:** ms-user-project-settings
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-003 Phase 2

## Problem

liaison_approval_mode is a global singleton in system_settings. Multi-user (Thomas+Robin) and multi-project need scoped settings. Users' preferences conflict.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | New table: user_project_settings (user_id, project_slug, key, value) | Per-user per-project scoping |
| D2 | Fallback chain: user+project → user default → project default → system default (auto) | Sensible defaults, no broken states |
| D3 | GET/PUT /api/settings/:key becomes scope-aware (reads auth user + selected project) | Existing endpoint evolves |
| D4 | Viz approval mode dropdown applies to logged-in user + selected project | Each user sees their own setting |
| D5 | Workflow engine reads scoped setting for transitioning liaison + project | Correct per-decision scoping |
| D6 | Generic key/value design for future settings | Extensible for notifications, display options |
| D7 | Migration: existing system_settings value → Thomas's user_project_settings | Preserve current config |

### Acceptance Criteria

- AC1: user_project_settings table exists with user_id, project_slug, key, value
- AC2: GET /api/settings/liaison-approval-mode returns scoped setting for authenticated user
- AC3: PUT /api/settings/liaison-approval-mode saves per-user per-project
- AC4: Fallback chain works (user+project → user → project → system)
- AC5: Viz shows user's own setting, not global
- AC6: Workflow engine reads scoped setting during liaison transitions
- AC7: Thomas's existing setting migrated

### Files to Change

- Migration — Create user_project_settings table, migrate existing data
- `api/routes/settings.ts` — Scope-aware GET/PUT
- `src/db/workflow-engine.js` or transition handler — Read scoped setting
- `viz/server.js` — Proxy scoped settings

## Do / Study / Act

(To be completed)
