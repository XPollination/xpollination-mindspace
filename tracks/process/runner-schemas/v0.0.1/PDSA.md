# PDSA: runner-schemas

## Plan

Define the 3 well-known JSON Schemas as schema-twins in `src/xp0/schemas/`. These schemas validate runner, team, and delegation-vc twins at runtime.

### Key Decisions

1. **JSON Schema draft-2020-12** — modern standard, well-supported by `ajv`. Each schema is a standard JSON Schema document stored as a twin.

2. **Schema-twins are self-describing** — a schema-twin has `kind: 'schema'` and its content IS the JSON Schema. The twin kernel validates that schema-twin content is valid JSON Schema.

3. **Runtime validation via `ajv`** — add `ajv` as a dependency. The `validateSchema()` function compiles the schema and validates twin content against it.

4. **Schema IDs** — `xp0/runner/v0.0.1`, `xp0/team/v0.0.1`, `xp0/delegation-vc/v0.0.1`. These match the `schema` field in object-twins.

### File Layout

```
src/xp0/schemas/
  index.ts                — re-exports + schema registry
  runner-schema.ts        — schema-runner-v1 JSON Schema definition
  team-schema.ts          — schema-team-v1 JSON Schema definition
  delegation-vc-schema.ts — schema-delegation-vc-v1 JSON Schema definition
  validator.ts            — validateAgainstSchema(twin, schemaRegistry) function
  schemas.test.ts         — tests for all 3 schemas + validator
```

### Schema Definitions

#### 1. schema-runner-v1 (`xp0/runner/v0.0.1`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "xp0/runner/v0.0.1",
  "type": "object",
  "required": ["name", "principal", "owner", "roles", "workload", "hardware", "status", "maxConcurrent", "heartbeatInterval"],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "principal": { "type": "string", "pattern": "^did:key:z6Mk" },
    "owner": { "type": "string", "pattern": "^did:key:z6Mk" },
    "roles": { "type": "array", "items": { "enum": ["liaison", "pdsa", "qa", "dev"] }, "minItems": 1 },
    "workload": {
      "type": "object",
      "required": ["type", "mode"],
      "properties": {
        "type": { "enum": ["claude-code", "ollama", "api"] },
        "binary": { "type": "string" },
        "endpoint": { "type": "string" },
        "mode": { "enum": ["per-task", "persistent"] }
      }
    },
    "hardware": {
      "type": "object",
      "properties": {
        "location": { "type": "string" },
        "network": { "type": "string" },
        "resources": { "type": "object" }
      }
    },
    "status": { "enum": ["ready", "busy", "draining", "stopped"] },
    "maxConcurrent": { "type": "integer", "minimum": 1 },
    "heartbeatInterval": { "type": "integer", "minimum": 1000 },
    "needsSecrets": { "type": "array", "items": { "type": "string" } },
    "delegationVC": { "type": "string" }
  }
}
```

#### 2. schema-team-v1 (`xp0/team/v0.0.1`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "xp0/team/v0.0.1",
  "type": "object",
  "required": ["project", "owner", "agents", "capacity", "state"],
  "properties": {
    "project": { "type": "string", "minLength": 1 },
    "owner": { "type": "string", "pattern": "^did:key:z6Mk" },
    "agents": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["role", "runnerRef"],
        "properties": {
          "role": { "enum": ["liaison", "pdsa", "qa", "dev"] },
          "runnerRef": { "type": "string" }
        }
      }
    },
    "capacity": {
      "type": "object",
      "required": ["maxConcurrentAgents", "availableRoles"],
      "properties": {
        "maxConcurrentAgents": { "type": "integer", "minimum": 1 },
        "availableRoles": { "type": "array", "items": { "type": "string" } }
      }
    },
    "workflow": { "type": "string" },
    "state": { "enum": ["active", "paused", "stopped"] }
  }
}
```

#### 3. schema-delegation-vc-v1 (`xp0/delegation-vc/v0.0.1`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "xp0/delegation-vc/v0.0.1",
  "type": "object",
  "required": ["issuer", "subject", "scope", "validFrom", "validUntil"],
  "properties": {
    "issuer": { "type": "string", "pattern": "^did:key:z6Mk" },
    "subject": { "type": "string", "pattern": "^did:key:z6Mk" },
    "scope": {
      "type": "object",
      "required": ["operations", "roles", "projects"],
      "properties": {
        "operations": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "roles": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "projects": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
      }
    },
    "validFrom": { "type": "string", "format": "date-time" },
    "validUntil": { "type": "string", "format": "date-time" }
  }
}
```

### Validator

```typescript
// src/xp0/schemas/validator.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

function validateAgainstSchema(
  twin: Twin,
  schemaRegistry: Map<string, object>
): { valid: boolean; errors: string[] }
```

### New Dependencies

- `ajv` — JSON Schema validator (draft-2020-12)
- `ajv-formats` — format validation (date-time, etc.)

### Acceptance Criteria Mapping

| Criterion | Test |
|-----------|------|
| Schemas are valid JSON Schema draft-2020-12 | Compile each with ajv, no errors |
| Valid runner twin passes | Create runner content matching schema, validate → true |
| Invalid runner twin fails | Missing required field → specific error |
| Valid team twin passes | Create team content matching schema, validate → true |
| Valid delegation-vc passes | Create VC content matching schema, validate → true |
| Schemas stored as schema-twins | Create schema-twin for each, verify CID |

### Dev Instructions

1. `npm install ajv ajv-formats`
2. Create schema definition files (3 schemas as TypeScript objects)
3. Create `validator.ts` with `validateAgainstSchema()`
4. Create `schemas.test.ts` with validation tests for all 3 schemas
5. Update `src/xp0/schemas/index.ts` barrel export
6. Run `npx tsc --noEmit` and `npx vitest run src/xp0/schemas/`
7. Git add, commit, push

### What NOT To Do

- Do NOT implement schema migration (migratesFrom) — future concern
- Do NOT implement schema discovery/registry beyond hardcoded schemas
- Do NOT add custom keywords to JSON Schema
- Do NOT validate schemas beyond draft-2020-12 compliance

## Study / Act

(Populated after implementation)
