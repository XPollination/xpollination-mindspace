# PDSA: Agent Role Verification & Zero-Trust Environment

**Date:** 2026-02-06
**Task:** security-agent-role-verification
**Status:** Iteration 1

---

## PLAN

### Problem Statement
On 2026-02-06, a liaison agent transitioned a task using `actor=pdsa`, simulating another role. The CLI (`interface-cli.js`) accepts any actor string without verification. This bypasses workflow gates and corrupts coordination state.

### Investigation Findings

**Security boundary analysis:**
All agents run as the same OS user (`developer`) in the same tmux session. This means:

| Mechanism | Private across panes? | Notes |
|---|---|---|
| tmux pane options (`@var`) | NO | Readable via `tmux list-panes -F '#{@var}'` |
| Environment variables | NO | Readable via `/proc/<pid>/environ` (same user) |
| File permissions | NO | Same user = same read access |
| tmux pane labels | NO | Readable via `tmux list-panes` |

**Conclusion:** True cryptographic isolation between agents is impossible with single-user tmux. Any mechanism an agent can read, another agent CAN read if it tries.

**Actual threat model:**
The threat is NOT malicious agents. Claude agents follow their instructions. The threat is **accidental role confusion** — an agent using the wrong actor name by mistake or because its instructions were ambiguous. The guard rail must catch this failure mode.

### Design Direction
Environment variable + CLI validation. Simple, effective for the actual threat. Honest about limitations.

---

## DO

### 1. Agent Key System

**Key generation:** Human generates a random key per role per session.
```bash
# Example: generate 8-char hex keys
openssl rand -hex 4  # → e.g., a3f7c9d1
```

**Key distribution:** Human sets env var in each tmux pane at agent startup:
```bash
export AGENT_KEY=a3f7c9d1
```

**Key-role mapping (git-tracked):**
File: `config/agent-keys.json`
```json
{
  "keys": {
    "a3f7c9d1": "pdsa",
    "b2e8d4f0": "dev",
    "c1d9e5a2": "qa",
    "d0c8f6b3": "liaison"
  },
  "generated_at": "2026-02-06T10:00:00Z",
  "note": "Rotate keys each session. Keys are guard rails, not cryptographic secrets."
}
```

### 2. CLI Changes (interface-cli.js)

**For state-changing operations** (transition, update-dna, create):
1. Read `$AGENT_KEY` from environment
2. Look up role in `config/agent-keys.json`
3. If key not found → reject with error
4. If key's role doesn't match actor parameter → reject with clear error
5. If valid → proceed

**Read operations** (get, list): No key required. Information is not sensitive.

**Error messages:**
```
No AGENT_KEY environment variable set. Set it: export AGENT_KEY=<your-key>
Unknown key. Check config/agent-keys.json for valid keys.
Role mismatch: your key grants role=dev, but you used actor=pdsa. Use actor=dev.
```

**Bypass for system actor:** `actor=system` requires a separate system key (or `--force` flag with warning log).

### 3. Human Workflow

**Session startup:**
1. Generate keys: `openssl rand -hex 4` (one per role)
2. Update `config/agent-keys.json` with new keys
3. Commit and push (keys are git-tracked — they're guard rails, not secrets)
4. Set env var in each agent's tmux pane before starting Claude:
   ```bash
   export AGENT_KEY=a3f7c9d1  # PDSA pane
   export AGENT_KEY=b2e8d4f0  # Dev pane
   ```
5. Optionally set pane title for visual verification:
   ```bash
   tmux select-pane -T "PDSA:a3f7c9d1"
   ```

### 4. Implementation Subtasks

1. **ST1:** Create `config/agent-keys.json` schema and initial file
2. **ST2:** Add key validation to interface-cli.js (transition, update-dna, create commands)
3. **ST3:** Add clear error messages for missing key, unknown key, role mismatch
4. **ST4:** Update agent-monitor.cjs to pass through AGENT_KEY (read-only, no key needed)
5. **ST5:** Write tests for key validation (valid key, missing key, wrong role, unknown key)
6. **ST6:** Document key generation and distribution process

---

## STUDY

### Why environment variables (despite not being truly private)?

1. **Catches the actual failure mode:** Agent accidentally uses wrong actor name → CLI rejects immediately
2. **Zero friction for correct use:** Agent's env var is set once, every CLI call auto-validates
3. **Honest security model:** We acknowledge the limitation rather than building false confidence
4. **Simple to implement:** ~20 lines of validation code in CLI
5. **Simple to operate:** Human generates keys, sets env vars, done

### What this does NOT protect against
- An agent deliberately reading another pane's /proc/pid/environ (but agents follow instructions)
- An agent reading config/agent-keys.json and using another role's key (but agents follow instructions)
- A compromised agent — but if an agent is compromised, we have bigger problems

### Trade-offs
| Pro | Con |
|---|---|
| Catches accidental role confusion | Not cryptographically secure |
| Simple to implement and operate | Requires human key distribution per session |
| Git-tracked keys = auditable | Extra step in session startup |
| Clear error messages guide agents | Agents could theoretically bypass |

### Risks
- **Key rotation forgotten:** Human forgets to update keys. Mitigation: keys from last session still work, just update periodically.
- **Key committed but not distributed:** Human updates JSON but forgets to set env vars. Mitigation: clear error message tells agent exactly what to do.
- **Over-engineering risk:** This is a guard rail for a 3-agent system on one server. Keep it simple.

---

## ACT

### Acceptance Criteria for Dev

- [ ] AC1: `interface-cli.js` reads `$AGENT_KEY` for transition/update-dna/create
- [ ] AC2: CLI validates key against `config/agent-keys.json`
- [ ] AC3: Role mismatch returns clear error with correct role hint
- [ ] AC4: Missing/unknown key returns actionable error message
- [ ] AC5: Read operations (get, list) work without key
- [ ] AC6: Tests cover: valid key, missing key, unknown key, role mismatch
- [ ] AC7: `config/agent-keys.json` exists with documented schema
- [ ] AC8: Process documented (key generation, distribution, rotation)

### Next Steps
1. Liaison approves this PDSA
2. QA writes tests (TDD)
3. Dev implements against tests
4. QA verifies
