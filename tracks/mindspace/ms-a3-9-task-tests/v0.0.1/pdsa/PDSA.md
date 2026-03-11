# PDSA: Task Management Integration Tests

**Task:** ms-a3-9-task-tests
**Version:** v0.0.1
**Status:** Design
**Depends on:** ms-a3-6-heartbeat (complete), ms-a3-7-voluntary-release (complete), ms-a3-8-task-filters (complete), t1-3-repos-bootstrap (complete)

## Plan

Integration test suite covering the full task management lifecycle: claim → lease → heartbeat → release/expiry. Individual component tests exist (ms-a3-1 through ms-a3-8). This test validates cross-component flows.

### Test File

`viz/ms-a3-9-task-tests.test.ts`

### Test Cases (12 tests)

#### Lifecycle Tests (4)
1. **Claim lifecycle**: POST claim → verify claimed_by set + lease created → DELETE unclaim → verify cleared
2. **Claim + heartbeat + unclaim**: claim → heartbeat renews lease → unclaim releases lease
3. **Claim + voluntary release**: claim → release with reason → verify task unclaimed + lease expired + broadcast
4. **Full flow: claim → heartbeat → complete**: claim → heartbeat → transition to review → verify lease auto-closed

#### Lease Tests (3)
5. **Lease created on claim**: verify lease record exists with correct role-based duration (pdsa:4h, dev:6h, qa:3h, liaison:2h)
6. **Lease expiry unclaims task**: claim → manually expire lease → verify task unclaimed + TASK_AVAILABLE broadcast
7. **Concurrent claim rejected**: agent A claims → agent B claims same task → verify 409 conflict

#### Heartbeat Tests (3)
8. **Heartbeat renews lease**: claim → heartbeat → verify lease expires_at extended
9. **Heartbeat requires brain_thought_id**: heartbeat without brain_thought_id → verify 400
10. **Heartbeat on unclaimed task**: heartbeat on task not claimed by user → verify 403

#### Filter Tests (2)
11. **Filter by status**: create tasks with different statuses → GET with status filter → verify correct results
12. **Filter by role**: create tasks with different roles → GET with role filter → verify correct results

### Implementation Notes

- Tests use the existing viz test infrastructure (vitest + supertest or direct HTTP)
- Each test creates its own test data (task, project, user) for isolation
- Lease expiry test may need to manipulate expires_at directly in DB for speed
- Auth: tests use API key or mock JWT per existing patterns

### Files to Create

1. `viz/ms-a3-9-task-tests.test.ts` — integration test file

### Endpoints Under Test

| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/api/projects/:slug/tasks/:taskId/claim` | task-claiming.ts |
| DELETE | `/api/projects/:slug/tasks/:taskId/claim` | task-claiming.ts |
| POST | `/api/tasks/:taskId/heartbeat` | task-heartbeat.ts |
| POST | `/api/tasks/:taskId/release` | task-release.ts |
| GET | `/api/projects/:slug/tasks?status=X` | task-filters (in tasks.ts) |
| GET | `/api/projects/:slug/tasks?role=X` | task-filters (in tasks.ts) |

## Do

Implementation by QA agent (writes tests) → DEV runs them.

## Study

- All 12 tests GREEN
- No test pollution (each test isolated)
- Lease timing tests don't rely on real-time waits

## Act

Merge to develop after GREEN.
