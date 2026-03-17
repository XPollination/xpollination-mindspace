# PDSA: A2A Agent Onboarding — API Key to Connected Agent

**Task:** ms-a2a-agent-onboarding
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 Phase 7 verification

## Problem

No verified end-to-end flow from user getting API key to agent appearing in Viz and working tasks. Robin needs a Getting Started guide.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Verify full flow: API key → recovery → A2A connect → Viz → claim → work | E2E validation |
| D2 | Document env vars: BRAIN_API_KEY, BRAIN_API_URL, MINDSPACE_URL | Agent configuration |
| D3 | Document skill setup: /xpo.claude.monitor one-command start | Simplest onboarding |
| D4 | Create Getting Started guide for Robin | First external user |
| D5 | Test with Robin's brain API key (separate from Thomas) | Verify multi-user works |

### Acceptance Criteria

- AC1: Recovery endpoint works with Robin's API key
- AC2: A2A connect works with Robin's credentials
- AC3: Robin's agent appears in Viz agent bar
- AC4: Robin's agent can claim and work a task
- AC5: Getting Started guide documents the full flow
- AC6: One-command agent start: `/xpo.claude.monitor <role>`

### Deliverables

- Getting Started guide (markdown)
- E2E test results documenting each step

### Test Plan

1. Create Robin's user account via invite
2. Robin gets API key from /settings
3. Configure agent with env vars
4. Run /xpo.claude.monitor → verify recovery + A2A connect
5. Verify agent in Viz → claim task → complete task

## Do / Study / Act

(To be completed)
