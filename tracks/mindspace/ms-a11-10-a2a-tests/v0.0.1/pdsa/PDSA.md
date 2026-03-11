# PDSA: A2A Protocol Integration Tests

**Task:** ms-a11-10-a2a-tests
**Version:** v0.0.1
**Status:** Design

## Plan

### Goal

End-to-end integration test covering the full A2A agent lifecycle: connect, receive WELCOME, receive TASK_AVAILABLE, claim task, send heartbeat, transition task, receive TASK_APPROVED, disconnect.

### Existing A2A Endpoints

- `POST /api/projects/:slug/a2a/connect` — Agent connects, receives WELCOME response with session_id
- `POST /api/projects/:slug/a2a/message` — Agent sends messages (HEARTBEAT, CLAIM_TASK, TRANSITION)
- `GET /api/projects/:slug/a2a/stream` — SSE stream for agent events (TASK_AVAILABLE, TASK_APPROVED, LEASE_WARNING, etc.)
- `POST /api/projects/:slug/tasks/:taskId/claim` — Task claiming endpoint
- `POST /api/projects/:slug/tasks/:taskId/transition` — Task transition endpoint

### Test Design

Single test file: `api/__tests__/ms-a11-10-a2a-lifecycle.test.ts`

#### Test 1: Connect and receive WELCOME
- POST `/a2a/connect` with agent_name, role
- Assert 200 response with `type: 'WELCOME'`, session_id, agent_id

#### Test 2: SSE stream receives TASK_AVAILABLE
- Open SSE stream (`/a2a/stream`)
- Create a task with `role: pdsa` and `status: ready`
- Assert SSE emits `TASK_AVAILABLE` event for the new task

#### Test 3: Claim task via message
- POST `/a2a/message` with `type: CLAIM_TASK, task_id`
- Assert task status changes to `active`
- Assert lease is created for the agent

#### Test 4: Heartbeat keeps lease alive
- POST `/a2a/message` with `type: HEARTBEAT`
- Assert lease `expires_at` is extended
- Assert `warning_sent` reset to 0

#### Test 5: Transition via message
- POST `/a2a/message` with `type: TRANSITION, task_id, to_status: review`
- Assert task status changes to `review`

#### Test 6: TASK_APPROVED via SSE
- Create an approval_request for the task
- Approve it via `PUT /approval-requests/:id/approve`
- Assert SSE stream receives `TASK_APPROVED` event

#### Test 7: Disconnect cleans up
- Close SSE stream
- Assert agent status changes from `active` to `disconnected`

### Test Infrastructure

Use supertest for HTTP calls. For SSE, use EventSource mock or raw HTTP request with chunked transfer parsing. Each test uses a fresh test database (existing test setup pattern).

### Files to Create

1. `api/__tests__/ms-a11-10-a2a-lifecycle.test.ts` — CREATE: 7 integration tests

### Notes

- CLAIM_TASK and TRANSITION handlers are currently stubs in `a2a-message.ts`. Tests should verify the stub response pattern (acknowledgment) and may require real handler implementation if stubs don't actually process the message.
- If stubs are confirmed, tests document expected behavior and will drive implementation.

## Do

Implementation by DEV agent (or QA for test-first approach).

## Study

- All 7 tests define expected A2A lifecycle behavior
- Tests pass with real handlers or document stub gaps
- SSE stream tests are reliable (no flaky timing issues)

## Act

Run full test suite on TEST (:4200) to validate A2A lifecycle.
