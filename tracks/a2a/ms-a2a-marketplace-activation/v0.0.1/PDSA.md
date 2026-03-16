# PDSA: A2A Protocol + Marketplace Activation

**Task:** ms-a2a-marketplace-activation
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.17 Phase 5

## Problem

A2A and Marketplace routes exist and are deployed but untested on PROD. Need smoke tests to validate each endpoint works.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Smoke test each endpoint: /a2a/stream, /a2a/connect, /a2a/message, /.well-known/agent.json | Verify response format and auth |
| D2 | Test marketplace: /api/marketplace/announcements, /api/marketplace/requests | CRUD operations |
| D3 | Test brain integration: /api/brain | Endpoint exists, needs validation |
| D4 | Test A2A stream with real agent connection | SSE streaming validation |
| D5 | Document any broken endpoints in DNA findings | Capture issues for follow-up |
| D6 | Enable verified endpoints (may already be enabled) | Formal activation |

### Acceptance Criteria

- AC1: /.well-known/agent.json returns valid Agent Card
- AC2: /a2a/stream returns SSE connection
- AC3: /api/marketplace/announcements CRUD works
- AC4: /api/marketplace/requests CRUD works
- AC5: All broken endpoints documented with fix requirements
- AC6: Test results in DNA findings

### Test Plan

1. curl each endpoint → verify response code and format
2. SSE stream connection test
3. Marketplace CRUD cycle (create, read, delete)

## Do / Study / Act

(To be completed)
