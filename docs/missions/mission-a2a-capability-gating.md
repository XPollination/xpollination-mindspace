# A2A Capability-Based Gating — Secure Agent Permissions

**Ref:** MISSION-A2A-CAPABILITY-GATING
**Version:** v1.0.0
**Date:** 2026-04-08
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Active — Phase 1 implemented, Phase 2 designed

---

## Problem

The SSE hard gate used identity-based allowlisting (`is_body`, `name.startsWith('browser-')`). This is insecure — any agent can fake its name or metadata. It also breaks every time a new client type appears.

## Solution: Capability-Based Gating

The server assigns capabilities at connect time based on **auth method** (JWT vs API key). Agents cannot self-assign. Each endpoint checks capability, not identity.

### Phase 1 (implemented)

**Auth method determines capability:**

| Auth | Client declaration | `can_stream` | Who |
|------|-------------------|-------------|-----|
| JWT | (any) | 1 | Browser — user session |
| API key | `xpo-agent` | 1 | A2A body — certified |
| API key | (other) | 0 | Soul, delivery, CLI |

**Security model documented in code:** `api/routes/SECURITY.md`

### Phase 2 (designed, not implemented)

**Per-body tokens for untrusted environments:**

Phase 1 vulnerability: any process with the API key can claim `client='xpo-agent'`. On Thomas's server this prevents mistakes. On Robin's hub with untrusted agents, it's insufficient.

**Design:**
1. `claude-session.sh` generates `BODY_TOKEN` (random, one-time)
2. Passes to `xpo-agent.js` via stdin pipe (not CLI arg, not env)
3. `xpo-agent` holds token in process memory only
4. Sends token at `/a2a/connect` in metadata
5. Server validates against startup-generated secret
6. `can_stream` only if token matches
7. Soul cannot access — different process, no shared memory

**Why stdin:** CLI args visible in `ps aux`. Env vars readable by child processes. Stdin to a specific process is readable only by that process.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Capability-based, not identity-based | Scales without code changes for new client types |
| D2 | Auth method determines capability | JWT = browser (trusted). API key = system (gated). Can't fake auth method. |
| D3 | In-code SECURITY.md | Zero-knowledge: any agent reads one file to understand the model |
| D4 | Phase 2 per-body tokens via stdin | Only secure path for untrusted environments. Process memory isolation. |
