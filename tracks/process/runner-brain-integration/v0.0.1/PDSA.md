# PDSA: runner-brain-integration

## Plan

Connect runners to the brain cognitive layer. Runners query brain on startup for recovery context and contribute learnings on shutdown.

### Design

**File:** `src/xp0/runner/brain-client.ts`

```typescript
interface BrainClient {
  query(prompt: string): Promise<BrainResponse>;
  contribute(prompt: string, context?: string): Promise<void>;
  isHealthy(): Promise<boolean>;
}

class HttpBrainClient implements BrainClient {
  constructor(private baseUrl: string, private apiKey: string, private agentId: string) {}
  // POST /api/v1/memory with read_only=true for queries
  // POST /api/v1/memory for contributions (>50 chars, declarative)
  // GET /api/v1/health for health checks
}

class LocalFallbackBrainClient implements BrainClient {
  // When brain is unavailable, writes to local JSON file
  // Drains local queue when brain comes back
}
```

### Key Decisions
1. **HTTP client wrapping existing brain API** — same endpoint runners use manually
2. **Local fallback** — if brain is down, queue contributions to `{storeDir}/_brain-queue.json`
3. **Startup recovery** — query for `"Recovery protocol for {role} runner"` and `"Current task state"`
4. **Shutdown contribution** — `"Runner {name} shutting down. Completed {n} tasks. Key learnings: ..."`

### Acceptance Criteria
1. query() returns brain results when healthy
2. contribute() stores in brain when healthy
3. Local fallback queues when brain is down
4. Drain sends queued contributions when brain recovers
5. Runner.start() queries brain for recovery
6. Runner.stop() contributes summary

### Dev Instructions
1. Create `src/xp0/runner/brain-client.ts`
2. Create `src/xp0/runner/brain-client.test.ts` (mock HTTP)
3. Integrate into Runner lifecycle
4. Git add, commit, push

### What NOT To Do
- Do NOT implement brain search/vector features
- Do NOT cache brain responses locally
- Do NOT make brain a hard dependency (fallback must work)
