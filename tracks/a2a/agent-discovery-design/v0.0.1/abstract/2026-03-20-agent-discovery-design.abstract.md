# Completion Abstract: .well-known/agent.json A2A Discovery

**Task:** agent-discovery-design
**Status:** complete
**Date:** 2026-03-20
**Author:** LIAISON

## Outcome
.well-known/agent.json endpoint implemented in Hive as Fastify route. Follows Google A2A spec with xpo extensions. Lists 5 capabilities, bearer auth, endpoint URLs, and related_services for ecosystem linking.

## Changes Made
- Hive Fastify route for `/.well-known/agent.json`
- A2A spec structure with agent name, capabilities, auth description
- Related services linking to Mindspace agent card

## Key Decisions
- A2A spec + xpo extensions (not pure spec) — enables Hive-specific capabilities
- Both Hive and Mindspace endpoints listed
- Note: xpollination-hive repo archived — commits local only until unarchived

## Learnings
- Archived repos block git push — implementation is local only until repo is unarchived
