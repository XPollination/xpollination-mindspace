# PDSA: Agent Role Verification & Zero-Trust Environment

**Date:** 2026-02-06
**Task:** security-agent-role-verification
**Status:** Iteration 2 (rework v3 — auto-registration, zero human involvement)

---

## PLAN

### Problem Statement
On 2026-02-06, a liaison agent transitioned a task using `actor=pdsa`, simulating another role. The CLI accepts any actor string without verification.

### Rework v3 Feedback
Thomas rejected the manual key approach: "Key generation must be fully automatic — zero human involvement." Human only starts agents with a role parameter; everything else is automatic.

### Security Boundary (unchanged from v1)
All agents run as same OS user in same tmux session. True isolation impossible. The guard rail catches **accidental role confusion**, not malicious agents.

---

## DO

### 1. Agent Self-Registration

**Flow:**
```
1. Human starts agent (Claude) in tmux pane with role instruction
2. Agent's first action: register with the PM system
3. CLI generates unique key, stores key→role mapping
4. Agent receives key, exports to its environment
5. All subsequent CLI calls use this key automatically
```

**Registration command:**
```bash
node src/db/interface-cli.js register <role>
# Returns: {"key":"a3f7c9d1","role":"pdsa","registered_at":"..."}
```

**What happens internally:**
1. Generate random 8-char hex key: `crypto.randomBytes(4).toString('hex')`
2. Store in `data/agent-keys.json` (runtime file, NOT git-tracked):
   ```json
   {
     "keys": {
       "a3f7c9d1": {"role": "pdsa", "registered_at": "2026-02-06T10:00:00Z", "pane": "%6"},
       "b2e8d4f0": {"role": "dev", "registered_at": "2026-02-06T10:00:05Z", "pane": "%7"}
     }
   }
   ```
3. Return the key to the agent

**Agent startup (in CLAUDE.md or agent instructions):**
```bash
# Agent registers itself on startup
AGENT_KEY=$(node src/db/interface-cli.js register pdsa | node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d).key))")
export AGENT_KEY
```

### 2. CLI Validation (same as v1, different key source)

**For state-changing operations** (transition, update-dna, create):
1. Read `$AGENT_KEY` from environment
2. Look up role in `data/agent-keys.json`
3. If key not found → reject: `Unknown AGENT_KEY. Run: register <role>`
4. If key's role doesn't match actor → reject: `Role mismatch: key grants role=dev, used actor=pdsa`
5. If valid → proceed

**Read operations** (get, list): No key required.

**Error messages:**
```
No AGENT_KEY set. Register first: AGENT_KEY=$(node src/db/interface-cli.js register <role> | ...)
Unknown AGENT_KEY. Register: node src/db/interface-cli.js register <role>
Role mismatch: your key grants role=dev, but you used actor=pdsa. Use actor=dev.
```

### 3. Key Storage

**Location:** `data/agent-keys.json` (runtime, gitignored)
- NOT git-tracked (keys are ephemeral per session)
- Created automatically on first `register` call
- Each agent registers independently
- Multiple agents can register for same role (e.g., two dev panes)

### 4. Deregistration (optional)

```bash
node src/db/interface-cli.js deregister <key>
```
Removes key from mapping. Useful for cleanup, but not required — keys file is ephemeral.

### 5. Audit Trail

Each registration logged to `data/agent-audit.log`:
```
2026-02-06T10:00:00Z REGISTER role=pdsa key=a3f7c9d1 pane=%6
2026-02-06T10:05:00Z TRANSITION slug=my-task from=ready to=active actor=pdsa key=a3f7c9d1
```

### 6. Human Workflow (simplified)

**Before (rejected):** Generate keys, update JSON, set env vars per pane.
**After:** Start Claude agent with role instruction. Agent self-registers. Done.

```
Human starts agent → Agent reads role from instructions → Agent runs register → Agent has key → Done
```

### 7. Implementation Subtasks

1. **ST1:** Add `register` command to interface-cli.js (generates key, stores in data/agent-keys.json)
2. **ST2:** Add key validation to transition/update-dna/create commands
3. **ST3:** Add clear error messages for missing key, unknown key, role mismatch
4. **ST4:** Add `data/agent-keys.json` to .gitignore
5. **ST5:** Add audit logging (data/agent-audit.log)
6. **ST6:** Write tests: register, validate, mismatch, missing key
7. **ST7:** Update CLAUDE.md with agent startup registration command

---

## STUDY

### v1 vs v2 Comparison

| Aspect | v1 (manual) | v2 (auto-register) |
|---|---|---|
| Key generation | Human runs openssl | CLI generates automatically |
| Key distribution | Human sets env vars | Agent self-registers |
| Human steps | 4+ per session | 0 (just start agents) |
| Key storage | git-tracked JSON | runtime file (gitignored) |
| Rotation | Manual | Automatic per session |
| Multiple agents same role | One key per role | Each agent gets unique key |

### Why auto-registration works

1. **Zero friction:** Agent registers on startup, no human steps
2. **Unique keys per agent:** Two dev agents get different keys (auditable)
3. **Ephemeral:** Keys don't persist across sessions (data/ file, not git)
4. **Same guard rail:** Still catches accidental role confusion
5. **Same limitation:** Not cryptographically secure (same user), but that's honest

### Risks

- **Race condition:** Two agents register simultaneously. Mitigation: file locking or atomic writes.
- **Key file corruption:** Mitigation: validate JSON on read, regenerate if corrupt.
- **Agent forgets to register:** Mitigation: clear error message tells agent exactly how to register.

---

## ACT

### Acceptance Criteria for Dev

- [ ] AC1: `register <role>` command generates key and stores in `data/agent-keys.json`
- [ ] AC2: `transition`/`update-dna`/`create` validate `$AGENT_KEY` against stored keys
- [ ] AC3: Role mismatch returns clear error with correct role hint
- [ ] AC4: Missing/unknown key returns actionable error with register command
- [ ] AC5: Read operations (get, list) work without key
- [ ] AC6: `data/agent-keys.json` is gitignored
- [ ] AC7: Audit log written to `data/agent-audit.log`
- [ ] AC8: Tests cover: register, valid key, missing key, unknown key, role mismatch
- [ ] AC9: CLAUDE.md updated with agent startup registration command

### Next Steps
1. Liaison approves this PDSA
2. QA writes tests (TDD)
3. Dev implements against tests
4. QA verifies
