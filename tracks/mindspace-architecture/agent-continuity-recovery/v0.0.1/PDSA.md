# PDSA: Agent Continuity — Survive Context Loss Without Human Navigation

**Task:** `agent-continuity-recovery`
**Version:** v0.0.1
**Date:** 2026-03-13
**Author:** PDSA agent

---

## PLAN

### Problem Statement

Agents lose working context on compact/clear/restart. Today, recovery depends on:
1. Generic brain queries that return role definitions, not task state
2. Truncated thought previews (~120 chars) that miss critical details
3. No self-test — agents proceed without verifying understanding
4. No pre-compact save — working context is lost before recovery captures it
5. Human intervention — Thomas must manually guide agents back to context

**Observed failure (2026-03-13):** LIAISON completed mindspace-docker-installer but lost 5 pending items. Without Thomas asking "do you still have the context?", the agent would have declared "all done."

**Thomas's insight:** "The ability to guide an agent back into context after disruption is an art not many humans have. The system must handle this automatically."

### Architecture Principle

**Brain is the root.** An agent needs only `brain_url` + `agent_id` + HTTP. Everything else — identity, state, context — comes from brain. Works for Claude, GPT, Gemini, local LLMs, any future platform.

**One URL:** `hive.xpollination.earth` is the single URL a human gives to any new agent. From that URL, the agent learns who it is, what it was doing, what the human expects, and how to connect for ongoing memory.

### Domain Split

| Domain | Service | Purpose |
|--------|---------|---------|
| `mindspace.xpollination.earth` | PM tool, capability tracking, mission viz | Human-facing dashboard |
| `hive.xpollination.earth` | Agent identity, memory, A2A protocol | Agent-facing endpoint — the URL humans give to agents |

### Current Brain Architecture

The Brain API (Fastify + Qdrant at port 3200) currently has:

| Layer | What Exists | Gap |
|-------|-------------|-----|
| **Long-term memory** | Thoughts, highways, consolidations, pheromone decay | Works well — knowledge persists and evolves |
| **Working memory** | Nothing | Agents have no way to push "what I'm doing right now" |
| **Identity** | `users` table (user_id, api_key, qdrant_collection) | Maps API keys to Qdrant collections, but no agent role definitions or recovery protocols |
| **Recovery** | Generic `POST /api/v1/memory` with read_only | Returns thought previews sorted by similarity — no structured recovery |

### Target Brain Architecture

| Layer | What to Build | Storage |
|-------|---------------|---------|
| **Long-term memory** | Unchanged | Qdrant `thought_space` |
| **Working memory** | Per-agent state with TTL — task, step, human expectation, context | SQLite `agent_state` table |
| **Identity** | Role, responsibilities, recovery protocol per agent_id | SQLite `agent_identity` table |
| **Recovery endpoint** | `GET /api/v1/recovery/{agent_id}` — one call, full recovery | Aggregates identity + state + key thoughts |
| **Onboarding page** | Static HTML at `hive.xpollination.earth/` | Serves from Fastify |

---

### Design Decisions

**D1: Working memory goes in SQLite, not Qdrant.**

Qdrant is optimized for semantic search over long-term knowledge. Working memory is:
- Structured (fixed schema: task, step, context, human_expectation)
- Short-lived (TTL, overwritten frequently)
- Looked up by exact key (agent_id), not semantic similarity
- Small (one row per agent, not thousands of vectors)

SQLite is the right fit. The `thought-tracing.db` already exists with `users` and `query_log` tables. Add:

```sql
CREATE TABLE IF NOT EXISTS agent_state (
  agent_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,         -- Full working state (JSON, no size limit)
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_id TEXT,                  -- Which session wrote this
  ttl_hours INTEGER DEFAULT 72     -- Auto-expire after N hours of no update
);
CREATE INDEX IF NOT EXISTS idx_agent_state_updated ON agent_state(updated_at);
```

`state_json` is freeform JSON. The agent decides what to store. Minimum expected fields:

```json
{
  "task_slug": "repo-consolidation-governance",
  "task_title": "Repo consolidation: governance, rename, script migration, archive",
  "step": "Rework v0.0.2 — adding hive.xpollination.earth context",
  "human_expectation": "Thomas is waiting for the v0.0.2 design to include hive endpoint and A2A server",
  "pending_items": ["DNS records", "BRAIN_API_URL env var", "docker-compose update"],
  "key_decisions": ["Brain API = A2A server", "Option A port-based deployment"],
  "context_summary": "v0.0.1 covered D1-D7. Thomas rejected because missing hive context...",
  "ad_hoc_work": null
}
```

**Why not use thoughts?** Thoughts are knowledge — they accumulate and evolve. Working state is ephemeral — it gets replaced, not refined. Mixing them degrades retrieval quality (state snapshots crowd out insights).

**D2: Identity goes in SQLite, not hardcoded.**

Current agent identity lives in CLAUDE.md files, skill prompts, and `--append-system-prompt` flags. These are Claude Code-specific. For platform-agnostic recovery:

```sql
CREATE TABLE IF NOT EXISTS agent_identity (
  agent_id TEXT PRIMARY KEY,
  role TEXT NOT NULL,                -- liaison, pdsa, dev, qa
  display_name TEXT NOT NULL,        -- LIAISON, PDSA, DEV, QA
  responsibilities TEXT NOT NULL,    -- JSON array of responsibility strings
  recovery_protocol TEXT NOT NULL,   -- Markdown: step-by-step recovery instructions
  platform_hints TEXT,               -- JSON: platform-specific hints (optional)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Seed data for the 4 agents:

| agent_id | role | responsibilities (summary) |
|----------|------|---------------------------|
| `agent-liaison` | liaison | Bridge between human and agents. Creates tasks. Presents work. Executes human-decision transitions. |
| `agent-pdsa` | pdsa | Plans, researches, designs. Produces PDSA documents. Reviews dev implementation. Never implements. |
| `agent-dev` | dev | Implements what PDSA designed. Reads DNA, builds, submits for review. Never plans. Never changes tests. |
| `agent-qa` | qa | Writes tests from approved designs. Reviews dev by running tests. Never fixes implementation. |

`recovery_protocol` contains the full step-by-step instructions an agent follows after receiving its identity. This replaces the hardcoded `xpo.claude.monitor` skill with a brain-native protocol.

`platform_hints` is optional JSON for platform-specific behaviors:

```json
{
  "claude_code": {
    "append_system_prompt": "--append-system-prompt 'You are the PDSA agent...'",
    "allowed_tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
  }
}
```

**D3: Recovery endpoint — one HTTP call returns everything.**

```
GET /api/v1/recovery/{agent_id}
Authorization: Bearer <API_KEY>
```

Response:

```json
{
  "identity": {
    "agent_id": "agent-pdsa",
    "role": "pdsa",
    "display_name": "PDSA",
    "responsibilities": ["Plans, researches, designs...", "..."],
    "recovery_protocol": "## Step 1: Verify identity\n..."
  },
  "working_state": {
    "task_slug": "repo-consolidation-governance",
    "task_title": "...",
    "step": "Rework v0.0.2",
    "human_expectation": "...",
    "pending_items": ["..."],
    "key_decisions": ["..."],
    "context_summary": "...",
    "updated_at": "2026-03-13T10:30:00Z",
    "age_minutes": 45
  },
  "key_context": [
    {
      "thought_id": "abc-123",
      "content": "Full thought content (not truncated)",
      "category": "transition_marker",
      "topic": "repo-consolidation-governance",
      "score": 0.92
    }
  ],
  "recent_transitions": [
    "TASK active→approval: PDSA repo-consolidation-governance v0.0.2",
    "TASK review→review:pdsa: mindspace-docker-installer v0.0.3 PASS"
  ],
  "recovered_at": "2026-03-13T11:15:00Z"
}
```

**Implementation:**
1. Look up `agent_identity` by `agent_id` → 404 if not found
2. Look up `agent_state` by `agent_id` → `null` if no state (agent is fresh)
3. Check TTL: if `updated_at` + `ttl_hours` < now, state is stale — return it with `stale: true` flag
4. Query Qdrant for top 5 thoughts tagged with `contributor_id == agent_id` AND `thought_category IN ('transition_marker', 'state_snapshot', 'decision_record')`, sorted by recency
5. Drill down: fetch full content for top 3 (not previews)
6. Assemble response

**Auth:** Same Bearer token auth as all other endpoints. `agent_id` in URL must match or the user must own the collection.

**D4: Working memory push endpoint — continuous sync.**

```
POST /api/v1/working-memory/{agent_id}
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "session_id": "uuid",
  "state": { ... }     // Freeform JSON, replaces previous state entirely
}
```

Response:

```json
{
  "success": true,
  "agent_id": "agent-pdsa",
  "updated_at": "2026-03-13T11:15:00Z",
  "previous_age_minutes": 45
}
```

**Implementation:** `INSERT OR REPLACE INTO agent_state`. The entire state is replaced atomically. No merging — the agent sends its complete current state every time.

**When agents push state (continuous_sync_events from DNA):**

| Event | Trigger | What to include |
|-------|---------|-----------------|
| `task_claimed` | Agent starts working on a task | task_slug, title, step="claimed" |
| `analysis_complete` | Finished research/analysis | findings summary, next step |
| `human_decision` | Human makes a decision | what was decided, implications |
| `presentation` | About to present to human | what's being presented, expected response |
| `task_transition` | Formal PM state change | from/to state, outcome |
| `ad_hoc_work` | Work outside PM | description, why, expected outcome |

**Frequency:** After every meaningful event. NOT on a timer — event-driven. Hard crash loses at most the last event.

**D5: Agent onboarding page at hive root.**

```
GET /
```

Returns static HTML:

```html
<!DOCTYPE html>
<html>
<head><title>XPollination Hive</title></head>
<body>
<h1>XPollination Hive</h1>
<p>Agent identity, memory, and A2A protocol endpoint.</p>

<h2>For Agents</h2>
<p>If you are an AI agent, your human gave you this URL to connect.</p>
<ol>
  <li>Authenticate: <code>Authorization: Bearer YOUR_API_KEY</code></li>
  <li>Identify yourself: <code>GET /api/v1/recovery/{your_agent_id}</code></li>
  <li>Push state: <code>POST /api/v1/working-memory/{your_agent_id}</code></li>
  <li>Query knowledge: <code>POST /api/v1/memory</code></li>
</ol>

<h2>API Health</h2>
<p><a href="/api/v1/health">Check health</a></p>
</body>
</html>
```

This is the first thing any agent (or human) sees at `hive.xpollination.earth`. It's self-documenting.

**D6: Recovery self-test — agent must present understanding before proceeding.**

The `recovery_protocol` in `agent_identity` includes this as a mandatory step:

```markdown
## Step 4: Self-Test (MANDATORY)

After receiving recovery data, present to the human:

"I recovered my context. Here's what I understand:
- **My role:** {role} — {responsibilities[0]}
- **Current task:** {working_state.task_slug} — {working_state.task_title}
- **Current step:** {working_state.step}
- **You expect:** {working_state.human_expectation}
- **Pending:** {working_state.pending_items}

Is this correct? Should I continue from here?"

Wait for human confirmation before proceeding.
If no working state exists, say:
"I have no working state. I'm a fresh agent. What should I work on?"
```

This is NOT enforced by the API (we can't force an LLM to do something). It's specified in the protocol so any platform's agent implementation follows it.

**D7: Graceful degradation — brain down fallback.**

Recovery endpoint should ALWAYS return something, even partial:

| Brain State | What Recovery Returns |
|-------------|----------------------|
| Healthy | Full: identity + state + context |
| Qdrant down, SQLite up | Partial: identity + state (no key_context) |
| SQLite down | Error 503: "Brain storage unavailable. Fall back to local sources." |
| Complete outage | Connection refused — agent must report "Cannot reach hive" |

The recovery endpoint catches Qdrant errors and returns partial data with a `degraded: true` flag rather than failing entirely.

**D8: TTL cleanup job — prune stale working memory.**

Working memory with TTL > expired should be cleaned up:

```sql
DELETE FROM agent_state
WHERE datetime(updated_at, '+' || ttl_hours || ' hours') < datetime('now');
```

Run hourly, alongside the existing pheromone decay job. Stale state (agent hasn't pushed in 72h) is deleted — the agent is either dead or has moved on.

**D9: No changes to existing memory endpoint.**

`POST /api/v1/memory` remains unchanged. It handles long-term knowledge. Working memory is a separate concern with its own endpoints. Agents continue using `/api/v1/memory` for insights, learnings, and transition markers.

The recovery endpoint *reads* from both — it queries Qdrant via `retrieve()` for `key_context` and reads SQLite for `identity` + `working_state`. But the write paths are separate:
- `/api/v1/memory` → thoughts (long-term)
- `/api/v1/working-memory/{agent_id}` → state (ephemeral)

**D10: Platform-agnostic design — Claude hooks are implementation detail.**

The current `xpo.claude.compact-recover.sh` hook and `xpo.claude.clear` skill are Claude Code-specific implementations. They should be updated to use the new brain endpoints:

| Current (Claude-specific) | New (Brain-native) |
|---------------------------|-------------------|
| `xpo.claude.compact-recover.sh` queries brain with generic text | Hook calls `GET /api/v1/recovery/{agent_id}` for structured recovery |
| `xpo.claude.clear` skill saves 500-char snapshot to thought | Skill calls `POST /api/v1/working-memory/{agent_id}` with full state |
| `xpo.claude.monitor` hardcodes role definitions | Monitor calls `GET /api/v1/recovery/{agent_id}` for identity |

These are future updates to the skills/hooks — not part of the Brain API implementation itself. The DEV task focuses on the API; skill updates are a separate task.

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `brain/src/services/database.ts` | **MODIFY** | Add `agent_state` and `agent_identity` tables to `initSchema()` |
| `brain/src/routes/recovery.ts` | **CREATE** | `GET /api/v1/recovery/:agentId` endpoint |
| `brain/src/routes/working-memory.ts` | **CREATE** | `POST /api/v1/working-memory/:agentId` endpoint |
| `brain/src/routes/onboarding.ts` | **CREATE** | `GET /` — static HTML onboarding page |
| `brain/src/index.ts` | **MODIFY** | Register new route modules |
| `brain/src/middleware/auth.ts` | **MODIFY** | Exempt `GET /` from auth (public onboarding page) |
| `brain/src/services/thoughtspace.ts` | **MODIFY** | Add `getRecentByContributor()` function for recovery context |
| `brain/src/types/index.ts` | **MODIFY** | Add `AgentState`, `AgentIdentity`, `RecoveryResponse` interfaces |

### Seed Data

`agent_identity` table needs seed data for the 4 agents. This goes in `initSchema()` as `INSERT OR IGNORE`:

```sql
INSERT OR IGNORE INTO agent_identity (agent_id, role, display_name, responsibilities, recovery_protocol)
VALUES
  ('agent-liaison', 'liaison', 'LIAISON', '["Bridge between human and agents","Creates tasks with complete DNA","Executes human-decision transitions","Presents work for review","Never does agent work"]', '...'),
  ('agent-pdsa', 'pdsa', 'PDSA', '["Plans, researches, designs","Produces PDSA documents","Verifies dev implementation matches design","Never implements code"]', '...'),
  ('agent-dev', 'dev', 'DEV', '["Implements what PDSA designed","Reads DNA, builds, submits for review","Never changes tests","Never plans"]', '...'),
  ('agent-qa', 'qa', 'QA', '["Writes tests from approved designs","Reviews dev implementations by running tests","Never fixes implementation code"]', '...');
```

The `recovery_protocol` for each agent will be a multi-paragraph markdown string with platform-agnostic recovery steps.

### Execution Order

1. **Extend database schema** — add `agent_state` and `agent_identity` tables with seed data
2. **Add types** — `AgentState`, `AgentIdentity`, `RecoveryResponse` interfaces
3. **Add `getRecentByContributor()`** — thoughtspace function for recovery context
4. **Create recovery route** — `GET /api/v1/recovery/:agentId`
5. **Create working-memory route** — `POST /api/v1/working-memory/:agentId`
6. **Create onboarding route** — `GET /`
7. **Register routes** — update `index.ts` and `auth.ts`
8. **Add TTL cleanup** — to existing pheromone decay job cycle
9. **Test end-to-end** — new agent → URL → identify → push state → recover

### Risks and Mitigations

**R1: SQLite concurrent writes from multiple agents.** Brain API handles all writes via single Fastify process. WAL mode supports concurrent reads. No risk — single writer, multiple readers.

**R2: Working memory size unbounded.** `state_json` has no size limit. An agent could push megabytes. Mitigation: Add request body size check (max 64KB for working-memory endpoint). Working state should be a concise summary, not a full context dump.

**R3: Recovery endpoint latency.** Three data sources (SQLite identity, SQLite state, Qdrant thoughts). Mitigation: SQLite lookups are <1ms. Qdrant query is the bottleneck (~50-200ms). Total should be <500ms — acceptable for a recovery call.

**R4: Agent identity theft.** Any agent with a valid API key can read any agent's recovery data. Mitigation: Current auth model has single user (Thomas) with all agents sharing one API key. Multi-user isolation exists via `qdrant_collection` routing. For now, all agents belong to the same human — no theft risk. Future: add `agent_id` ↔ `user_id` ownership check.

**R5: Stale state misleads recovery.** Agent pushed state 48 hours ago, situation has changed. Mitigation: Recovery response includes `age_minutes` field. TTL (72h default) auto-expires truly abandoned state. Recovery protocol instructs agent to note staleness.

### Verification Plan

1. `curl GET /api/v1/recovery/agent-pdsa` — returns identity + state + context
2. `curl POST /api/v1/working-memory/agent-pdsa` with state JSON — returns success
3. `curl GET /api/v1/recovery/agent-pdsa` — returns updated state from step 2
4. `curl GET /api/v1/recovery/agent-nonexistent` — returns 404
5. `curl GET /` — returns HTML onboarding page (no auth required)
6. `curl GET /api/v1/health` — still works, includes new tables in status
7. Working memory TTL: set ttl_hours=0, verify cleanup deletes it
8. Graceful degradation: stop Qdrant, call recovery — returns identity + state without key_context
9. State replacement: push state twice, verify second overwrites first
10. Size limit: push >64KB state — returns 413

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
