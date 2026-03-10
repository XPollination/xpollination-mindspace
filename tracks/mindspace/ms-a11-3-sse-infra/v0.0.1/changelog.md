# Changelog: ms-a11-3-sse-infra v0.0.1

## v0.0.1 — 2026-03-10

Initial design for SSE stream infrastructure.

### Changes

1. **New:** `api/lib/sse-manager.ts` — connection manager (addConnection, removeConnection, sendToAgent, broadcast, getConnectedAgents)
2. **New:** `api/routes/a2a-stream.ts` — SSE endpoint at `/a2a/stream/:agent_id` with client disconnect cleanup
3. **Modified:** `api/server.ts` — register SSE stream route
4. **Modified:** `api/routes/health.ts` — add SSE connection count

### Design decisions

- One connection per agent (reconnect replaces old connection)
- 30s heartbeat via SSE comment (`: heartbeat`)
- X-Accel-Buffering: no header for nginx compatibility
- No auth in this layer (deferred to A11.4 connect endpoint)
