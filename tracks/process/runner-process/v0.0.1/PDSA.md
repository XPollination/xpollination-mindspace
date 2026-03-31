# PDSA: runner-process

## Plan

Implement the core runner process in `src/xp0/runner/`. This is the main executable — a Node.js process on hardware that receives tasks, calls Claude Code, and returns results as twins.

### Key Decisions

1. **Per-task mode only** — each task spawns `claude --print -p "{DNA}"` as a subprocess. Stateless. The persistent-session mode is a future iteration.

2. **Runner twin as identity** — on startup, the runner creates/loads its runner-twin (schema `xp0/runner/v0.0.1`), registers with local Mindspace via A2A, and starts heartbeating.

3. **Task claiming via twin evolution** — when a task is announced, the runner evolves the task twin from `ready` to `active` with its DID as the claimer. Lowest CID wins conflicts (from tx-validation).

4. **Claude Code bridge** — `child_process.spawn('claude', ['--print', '-p', dnaContent, '--output-format', 'json'])`. Capture stdout, parse JSON result, extract `result` field.

### File Layout

```
src/xp0/runner/
  index.ts              — re-exports
  types.ts              — RunnerConfig, TaskExecution, RunnerState
  runner.ts             — main Runner class (lifecycle + task loop)
  claude-bridge.ts      — spawn claude --print, capture output, parse result
  runner.test.ts        — tests (using mock-claude from src/xp0/test/)
```

### Types

```typescript
// src/xp0/runner/types.ts

interface RunnerConfig {
  name: string;
  roles: string[];              // ["dev", "pdsa", "qa"]
  workload: {
    type: 'claude-code' | 'ollama' | 'api';
    binary: string;             // path to claude binary (or mock-claude)
    mode: 'per-task';           // only per-task for now
  };
  storage: StorageAdapter;
  transport?: TransportAdapter;  // optional for Phase 1 (HTTP fallback)
  keyPair: KeyPair;
  owner: string;                // DID of runner owner
  maxConcurrent: number;
  heartbeatIntervalMs: number;
}

interface TaskExecution {
  taskCid: string;
  startedAt: string;
  prompt: string;
  result?: string;
  exitCode?: number;
  durationMs?: number;
}

type RunnerState = 'starting' | 'ready' | 'busy' | 'draining' | 'stopped';
```

### Runner Lifecycle

```typescript
// src/xp0/runner/runner.ts

class Runner {
  constructor(config: RunnerConfig) {}
  
  // 1. Start: create runner twin, register, start heartbeat
  async start(): Promise<void>
  
  // 2. Listen: subscribe to task announcements
  //    Filter by role match, claim by evolving task twin
  async listenForTasks(): Promise<void>
  
  // 3. Execute: spawn claude --print, capture output
  async executeTask(taskTwin: Twin): Promise<TaskExecution>
  
  // 4. Complete: write result to DNA, evolve task to next state
  async completeTask(taskTwin: Twin, execution: TaskExecution): Promise<void>
  
  // 5. Heartbeat: evolve runner twin with timestamp
  async heartbeat(): Promise<void>
  
  // 6. Drain: stop accepting new tasks, wait for in-flight
  async drain(): Promise<void>
  
  // 7. Stop: contribute to brain, evolve to stopped, cleanup
  async stop(): Promise<void>
  
  // State
  get state(): RunnerState
  get activeTasks(): number
}
```

### Claude Code Bridge

```typescript
// src/xp0/runner/claude-bridge.ts

interface ClaudeResult {
  result: string;
  exitCode: number;
  durationMs: number;
  costUsd?: number;
}

async function executeClaudeCode(
  binary: string,     // path to claude (or mock-claude)
  prompt: string,     // DNA content as prompt
  options?: {
    timeout?: number;           // ms, default 300000 (5 min)
    allowedTools?: string[];
  }
): Promise<ClaudeResult>
```

Implementation: `child_process.spawn(binary, ['--print', '-p', prompt, '--output-format', 'json'])`. Parse stdout as JSON. Return `result` field + metadata.

### Task Flow (per-task mode)

```
1. Runner receives task announcement (via transport or poll)
2. Check: role matches? maxConcurrent not exceeded?
3. Evolve task twin: ready → active (claim with runner DID)
4. Extract DNA content as prompt
5. Spawn: claude --print -p "{DNA}" --output-format json
6. Wait for exit (with timeout)
7. Parse result JSON
8. Update task DNA with result
9. Evolve task twin: active → review (submit for QA)
10. Log execution metrics
```

### Acceptance Criteria Mapping

| Criterion | Test |
|-----------|------|
| Runner starts and creates runner twin | Start → runner twin in storage |
| Heartbeat evolves runner twin | Wait 1 heartbeat → new version |
| Task claim works | Announce task → runner claims (evolves to active) |
| Claude bridge executes mock-claude | Execute → captures deterministic output |
| Result written to DNA | Complete task → DNA has result |
| Task evolved to review | Complete → task twin state = review |
| Drain stops new tasks | Drain → new task announced → not claimed |
| Stop creates stopped twin | Stop → runner twin state = stopped |
| Timeout handled | Set short timeout → returns error |
| Max concurrent respected | 2 tasks, maxConcurrent=1 → second queued |

### Dev Instructions

1. Create `types.ts` with interfaces
2. Create `claude-bridge.ts` — spawn + parse (test with mock-claude)
3. Create `runner.ts` — Runner class with lifecycle
4. Create `runner.test.ts` — use mock-claude binary + FileStorageAdapter
5. Update `src/xp0/runner/index.ts`
6. Run tests, git add/commit/push

### Dependencies

- `src/xp0/twin/` — create, sign, evolve
- `src/xp0/storage/` — StorageAdapter
- `src/xp0/auth/` — KeyPair, DID
- `src/xp0/test/mock-claude.ts` — test double for claude
- `node:child_process` — spawn
- No new npm deps

### What NOT To Do

- Do NOT implement persistent-session mode (future iteration)
- Do NOT implement task queuing beyond maxConcurrent check
- Do NOT add retry logic (fail fast, let workflow handle retry)
- Do NOT implement A2A protocol details (use transport abstraction)
- Do NOT implement secret injection (that's runner-secret-bootstrap)

## Study / Act

(Populated after implementation)
