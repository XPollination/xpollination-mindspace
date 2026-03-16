# PDSA: E2E Auth Integration Test

**Task:** ms-auth-e2e-integration-test
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 Phase 1

## Problem

Auth features were built per-task but never tested as a complete user journey. Need E2E validation: unauthenticated → login → access data → logout, plus invite flow and error cases.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Test against running Viz+API stack (not mocked) | E2E means real HTTP requests to real server |
| D2 | 12 test scenarios from DNA description | Covers happy path (login, register, invite) and error cases |
| D3 | Use vitest with fetch for HTTP assertions | Consistent with existing test framework |
| D4 | Test runs against DEV environment (4201) or local test server | Not production |
| D5 | QA executes tests after PDSA defines test plan | PDSA defines what to test, QA writes the test code |

### Test Scenarios (from DNA)

| # | Scenario | Expected Result |
|---|----------|-----------------|
| T1 | Open Viz URL unauthenticated | See login page, NOT task data |
| T2 | GET /api/data without token | 401 Unauthorized |
| T3 | GET /api/projects without token | 401 Unauthorized |
| T4 | Open /invite/{code} | See registration form |
| T5 | Register with valid invite | Auto-login, see dashboard with tasks |
| T6 | Check invite consumption | used_by set, invite_count decremented |
| T7 | Logout | Back to login page, /api/data returns 401 |
| T8 | Login with credentials | JWT cookie set, dashboard visible |
| T9 | API key auth for CLI | curl with X-API-Key header works |
| T10 | Invalid invite code | Error message |
| T11 | Expired invite | Error message |
| T12 | Register without invite | Rejected |

### Acceptance Criteria

- AC1: All 12 test scenarios have corresponding test cases
- AC2: Tests run against real HTTP stack (no mocks)
- AC3: Tests are idempotent (can run repeatedly without manual cleanup)
- AC4: Tests produce clear pass/fail output
- AC5: Test file in standard test directory with clear naming

### Files to Create

- `tests/e2e/auth-integration.test.ts` — E2E test suite

### Test Plan

QA writes and executes the test suite defined above.

## Do

(QA agent writes test code)

## Study

(Test results analysis)

## Act

(Lessons learned)
