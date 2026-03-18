# PDSA: Hive-Mindspace Bridge — Onboarding Discovery

**Task:** ms-hive-mindspace-bridge
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.20 Phase 7.5

## Problem

Hive onboarding only shows Brain API. Agents need Mindspace A2A endpoint too. Currently agents need two URLs manually configured.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Recovery endpoint response includes `mindspace_url` field | One URL (hive) discovers everything |
| D2 | Hive onboarding page shows full 4-step flow | authenticate → recover → connect Mindspace → claim tasks |
| D3 | Agent only needs hive URL, discovers Mindspace from recovery response | Simplifies agent configuration |
| D4 | mindspace_url configurable via env var on Hive server | Different deployments, different Mindspace URLs |

### Acceptance Criteria

- AC1: GET /api/v1/recovery/{agentId} includes `mindspace_url` in response
- AC2: Hive onboarding page shows 4-step flow
- AC3: mindspace_url configurable via MINDSPACE_URL env var
- AC4: Agent can discover Mindspace endpoint from single Hive URL

### Files to Change

- Brain API recovery endpoint — Add mindspace_url field
- Hive onboarding page — Update flow documentation

## Do / Study / Act

(To be completed)
