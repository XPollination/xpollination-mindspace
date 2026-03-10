# Changelog: ms-a11-1-agent-card v0.0.1

## v0.0.1 — 2026-03-10

Initial design for Agent Card discovery endpoint.

### Changes

1. **New:** `api/routes/agent-card.ts` — static Agent Card JSON matching REQ-A2A-001 §4.A2A.6 spec
2. **Modified:** `api/server.ts` — register at `/.well-known/agent.json` (public, no auth)
