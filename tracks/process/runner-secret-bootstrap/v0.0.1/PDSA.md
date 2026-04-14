# PDSA: runner-secret-bootstrap

## Plan

Bootstrap secret handling for runners. Full X25519 encrypted secret-twins are future work — this task provides a working env-var solution for day 1.

### Design

**File:** `src/xp0/runner/secrets.ts`

```typescript
interface SecretProvider {
  get(name: string): string | undefined;
  has(name: string): boolean;
  required(name: string): string;  // throws if missing
  inject(env: Record<string, string>): Record<string, string>;  // merge secrets into env
}

class EnvSecretProvider implements SecretProvider {
  // Reads from process.env
  // Runner twin lists needsSecrets: ["ANTHROPIC_API_KEY"]
  // On startup, verify all required secrets are present
  // inject() copies only listed secrets into subprocess env
}
```

### Key Decisions
1. **Env vars only** — read from `process.env`, no file-based secrets
2. **Whitelist model** — runner twin's `needsSecrets` array defines which env vars to inject. Only those are passed to Claude subprocess.
3. **Fail-fast** — runner refuses to start if required secrets missing

### Acceptance Criteria
1. `required("ANTHROPIC_API_KEY")` returns value if set, throws if not
2. `inject()` returns env with only whitelisted secrets
3. Runner startup fails if needsSecrets lists unavailable env var
4. Non-listed env vars are NOT leaked to subprocess

### Dev Instructions
1. Create `src/xp0/runner/secrets.ts` with SecretProvider interface + EnvSecretProvider
2. Create `src/xp0/runner/secrets.test.ts`
3. Integrate into Runner.start() — validate secrets before accepting tasks
4. Git add, commit, push

### What NOT To Do
- Do NOT implement X25519 encryption (future)
- Do NOT read from files or vaults
- Do NOT store secrets in twins
