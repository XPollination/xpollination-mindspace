# PDSA: runner-mock-claude

## Plan

Create a deterministic test double for Claude Code's `--print` mode. All E2E runner tests need this to avoid non-deterministic output, API costs, and slow inference times.

### Key Decisions

1. **Node.js script** — `src/xp0/test/mock-claude.ts` (compiled to `dist/src/xp0/test/mock-claude.js`). Executable via `node dist/src/xp0/test/mock-claude.js` or as a shebang script.

2. **Two output formats supported:**
   - `--output-format json` (default for `--print`): Single JSON result object on stdout
   - `--output-format stream-json` (requires `--verbose`): JSONL with `init`, `assistant`, `result` events

3. **Deterministic responses** — based on hashing the prompt content. Same prompt = same response. Uses a simple lookup table for known task patterns + a fallback hash-based response.

4. **Configurable failure modes via env vars** — no CLI flag changes needed:
   - `MOCK_CLAUDE_EXIT_CODE=1` — simulate failure
   - `MOCK_CLAUDE_DELAY_MS=30000` — simulate slow response (for timeout tests)
   - `MOCK_CLAUDE_RESPONSE="{...}"` — override response content

### Real Claude Code Output Format (verified 2026-03-31)

**`--output-format json` (used with `--print`):**
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 3230,
  "duration_api_ms": 3180,
  "num_turns": 1,
  "result": "the actual text output",
  "stop_reason": "end_turn",
  "session_id": "uuid",
  "total_cost_usd": 0.01,
  "usage": { "input_tokens": 3, "output_tokens": 4 }
}
```

**`--output-format stream-json --verbose`:**
Line 1 (init):
```json
{"type": "system", "subtype": "init", "session_id": "uuid", "tools": [...], "model": "..."}
```
Line 2 (assistant message):
```json
{"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}, "session_id": "uuid"}
```
Line 3 (result):
```json
{"type": "result", "subtype": "success", "result": "...", "session_id": "uuid", "total_cost_usd": 0}
```

### CLI Interface

```
mock-claude --print -p "prompt text" [--output-format json|stream-json] [--verbose] [--allowedTools ...]
```

Flags accepted (to match real claude):
- `--print` — required, determines non-interactive mode
- `-p "..."` — prompt content
- `--output-format json|stream-json` — output format (default: json for --print)
- `--verbose` — required for stream-json
- `--allowedTools` — accepted but ignored
- `--model` — accepted but ignored
- `--max-turns` — accepted but ignored

### Response Generation

The mock parses the prompt for task keywords to determine response type:

```typescript
function generateResponse(prompt: string): string {
  // Hash prompt for deterministic session_id
  const sessionId = hashToUuid(prompt);
  
  // Detect task type from prompt content
  if (prompt.includes('proposed_design') || prompt.includes('PDSA')) {
    return JSON.stringify({
      proposed_design: "Mock PDSA design for testing",
      pdsa_ref: "https://github.com/test/repo/blob/main/PDSA.md"
    });
  }
  if (prompt.includes('test_plan') || prompt.includes('QA')) {
    return JSON.stringify({
      test_plan: "Mock test plan for testing",
      test_files: ["test/mock.test.ts"]
    });
  }
  if (prompt.includes('implementation') || prompt.includes('DEV')) {
    return JSON.stringify({
      implementation: "Mock implementation for testing",
      files_changed: ["src/mock.ts"]
    });
  }
  // Default: echo back a deterministic hash-based response
  return `Mock response for prompt hash ${hashToHex(prompt).slice(0, 8)}`;
}
```

### File Layout

```
src/xp0/test/
  mock-claude.ts           — main executable script
  mock-claude.test.ts      — vitest tests
  index.ts                 — re-exports (updated barrel)
```

### Acceptance Criteria Mapping

| Criterion | Test |
|-----------|------|
| Accepts same CLI flags as real claude | Parse --print, -p, --output-format, --verbose, --allowedTools |
| Deterministic output | Run twice with same prompt, compare output |
| Output format matches stream-json | Parse JSONL, verify init/assistant/result structure |
| Output format matches json | Parse JSON, verify result object structure |
| Failure mode configurable | Set MOCK_CLAUDE_EXIT_CODE=1, verify exit code |
| Delay mode configurable | Set MOCK_CLAUDE_DELAY_MS=100, verify delay |
| Runner can use mock by changing binary | Point workload.binary to mock-claude, verify E2E flow |

### Dev Instructions

1. Create `src/xp0/test/mock-claude.ts` with CLI arg parsing and response generation
2. Add shebang `#!/usr/bin/env node` at top
3. Create `src/xp0/test/mock-claude.test.ts` with tests per acceptance criteria
4. Update `src/xp0/test/index.ts` barrel export
5. After `npm run build`, verify `node dist/src/xp0/test/mock-claude.js --print -p "test"` outputs valid JSON
6. Test: `MOCK_CLAUDE_EXIT_CODE=1 node dist/src/xp0/test/mock-claude.js --print -p "test"` exits with 1
7. Git add, commit, push each file

### Dependencies

- `node:crypto` — for deterministic hashing
- `node:process` — for env vars and exit codes
- No external deps

### What NOT To Do

- Do NOT implement actual inference
- Do NOT add network calls
- Do NOT make it complex — this is a test double, not a simulator
- Do NOT add tool use simulation (tool use events in stream) — only text responses for now
- Do NOT use timers for delay in tests — mock the delay mechanism

## Study / Act

(Populated after implementation)
