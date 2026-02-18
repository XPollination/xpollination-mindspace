# PDSA: Automated Agent Bootstrap — Zero-Knowledge Setup with Role Verification

**Date:** 2026-02-06
**Task:** automated-agent-bootstrap
**Status:** Iteration 1
**Unifies:** security-agent-role-verification + zero-knowledge-agent-setup

---

## PLAN

### Problem Statement

Two interrelated problems exist in the multi-agent system:

1. **Role impersonation:** On 2026-02-06, liaison agent transitioned a task using `actor=pdsa`, simulating another role. `interface-cli.js` accepts any actor string without verification.

2. **Manual setup:** Starting agents requires human knowledge of tmux commands, Claude CLI flags, role prompts, and monitoring. Goal: one script, zero knowledge required.

These must be solved together — registration is part of bootstrap, and verification is meaningless without a registration mechanism.

### Security Boundary

All agents run as the same OS user (`developer`) in a shared tmux session. True cryptographic isolation is impossible. This system catches **accidental role confusion** — it is a guard rail, not a security perimeter. Threat model: honest agents that might accidentally use the wrong actor name.

### Research Findings

1. **Claude CLI:** `--append-system-prompt <prompt>` confirmed working — appends to system prompt at startup
2. **tmux:** `even-horizontal` layout creates equal columns; vertical split within a column works
3. **Env vars:** `AGENT_KEY` in a pane's shell is private enough for guard-rail purposes (other agents can read via /proc but won't accidentally)
4. **Existing script:** `claude-session.sh` in HomeAssistant repo (3-pane, fragile send-keys approach)

---

## DO

### System Overview

```
start-agents.sh
    │
    ├── Creates tmux session "claude-agents" with 4 panes
    │
    ├── Per pane: starts Claude with --append-system-prompt (role identity)
    │
    └── Each agent's first actions (instructed via system prompt):
         ├── source ~/.nvm/nvm.sh
         ├── AGENT_KEY=$(node src/db/register-agent.js <role>)
         ├── export AGENT_KEY
         └── node viz/agent-monitor.cjs <role>  (background)
```

### Component 1: `start-agents.sh`

**Location:** repo root, executable (`chmod +x`)

**Layout:**
```
+------------------+------------------+------------------+
|                  |                  |   DEV            |
|  LIAISON         |  PDSA            |   (right-top)    |
|  (left)          |  (middle)        +------------------+
|                  |                  |   QA             |
|                  |                  |   (right-bottom) |
+------------------+------------------+------------------+
  Pane 0             Pane 1             Pane 2 / Pane 3
```

**Script behavior:**
1. Kill existing `claude-agents` session (idempotent restart)
2. Create tmux session with 4 panes in above layout
3. For each pane, start Claude with role-specific system prompt via `--append-system-prompt`
4. System prompt instructs agent to: read CLAUDE.md, register, start monitoring
5. Attach to session

**Key design decisions:**
- Use `--append-system-prompt` (not `send-keys`) — reliable, no timing issues
- `AGENT_ROLE` env var set before Claude starts — agent can read it
- Registration command embedded in system prompt — agent executes on first turn

### Component 2: `src/db/register-agent.js`

**Standalone script** (not part of interface-cli.js — different concern, different output format)

**Usage:**
```bash
node src/db/register-agent.js <role>
# stdout: a3f7c9d1          (just the key, for AGENT_KEY=$(...)  capture)
# stderr: Registered role=pdsa key=a3f7c9d1
```

**Internal flow:**
1. Validate role is one of: dev, pdsa, qa, liaison
2. Generate key: `crypto.randomBytes(4).toString('hex')` (8-char hex)
3. Load or create `data/agent-keys.json`
4. Store: `{ "a3f7c9d1": { "role": "pdsa", "registered_at": "ISO", "pid": 12345 } }`
5. Append to `data/agent-audit.log`: `2026-02-06T10:00:00Z REGISTER role=pdsa key=a3f7c9d1`
6. Print key to stdout

**Race condition mitigation:** Use atomic write pattern (write to temp file, rename). Multiple agents registering simultaneously won't corrupt the JSON.

### Component 3: CLI Key Validation (changes to `interface-cli.js`)

**State-changing operations** (transition, update-dna, create) gain key validation:

1. Read `AGENT_KEY` from `process.env.AGENT_KEY`
2. Load `data/agent-keys.json`
3. Look up key → get registered role
4. Compare registered role with `actor` parameter
5. If mismatch → reject with clear error

**Read operations** (get, list) remain unrestricted — no key needed.

**Error messages:**
```
No AGENT_KEY environment variable set. Register first:
  AGENT_KEY=$(node src/db/register-agent.js <role>) && export AGENT_KEY

Unknown AGENT_KEY "abc123". Register:
  AGENT_KEY=$(node src/db/register-agent.js <role>) && export AGENT_KEY

Role mismatch: your key grants role=dev, but you used actor=pdsa. Use actor=dev.
```

**Bypass:** `actor=system` skips key validation (for automated scripts, migrations).

### Component 4: Gitignore & Documentation

**`.gitignore` additions:**
```
data/agent-keys.json
data/agent-audit.log
```

**`CLAUDE.md` additions:** Agent startup registration instructions (register command, export key, start monitor).

### File Changes Summary

| File | Change | Type |
|------|--------|------|
| `start-agents.sh` | NEW — tmux launcher | Script |
| `src/db/register-agent.js` | NEW — agent self-registration | Script |
| `src/db/interface-cli.js` | MODIFY — add key validation to state-changing ops | Code |
| `.gitignore` | MODIFY — add agent-keys.json, agent-audit.log | Config |
| `CLAUDE.md` | MODIFY — add startup registration docs | Docs |

### Implementation Subtasks (for QA → Dev flow)

1. **ST1:** `register-agent.js` — generates key, stores mapping, prints to stdout
2. **ST2:** `interface-cli.js` key validation — read AGENT_KEY, validate against keys file, reject on mismatch
3. **ST3:** `start-agents.sh` — tmux layout, Claude startup with role prompts
4. **ST4:** `.gitignore` updates
5. **ST5:** `CLAUDE.md` updates
6. **ST6:** Tests for register-agent.js (register, duplicate role, invalid role)
7. **ST7:** Tests for interface-cli.js key validation (valid key, missing key, unknown key, role mismatch, system bypass)

---

## STUDY

### Why unified design?

The two original tasks had a circular dependency: registration needed the CLI, the CLI needed keys, keys came from registration. Designing them together eliminates interface mismatch.

### Why separate `register-agent.js` from `interface-cli.js`?

| Concern | interface-cli.js | register-agent.js |
|---------|-----------------|-------------------|
| Purpose | Workflow operations | Identity management |
| Output | JSON objects | Plain key string (for capture) |
| Auth | Requires AGENT_KEY | Creates AGENT_KEY |
| Actors | dev, pdsa, qa, liaison, system | N/A |

Mixing registration into interface-cli.js would create a chicken-and-egg: you need a key to use the CLI, but need the CLI to get a key.

### Why `--append-system-prompt` over `send-keys`?

| Aspect | send-keys (current) | append-system-prompt (proposed) |
|--------|--------------------|---------------------------------|
| Reliability | Fragile (timing, buffer) | Built into Claude CLI |
| Role identity | Agent can ignore/forget | Baked into system prompt |
| Race conditions | Possible | None |
| Complexity | Wait loops, trust prompts | Single flag |

### Risks

1. **Agent doesn't execute registration commands:** The system prompt instructs it, but Claude might interpret differently. Mitigation: test with real agents; make instructions very explicit.
2. **tmux layout instability:** `even-horizontal` + vertical split may not produce exact proportions. Mitigation: manual testing, adjust splits if needed.
3. **Key file corruption on concurrent registration:** Mitigation: atomic write (temp file + rename).
4. **`--append-system-prompt` string escaping:** Shell quotes within tmux `send-keys` can be tricky. Mitigation: test escaping carefully, consider heredoc approach.

---

## ACT

### Acceptance Criteria

- [ ] AC1: `./start-agents.sh` creates 4-pane tmux session (liaison, pdsa, dev, qa)
- [ ] AC2: Each pane starts Claude with correct role via `--append-system-prompt`
- [ ] AC3: `register-agent.js` generates unique key per agent, stores in `data/agent-keys.json`
- [ ] AC4: Agent can capture key via `AGENT_KEY=$(node src/db/register-agent.js <role>)`
- [ ] AC5: `interface-cli.js` validates AGENT_KEY on transition/update-dna/create
- [ ] AC6: Role mismatch returns clear error with correct role hint
- [ ] AC7: Read operations (get, list) work without key
- [ ] AC8: `data/agent-keys.json` and `data/agent-audit.log` are gitignored
- [ ] AC9: Zero manual steps after running `./start-agents.sh`
- [ ] AC10: Audit log captures all registrations

### Next Steps
1. Liaison approves this PDSA
2. QA writes tests (TDD) for register-agent.js and CLI key validation
3. Dev implements against tests
4. Manual integration test: run start-agents.sh, verify all agents register and monitor
