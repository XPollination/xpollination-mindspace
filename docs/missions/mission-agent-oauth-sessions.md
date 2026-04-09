# Agent Sessions — Persistent Device Keys + Connection Management

**Ref:** MISSION-AGENT-OAUTH-SESSIONS
**Version:** v2.0.0
**Date:** 2026-04-09
**Authors:** Thomas Pichler + Claude (interactive design session)
**Status:** In Progress
**Supersedes:** v1.0.0 (device flow with 24h JWT)

---

## Problem Statement (v2)

v1 solved the static API key problem with OAuth device flow + 24h JWTs. But 24h expiry creates a new problem: **agent sessions die on weekends.**

Thomas starts `claude-session a2a-team` Friday afternoon. Agents build context over hours. Saturday morning, JWT expires. A2A bodies silently lose connectivity. Monday: 4 agents with intact Claude context but no A2A — orphaned.

The session IS the work. Kill the session = kill the context. A 24h timer is hostile to the use case.

Additionally:
- Every `claude-session` run requires a new browser approval (friction)
- Server reboot = re-authenticate (friction)
- No visibility into which agent connections are active
- The body is LLM-agnostic (Claude, Cursor, ChatGPT, Grok, local AI) — credentials must NOT live in `~/.claude/`

---

## Solution: Persistent Device Keys + Connection Tracking

### Mental Model: SSH Keys for Agent Sessions

Like SSH: register a key once per machine, connect unlimited times until revoked.

```
1 User (Thomas)
└── N Device Keys (one per machine)
    ├── 🔑 "Hetzner CX22" — registered 2026-04-09
    │   ├── liaison (a2a-team:0.0) — last seen: 30s ago
    │   ├── pdsa (a2a-team:0.1) — last seen: 45s ago
    │   ├── dev (a2a-team:0.2) — last seen: 1m ago
    │   └── qa (a2a-team:0.3) — last seen: 2m ago
    │
    └── 🔑 "MacBook Pro" — registered 2026-04-05
        └── liaison (agent-liaison) — last seen: 3 days ago
```

### Key Lifecycle

```
FIRST TIME (per machine):
  claude-session a2a-team
    → No credential found at ~/.xpollination/keys/<server>.key
    → Device flow: POST /api/auth/device/code → user_code
    → User approves in browser (one time)
    → Server generates keypair, returns private key
    → Stored at ~/.xpollination/keys/<server-fingerprint>.key
    → Bodies connect with key. Done.

EVERY SUBSEQUENT TIME (same machine):
  claude-session a2a-team
    → Credential found at ~/.xpollination/keys/<server>.key
    → Bodies connect with key. No browser needed. Instant.
    → Works after reboot, after tmux kill, after weeks.

  claude-session agent-liaison
    → Same key. No re-auth. Instant.

REVOCATION (from Settings page):
  Thomas clicks "Revoke" on "Hetzner CX22" key
    → Server marks key as revoked
    → All SSE streams authenticated with that key: closed
    → Bodies detect disconnect → exit gracefully
    → Next claude-session run: key rejected → triggers new device flow
```

### Credential Storage

Credentials live in `~/.xpollination/` (NOT `~/.claude/`).

**Why:** The xpo-agent body is LLM-agnostic. It works with Claude Code, Cursor, ChatGPT, Grok, any local AI. The credential belongs to the xpollination identity system, not any specific LLM.

```
~/.xpollination/
├── keys/
│   ├── beta-mindspace.key         # Key for beta server
│   └── mindspace.key              # Key for prod server
└── config.json                    # Optional: default server, preferences
```

### What Changes from v1

| v1 (24h JWT) | v2 (Persistent Keys) |
|---|---|
| Authenticate every `claude-session` run | Authenticate once per machine |
| 24h expiry kills weekend sessions | No expiry — lives until revoked |
| JWT is stateless (can't revoke cleanly) | Key-based (server-side session table) |
| Credential in env var / /tmp file | Credential in `~/.xpollination/keys/` |
| Per-session token | Per-machine key with N connections |
| No connection tracking | Server tracks every agent connection |
| Settings shows "Active Sessions" (useless) | Settings shows "Connected Devices" with agent details |

---

## Architecture

### Data Model

```sql
-- One row per registered device key (machine)
CREATE TABLE device_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,                    -- "Hetzner CX22", "MacBook Pro"
  public_key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of public key
  created_at TEXT DEFAULT (datetime('now')),
  last_active TEXT,                      -- Updated on any connection activity
  revoked_at TEXT,                       -- NULL = active, non-NULL = revoked
  UNIQUE(user_id, name)
);

-- One row per active agent connection (body)
CREATE TABLE agent_connections (
  id TEXT PRIMARY KEY,
  device_key_id TEXT NOT NULL REFERENCES device_keys(id),
  agent_name TEXT NOT NULL,              -- "liaison", "pdsa", "dev", "qa"
  session_name TEXT,                     -- "a2a-team", "agent-liaison"
  connected_at TEXT DEFAULT (datetime('now')),
  last_heartbeat TEXT,
  disconnected_at TEXT,                  -- NULL = connected
  UNIQUE(device_key_id, agent_name, session_name)
);
```

### Authentication Flow

```
claude-session.sh
  │
  ├─ Check ~/.xpollination/keys/<server>.key
  │   ├─ EXISTS + VALID → skip device flow
  │   └─ MISSING or REVOKED → device flow:
  │       ├─ POST /api/auth/device/code → user_code
  │       ├─ Print clickable URL: https://beta-mindspace.../device?code=XXXX
  │       ├─ Poll /api/auth/device/token until approved
  │       ├─ Receive keypair → store private key at ~/.xpollination/keys/<server>.key
  │       └─ Continue
  │
  ├─ Start xpo-agent bodies with key path:
  │   xpo-agent.js --role pdsa --key ~/.xpollination/keys/<server>.key
  │
  └─ xpo-agent.js:
      ├─ Sign challenge with private key → POST /a2a/connect
      ├─ Server validates signature against stored public key
      ├─ Registers agent_connection (role, session_name)
      ├─ SSE stream opened → heartbeats update last_heartbeat
      └─ On disconnect: agent_connection.disconnected_at set
```

### Revocation Flow (Reverse of Login)

```
User clicks "Revoke" on Connected Devices page
  → PATCH /api/auth/device-keys/:id { revoked_at: now() }
  → Server finds all active SSE streams for this key
  → Server sends SSE event: { type: "REVOKED" }
  → Server closes all SSE streams for this key
  → Each body receives REVOKED event:
      ├─ Logs "Session revoked by user"
      ├─ Optionally sends message to LLM pane: "A2A revoked. Run claude-session to reconnect."
      └─ Body process exits
  → Next claude-session run: key rejected (revoked) → triggers new device flow
```

---

## Settings UI: Connected Devices

Replace "Active Sessions" with "Connected Devices":

```
┌─────────────────────────────────────────────────────────────────┐
│  Connected Devices                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔑 Hetzner CX22              registered Apr 9 · active now    │
│  ├── liaison (a2a-team)        last seen: 30s ago               │
│  ├── pdsa (a2a-team)           last seen: 45s ago               │
│  ├── dev (a2a-team)            last seen: 1m ago                │
│  └── qa (a2a-team)             last seen: 2m ago                │
│                                                    [Revoke Key] │
│                                                                 │
│  🔑 MacBook Pro                registered Apr 5 · 3 days ago   │
│  └── No active agents                                          │
│                                                    [Revoke Key] │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  4 active agents across 2 devices          [Revoke All Devices] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Device flow for first-time registration only | Subsequent connections use stored key. No browser needed. |
| D2 | No token expiry — revocation only | Agent sessions must survive weekends. 24h expiry is hostile. |
| D3 | Per-machine key, not per-session | One key covers all `claude-session` invocations on that machine. |
| D4 | Credentials in `~/.xpollination/keys/` | Body is LLM-agnostic. Not tied to Claude, Cursor, or any provider. |
| D5 | Server tracks agent connections per key | Visibility into what's connected. Heartbeats show liveness. |
| D6 | Revoke key = disconnect all agents on that machine | Clean, predictable. One action, all connections dropped. |
| D7 | Unlimited bodies per key | Like SSH: one key, unlimited sessions. No artificial limits. |
| D8 | Connected Devices replaces Active Sessions | Current Active Sessions is not useful. Devices + agents is. |

---

## Security

| Property | How |
|----------|-----|
| No static secrets in `.env` | Device keys replace API keys for A2A auth |
| User-scoped | Each key tied to a user (Thomas, Robin) |
| Machine-scoped | Each key tied to a machine (Hetzner, MacBook) |
| Revocable | Settings → Revoke Key → immediate disconnect |
| No expiry timer | Sessions survive weekends, holidays, vacations |
| Headless-safe | Device flow works over SSH (first time only) |
| LLM-agnostic | `~/.xpollination/` not tied to any AI provider |
| Soul isolation | Key in file, not in LLM prompt |

---

## Implementation Phases

### Phase 1: Device Keys Table + Registration
- Migration: `device_keys` + `agent_connections` tables
- Endpoint: `/api/auth/device-keys` — register, list, revoke
- Update device flow to generate + store keypair on approval

### Phase 2: Key-Based Auth in xpo-agent
- `--key` flag replaces `--token` in xpo-agent.js
- Challenge-response auth on `/a2a/connect`
- Agent connection tracking with heartbeats

### Phase 3: claude-session Key Management
- Check `~/.xpollination/keys/` before triggering device flow
- Store key on first registration
- All `claude-session` variants use the same key

### Phase 4: Connected Devices UI
- Settings page: list device keys with nested agent connections
- Revoke button per key
- Real-time last-seen via heartbeat polling

### Phase 5: Graceful Revocation
- SSE REVOKED event → body exits
- Body sends farewell message to LLM pane
- Cleanup of stale connections (no heartbeat > 5min)

---

## What Stays

**BRAIN_API_KEY remains** — for brain knowledge API access only (`localhost:3200`). Separate infrastructure, separate auth. Managed in `.env`, not through viz settings.

**Device flow remains** — but only for first-time key registration, not every session start.

**The settings page API Key** — for programmatic Brain API access. Not for agent auth.
