# Agent OAuth Sessions — Device Flow Auth + Session Management

**Ref:** MISSION-AGENT-OAUTH-SESSIONS
**Version:** v1.0.0
**Date:** 2026-04-08
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — design complete, ready for implementation
**Supersedes:** Static API key authentication for agents (.env BRAIN_API_KEY)

---

## Problem Statement

Agents authenticate with a static API key from `.env`. When the key is rotated (via viz settings), the `.env` file is not updated. Agents die silently. Nobody asks for the new key. Nobody updates the file. The `.env` and the database are out of sync.

This doesn't scale:
- Static key = single shared secret for all agents
- Key rotation breaks all agents with no recovery path
- Robin can't use his own identity — he'd need Thomas's API key
- No visibility into which agent sessions are active
- No way to revoke a specific agent's access

---

## Solution: Device Flow OAuth + Session Management

### Authentication: Device Flow

Standard OAuth device flow (RFC 8628). Same pattern as `gh auth login`.

```
Thomas runs:  claude-session a2a-team

Script:       POST /api/auth/device
              → { device_code: "abc123", user_code: "ABCD-1234", 
                  verification_url: "https://mindspace.xpollination.earth/device" }

Script prints: ┌─────────────────────────────────────────────┐
               │  Go to: mindspace.xpollination.earth/device  │
               │  Enter code: ABCD-1234                       │
               └─────────────────────────────────────────────┘

Thomas:       Opens URL on phone/laptop (already logged in)
              Enters code → "Allow Claude Session to connect?" → Allow

Script:       Polls GET /api/auth/device/abc123
              → pending... pending... → { token: "jwt..." }

Script:       JWT received → passes to xpo-agent bodies
              Bodies authenticate with JWT (not API key)
              4 agents start. Done.
```

**Why device flow:**
- Works over SSH (headless server — no browser on Hetzner)
- Thomas approves on ANY device (phone, laptop, tablet)
- Token is per-session, short-lived (24h)
- No static secrets anywhere
- Robin uses the same flow with his own Google login

### Session Management: Settings Tab

The viz settings tab shows active agent sessions:

```
┌──────────────────────────────────────────────────────────────┐
│  Active Agent Sessions                                       │
├──────────┬──────────┬─────────────┬──────────┬──────────────┤
│  Role    │  Body    │  Connected  │  Expires │  Action      │
├──────────┼──────────┼─────────────┼──────────┼──────────────┤
│  LIAISON │  online  │  18:40 CET  │  23h     │  [Disconnect]│
│  PDSA    │  online  │  18:40 CET  │  23h     │  [Disconnect]│
│  DEV     │  online  │  18:40 CET  │  23h     │  [Disconnect]│
│  QA      │  online  │  18:40 CET  │  23h     │  [Disconnect]│
├──────────┴──────────┴─────────────┴──────────┴──────────────┤
│  [Disconnect All]                          [Rotate Session]  │
└──────────────────────────────────────────────────────────────┘
```

- **Disconnect** → revokes the session token → body gets 401 → exits cleanly
- **Disconnect All** → kills all agent sessions
- **Rotate Session** → issues new tokens, invalidates old ones

### What This Replaces

| Before | After |
|--------|-------|
| `.env` BRAIN_API_KEY (static) | OAuth device flow (per-session) |
| Key rotation breaks agents silently | Token revocation disconnects cleanly |
| One key for all agents | Per-user tokens (Thomas, Robin, each have own) |
| No visibility | Settings tab shows active sessions |
| No revocation | Disconnect button per agent |
| Robin needs Thomas's key | Robin logs in with his own Google account |

---

## Architecture

```
claude-session.sh
  │
  ├─ POST /api/auth/device → device_code + user_code
  ├─ Print verification URL + code
  ├─ Poll GET /api/auth/device/{code} until approved
  ├─ Receive JWT
  │
  ├─ Start xpo-agent bodies with JWT (not API key):
  │   xpo-agent.js --role pdsa --token $JWT
  │
  └─ xpo-agent.js:
      ├─ POST /a2a/connect with Authorization: Bearer $JWT
      ├─ Server sees JWT → auth.method = 'jwt' → can_stream = 1
      ├─ Write JWT to /tmp/xpo-agent-{role}.env (for a2a-deliver.js)
      └─ a2a-deliver.js reads JWT from env file → authenticates as the user
```

### Token Lifecycle

```
Device flow → JWT issued (24h TTL)
  → Body connects with JWT → can_stream = 1
  → Body writes JWT to env file → deliver script reads it
  → Token expires after 24h → body gets 401 → exits
  → Thomas restarts claude-session → new device flow → new JWT
  
OR:
  → Thomas clicks Disconnect in settings → token revoked immediately
  → Body gets 401 on next heartbeat → exits cleanly
```

---

## Implementation Plan

### Phase 1: Device Flow Auth Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/device` | POST | Start device flow → returns device_code, user_code, verification_url |
| `/api/auth/device/:code` | GET | Poll for approval → returns pending or token |
| `/device` | GET (viz) | Verification page — user enters code, approves |

### Phase 2: claude-session.sh Integration

Replace API key resolution with device flow:
```bash
# OLD:
brain_key=$(grep BRAIN_API_KEY .env)
export BRAIN_API_KEY=$brain_key

# NEW:
JWT=$(device_flow_auth)  # handles POST + print + poll
export XPO_SESSION_TOKEN=$JWT
```

### Phase 3: xpo-agent.js Token Mode

Add `--token` flag alongside `--api-key`:
```bash
xpo-agent.js --role pdsa --token $JWT
```

Body connects with JWT in Authorization header instead of API key in identity.

### Phase 4: Settings Tab — Active Sessions UI

- API: `GET /api/sessions` → list active agent sessions
- API: `DELETE /api/sessions/:id` → revoke session
- Viz: settings page shows session table with disconnect buttons

### Phase 5: Remove +Team from Viz

The viz +Team buttons spawn agents inside Docker (deprecated). Remove them. Agent spawning is now `claude-session` only.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Device flow (RFC 8628) | Headless-compatible. Works over SSH. Standard. |
| D2 | Per-session JWT, not static API key | No key rotation problem. Per-user identity. Revocable. |
| D3 | Settings tab for session management | Visibility + control. Thomas sees what's connected. |
| D4 | Remove +Team from viz | Agents run on host via claude-session, not in Docker container. |
| D5 | a2a-deliver.js reads JWT from body's env file | Soul never has credentials in its prompt. Body mediates. |
| D6 | 24h token TTL | Long enough for a work day. Short enough for security. Restart = re-auth. |

---

## Security

| Property | How |
|----------|-----|
| No static secrets | Device flow issues per-session tokens |
| User-scoped | Each token tied to a user (Thomas, Robin) |
| Revocable | Settings tab → Disconnect → immediate 401 |
| Time-limited | 24h TTL, refresh on restart |
| Headless-safe | Device flow works over SSH (no browser on server needed) |
| Soul isolation | JWT in body's env file, not in prompt |
