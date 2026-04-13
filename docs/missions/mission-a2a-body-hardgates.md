# A2A Body Hard Gates — Only the Body Opens Streams, Certified at Startup

**Ref:** MISSION-A2A-BODY-HARDGATES
**Version:** v1.0.0
**Date:** 2026-04-08
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Active — ready for implementation
**Depends on:** MISSION-A2A-AGENT-BODY (xpo-agent.js proven working)

---

## Problem Statement

During testing, the LIAISON soul (Claude) tried to open its own SSE stream via curl. This bypasses the body (xpo-agent.js) which is the designated SSE handler. The soul should never touch SSE — it receives events via tmux send-keys from the body.

Without a hard gate, agents will keep doing this. Brain knowledge alone doesn't prevent it. Only when the door stays closed will the agent find the correct path and learn.

### Security concern

If the gate checks `metadata.client === 'xpo-agent'`, any process can fake that metadata field. We need the body to be **certified** — proven authentic during startup — so the SSE endpoint can distinguish a real body from an impersonator.

---

## Architecture: Body vs Soul

```
┌──────────────────────────────────────────┐
│  xpo-agent.js (BODY) — LLM-less         │
│                                          │
│  ✓ Connects to A2A (/a2a/connect)       │
│  ✓ Opens SSE stream (/a2a/stream)       │
│  ✓ Sends heartbeats                      │
│  ✓ Receives events                       │
│  ✓ Delivers events to soul via tmux      │
│  ✓ Has agent_id in database              │
│  ✓ Certified with body_token at startup  │
│                                          │
│  Never thinks. Never generates text.     │
└────────────┬─────────────────────────────┘
             │ tmux send-keys
             ▼
┌──────────────────────────────────────────┐
│  Claude / LLM (SOUL)                     │
│                                          │
│  ✗ Does NOT connect to A2A               │
│  ✗ Does NOT have agent_id               │
│  ✗ Does NOT open SSE streams            │
│  ✗ Cannot fake body certification       │
│                                          │
│  ✓ Receives [TASK] via terminal          │
│  ✓ Delivers results via a2a-deliver.js   │
│    (temporary connect → deliver → done)  │
│                                          │
│  Thinks. Works. Creates. Commits.        │
└──────────────────────────────────────────┘
```

---

## Certification: How the Body Proves It's Real

### The problem with `metadata.client`

Any process can send `metadata: { client: 'xpo-agent' }` in the connect request. This is not authentication — it's a label anyone can write.

### Solution: Body Token — issued at startup, required for SSE

```
npm start (container startup)
  │
  ├─ Generate BODY_SECRET (random, per-boot, never persisted)
  │   Store in memory + environment
  │
  └─ API server starts with BODY_SECRET in process.env

xpo-agent.js (body startup)
  │
  ├─ Read BODY_SECRET from environment or config endpoint
  │   (same machine, same user — legitimate access)
  │
  ├─ POST /a2a/connect with:
  │   metadata: { client: 'xpo-agent', body_token: BODY_SECRET }
  │
  └─ Server validates body_token === BODY_SECRET
      ✓ Match → agent marked as certified body
      ✗ No match → agent registered but NOT certified

GET /a2a/stream/{agent_id}
  │
  ├─ Check: is this agent a certified body?
  │   ✓ Yes → open SSE stream
  │   ✗ No → 403: "SSE streams are managed by the A2A body (xpo-agent).
  │              Do not open your own stream. Events are delivered to
  │              your terminal automatically."
  │
  └─ Error message teaches the soul what to do instead
```

### Why this is zero-knowledge

1. `BODY_SECRET` is generated at container startup — no manual configuration
2. xpo-agent reads it from the same machine (environment variable or local config endpoint)
3. The soul (Claude) doesn't have the secret — it runs in a separate tmux session
4. Even if Claude reads the environment, it can't use the token because the SSE check is on the agent_id's certification flag, not on a per-request header
5. `a2a-deliver.js` connects temporarily to deliver results — it doesn't open SSE, so it's not affected

### Implementation detail

The server stores `is_body: true` on the agent record when the body_token matches at connect time. The SSE endpoint checks this flag.

```
agents table:
  id | name | current_role | is_body | ...
  
  xpo-agent-pdsa-abc | ... | pdsa | true   ← can open SSE
  deliver-pdsa-xyz   | ... | pdsa | false  ← temporary, no SSE
```

---

## Hard Gate: SSE Stream Endpoint

### Current code (a2a-stream.ts)

```typescript
// Accepts ANY agent that exists and isn't disconnected
const agent = db.prepare("SELECT ... WHERE id = ? AND status != 'disconnected'").get(agent_id);
if (!agent) { res.status(404)... }
addConnection(agent_id, res, agent.current_role, agent.project_slug);
```

### New code with gate

```typescript
const agent = db.prepare("SELECT ... WHERE id = ? AND status != 'disconnected'").get(agent_id);
if (!agent) { res.status(404)... }

// Hard gate: only certified bodies can open SSE streams
if (!agent.is_body) {
  res.status(403).json({ 
    type: 'ERROR', 
    error: 'SSE streams are managed by the A2A body (xpo-agent). ' +
           'Do not open your own stream. Task events are delivered to ' +
           'your terminal automatically by the body process. ' +
           'Use a2a-deliver.js to send results back.'
  });
  return;
}

addConnection(agent_id, res, agent.current_role, agent.project_slug);
```

### Error message design

The error message is instructive — it tells the soul:
1. WHY it can't open SSE (the body handles it)
2. HOW events reach it (delivered to terminal)
3. WHAT to use instead for sending results (a2a-deliver.js)

This is the self-healing pattern: the hard gate teaches. The agent hits the wall, reads the error, adjusts behavior. Over time, brain accumulates "don't open SSE directly" as operational knowledge.

---

## Changes Required

| File | Change |
|------|--------|
| `api/routes/a2a-connect.ts` | Validate `body_token` in metadata, set `is_body` flag on agent |
| `api/routes/a2a-stream.ts` | Check `is_body` flag, reject non-body agents with instructive error |
| `api/db/migrations/` | Add `is_body` column to agents table (default false) |
| `scripts/startup.sh` | Generate `BODY_SECRET` at boot, export to environment |
| `src/a2a/xpo-agent.js` | Read `BODY_SECRET` from env, send as `body_token` in connect metadata |

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Only certified bodies can open SSE | Souls must not bypass the body. Hard gate, not soft guidance. |
| D2 | BODY_SECRET generated at startup | Zero-knowledge. No manual config. Per-boot. |
| D3 | Instructive error messages | The gate teaches. Agent reads error → adjusts → learns. |
| D4 | `is_body` flag on agent record | Simple boolean. Set at connect time. Checked at stream time. |
| D5 | a2a-deliver.js not affected | Temporary connections for delivery don't need SSE. Not gated. |
