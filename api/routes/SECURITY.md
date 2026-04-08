# A2A Security Model — Capability-Based Gating

## Read this first

This file documents HOW and WHY the A2A server assigns capabilities to agents.
If you're modifying `a2a-connect.ts`, `a2a-stream.ts`, or `a2a-message.ts` — read this.

## Capabilities

| Capability | What it allows | Set in | Checked in |
|-----------|---------------|--------|-----------|
| `can_stream` | Open SSE stream at `/a2a/stream` | `a2a-connect.ts` | `a2a-stream.ts` |

## How capabilities are assigned

Capabilities are set **SERVER-SIDE** at connect time (`/a2a/connect`).
Agents **CANNOT** self-assign capabilities. The server decides based on:

1. **Auth method** (JWT vs API key) — determined by `authenticateIdentity()`
2. **Client declaration** (`metadata.client`) — only meaningful with API key auth

| Auth method | Client declaration | `can_stream` | Why |
|------------|-------------------|-------------|-----|
| JWT | (any) | 1 | Browser user session. UI needs real-time updates. |
| API key | `'xpo-agent'` | 1 | Certified A2A body. Manages SSE for its LLM soul. |
| API key | (anything else) | 0 | CLI agent, delivery script, soul. Must not open SSE. |

## Architecture: Body vs Soul

```
Body (xpo-agent.js)          Soul (Claude / any LLM)
  ✓ can_stream = 1             ✗ can_stream = 0
  ✓ Opens SSE                  ✗ Cannot open SSE
  ✓ Receives events            ✓ Receives events via tmux
  ✓ Sends heartbeats           ✗ No heartbeats
  ✗ Never thinks               ✓ Does all the work
```

The body delivers events to the soul via `tmux send-keys`. The soul delivers results via `scripts/a2a-deliver.js` (temporary connect → deliver → disconnect).

## Why souls can't stream

If the soul opens its own SSE stream, it bypasses the body's event management and creates duplicate/conflicting event handling. The hard gate at `/a2a/stream` prevents this with an instructive error message that teaches the agent the correct path.

## Task creation gates

In `a2a-message.ts`, `OBJECT_CREATE` for tasks enforces:
- `role` must be `pdsa` or `liaison` (PDSA Design Path)
- DNA must include: `title`, `description`, `acceptance_criteria`
- `description` must be ≥100 chars (self-contained)

## Phase 2: Per-body tokens (not yet implemented)

**Current vulnerability:** Any process with the API key can claim `client='xpo-agent'` and get `can_stream`. On a single-user server this is acceptable — we're preventing well-intentioned mistakes, not adversarial attacks.

**For multi-hub (Robin's server, untrusted agents):**

1. `claude-session.sh` generates a one-time `BODY_TOKEN` at launch
2. Passes it to `xpo-agent.js` via stdin (not CLI arg, not env — process memory only)
3. `xpo-agent` sends `BODY_TOKEN` in connect metadata
4. Server validates against a startup-generated secret
5. `can_stream` only granted if token matches
6. Souls can't read another process's memory — token is inaccessible

**Design:** See `docs/missions/mission-a2a-capability-gating.md`
