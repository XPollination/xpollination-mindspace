# PDSA: Digital Twin Protocol for Object Creation and Evolution

**Task:** digital-twin-protocol-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-A2A-003

## Problem

Agents currently create and modify knowledge objects (missions, capabilities, requirements, tasks) via direct `interface-cli.js` calls. There is no structured, validated client-side representation of these objects. This means:

- No client-side validation before submission — errors only surface at the DB layer
- No diff/evolution tracking — changes are opaque write operations
- No typed interface for agents to construct objects correctly
- No standardized submit protocol for A2A-connected agents

The existing **agent twin** (`twin-schema.ts`) handles agent identity/registration. This design addresses **object twins** — client-side representations of knowledge objects.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Plain objects with validation functions** (not classes) | Knowledge objects are data-centric. Functions are lighter, easier to test, serialize cleanly to JSON. No `this` binding issues. Works with existing JSON-based DNA. |
| D2 | **Twins live in `src/twins/` within xpollination-mcp-server** | Closely tied to DB schemas in this repo. Shared npm package adds premature complexity — only agents in this repo use twins currently. Extract later if needed. |
| D3 | **Four twin types: MissionTwin, CapabilityTwin, RequirementTwin, TaskTwin** | Maps 1:1 to the four knowledge object tables. Each has type-specific required fields and validation rules. |
| D4 | **`validate()` returns `{ valid, errors[] }` not throw** | Allows collecting all validation errors at once. Callers decide whether to throw or handle. Composable for batch validation. |
| D5 | **`diff()` returns `{ field: { old, new } }` map** | Field-level diff enables changelogs, evolution tracking, and selective updates. Only changed fields are included. |
| D6 | **Submit protocol: `OBJECT_CREATE` and `OBJECT_UPDATE` A2A message types** | Extends existing `/a2a/message` router. Twin serializes to JSON payload. Server validates server-side before persisting. |
| D7 | **Relationships handled via `node_relationships` references, not embedded** | Twin references related objects by ID. Relationship creation is a separate operation using the existing relationship table. |

### Module Structure

```
src/twins/
├── index.ts                 # Re-exports all twins
├── types.ts                 # Shared types (ValidationResult, DiffResult, TwinBase)
├── mission-twin.ts          # MissionTwin: create, validate, diff
├── capability-twin.ts       # CapabilityTwin: create, validate, diff
├── requirement-twin.ts      # RequirementTwin: create, validate, diff
├── task-twin.ts             # TaskTwin: create, validate, diff
└── submit.ts                # submitCreate(), submitUpdate() — A2A message helpers
```

### Twin Interface (types.ts)

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];  // e.g. ["title is required", "status must be one of: draft, active, complete"]
}

interface DiffEntry {
  old: unknown;
  new: unknown;
}

type DiffResult = Record<string, DiffEntry>;  // { title: { old: "A", new: "B" } }

interface TwinBase {
  _type: 'mission' | 'capability' | 'requirement' | 'task';
  _created_at?: string;  // ISO timestamp, set on create
}
```

### MissionTwin (mission-twin.ts)

```typescript
// Fields mirror: missions table
interface MissionTwin extends TwinBase {
  _type: 'mission';
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'complete' | 'cancelled';
  slug?: string;
  content_md?: string;
}

function createMission(data: Partial<MissionTwin>): MissionTwin;
function validateMission(twin: MissionTwin): ValidationResult;
function diffMission(current: MissionTwin, original: MissionTwin): DiffResult;
```

**Validation rules:**
- `id`: required, non-empty string
- `title`: required, non-empty, max 200 chars
- `status`: required, must be in `['draft', 'active', 'complete', 'cancelled']`
- `description`: optional, max 2000 chars if provided

### CapabilityTwin (capability-twin.ts)

```typescript
interface CapabilityTwin extends TwinBase {
  _type: 'capability';
  id: string;
  mission_id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'blocked' | 'complete' | 'cancelled';
  dependency_ids?: string[];
  sort_order?: number;
  content_md?: string;
}

function createCapability(data: Partial<CapabilityTwin>): CapabilityTwin;
function validateCapability(twin: CapabilityTwin): ValidationResult;
function diffCapability(current: CapabilityTwin, original: CapabilityTwin): DiffResult;
```

**Validation rules:**
- `id`: required, non-empty
- `mission_id`: required, non-empty (must reference existing mission)
- `title`: required, non-empty, max 200 chars
- `status`: required, must be in `['draft', 'active', 'blocked', 'complete', 'cancelled']`
- `sort_order`: if provided, must be non-negative integer

### RequirementTwin (requirement-twin.ts)

```typescript
interface RequirementTwin extends TwinBase {
  _type: 'requirement';
  id: string;
  project_slug: string;
  req_id_human: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'deprecated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  capability_id?: string;
  content_md?: string;
}

function createRequirement(data: Partial<RequirementTwin>): RequirementTwin;
function validateRequirement(twin: RequirementTwin): ValidationResult;
function diffRequirement(current: RequirementTwin, original: RequirementTwin): DiffResult;
```

**Validation rules:**
- `id`: required, non-empty
- `project_slug`: required, non-empty
- `req_id_human`: required, matches pattern `REQ-[A-Z]+-\d{3}`
- `title`: required, non-empty, max 200 chars
- `status`: required, must be in `['draft', 'active', 'deprecated']`
- `priority`: required, must be in `['low', 'medium', 'high', 'critical']`

### TaskTwin (task-twin.ts)

```typescript
interface TaskTwin extends TwinBase {
  _type: 'task';
  slug: string;
  type: string;           // 'task', 'design', 'test', etc.
  status: string;         // Uses VALID_STATUSES from workflow-engine
  parent_ids?: string[];
  dna: {
    title: string;
    role: string;         // Uses VALID_ROLES from workflow-engine
    description?: string;
    [key: string]: unknown;  // DNA is extensible
  };
}

function createTask(data: Partial<TaskTwin>): TaskTwin;
function validateTask(twin: TaskTwin): ValidationResult;
function diffTask(current: TaskTwin, original: TaskTwin): DiffResult;
```

**Validation rules:**
- `slug`: required, non-empty, lowercase with hyphens
- `type`: required, must be in VALID_TYPES
- `status`: defaults to 'pending', must be in VALID_STATUSES
- `dna.title`: required, non-empty
- `dna.role`: required, must be in VALID_ROLES

### Submit Protocol (submit.ts)

```typescript
interface SubmitResult {
  success: boolean;
  id?: string;
  errors?: string[];
}

// For A2A-connected agents
async function submitCreate(twin: TwinBase, agentId: string): Promise<SubmitResult>;
async function submitUpdate(twin: TwinBase, diff: DiffResult, agentId: string): Promise<SubmitResult>;
```

**A2A message format:**

```json
{
  "type": "OBJECT_CREATE",
  "agent_id": "agent-pdsa",
  "payload": { ...twin }
}
```

```json
{
  "type": "OBJECT_UPDATE",
  "agent_id": "agent-pdsa",
  "payload": {
    "_type": "capability",
    "id": "cap-auth",
    "diff": { "title": { "old": "AUTH", "new": "Authentication & Authorization" } }
  }
}
```

**Server-side validation (out of scope for this task but documented):**
- Server re-validates the twin using the same validate() function
- Server checks authorization (does agent have permission for this object type?)
- Server applies diff to existing record
- Server returns SubmitResult

### Acceptance Criteria

- AC1: Four twin modules with create/validate/diff functions
- AC2: validate() catches all required field and constraint violations
- AC3: diff() returns only changed fields with old/new values
- AC4: Submit helpers format correct A2A message payloads
- AC5: All twin types match their corresponding DB table schemas
- AC6: TaskTwin integrates with VALID_STATUSES/VALID_TYPES from workflow-engine

### Test Plan

Tests go in `src/twins/__tests__/`:
- `mission-twin.test.ts` — create, validate (pass/fail), diff
- `capability-twin.test.ts` — create, validate (pass/fail), diff
- `requirement-twin.test.ts` — create, validate (pass/fail), diff
- `task-twin.test.ts` — create, validate (pass/fail), diff, workflow-engine integration
- `submit.test.ts` — message formatting, payload structure

## Do / Study / Act

*(To be filled after implementation)*
