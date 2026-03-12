# PDSA: Component Versioning Gates

**Task:** `component-versioning-gates`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** PDSA agent
**Rework:** Added A2A event emission layer per liaison feedback

---

## PLAN

### Problem Statement

When multiple tasks modify the same component (viz), agents fail to create properly incremental version directories. Evidence: 2 rework cycles across 4 tasks (wf-v18, polling-fix, suspect-viz, capability-drilldown) — first cycle created no version dirs, second cycle created dirs with identical content. 8 total rework transitions = systemic failure.

Root cause: versioning coordination is a cross-agent problem. Agents lose context through compaction, don't see concurrent work, and optimize for task completion over protocol adherence. Per the design principle: "If a protocol requires coordination across agents or sessions, it must be a system gate, not an agent discipline."

### Design Decisions

**D1: Only directory-versioned components are gated.**

viz is currently the only component with version directories. Inline components (workflow-engine.js, interface-cli.js, agent-monitor.cjs) are single files tracked by git — their versioning is commit-based and doesn't need directory coordination. The gate system can be extended to new directory-versioned components later by adding entries to the registry.

**D2: Component registry is a JSON file per project.**

Each project has its own `component-registry.json` at the project root. This keeps the registry close to the code it describes and allows different projects to have different component configurations.

**D3: `modifies` is a DNA field declared by PDSA, immutable after approval.**

PDSA declares which components a task modifies during the design phase (in `dna.modifies[]`). If implementation reveals a new component needs modification, that's a scope change requiring rework back to PDSA. This ensures the gate can validate before dev starts work.

**D4: Version numbers are never reused. Gaps are acceptable.**

If task A creates v0.0.14 and is later reworked, v0.0.14 stays allocated. The reworked version overwrites v0.0.14. The next task gets v0.0.15 regardless. No gaps, no reuse conflicts.

**D5: Cascade detection is out of scope.**

If task A (v0.0.14) is reworked after task B (v0.0.15) completes, B was built on A. Detecting and handling this cascade is a separate, complex problem. For now, `depends_on` ordering and the component lock (preventing concurrent work) minimize the risk. A future task can add cascade detection if needed.

**D6: A2A events are emitted via a lightweight event bus, forward-compatible with future SSE infrastructure.**

No A2A infrastructure (SSE streams, message router, CHECKIN handler) exists in the codebase yet. The research document (`tracks/process/research/2026-02-09-agent-mcp-peer-architecture.pdsa.md`) proposes SSE-based event streams but this is not implemented. The gate events use a simple emit pattern that: (a) writes to a file-based event log immediately, (b) can be upgraded to SSE broadcast when the A2A infrastructure lands. This avoids building throwaway SSE infrastructure while ensuring events are available to agents now.

### Component Registry

**File:** `component-registry.json` (project root)

```json
{
  "components": {
    "viz": {
      "version_dir": "viz/versions/",
      "active_symlink": "viz/active",
      "version_pattern": "v0.0.{n}",
      "files": ["index.html", "server.js", "changelog.json"],
      "gated": true
    }
  }
}
```

Fields:
- `version_dir`: path to version directories (relative to project root)
- `active_symlink`: path to active symlink
- `version_pattern`: naming pattern — `{n}` is the incrementing number
- `files`: expected files in each version directory (for validation)
- `gated`: whether this component is subject to version gates

Only components with `gated: true` trigger the gate logic. Non-gated components are tracked but not enforced.

### Gate Specifications

All gates are implemented as additional checks in `cmdTransition()` in `src/db/interface-cli.js`, following the existing gate pattern (sequential layers after workflow validation).

#### Gate 1: Component Lock

**Trigger:** `ready(dev) → active(dev)` transition for tasks with `dna.modifies[]`

**Logic:**
```
for each component in dna.modifies[]:
  if component.gated:
    query mindspace_nodes WHERE:
      - dna_json LIKE '%"modifies"%' (has modifies field)
      - dna_json contains this component name
      - status IN ('active', 'review', 'rework')
      - id != current task id
    if any found:
      REJECT: "Component '{component}' is locked by task '{slug}' (status: {status}). Wait for that task to reach complete/cancelled."
      EMIT: COMPONENT_LOCKED event
    else:
      // Lock acquired implicitly (task is now active)
```

**Purpose:** Prevents two tasks from modifying the same directory-versioned component concurrently. The lock is implicit — it's based on status, not a separate lock table.

**Lock window:** active, review, rework (task is "in flight")
**Unlock:** complete, cancelled, blocked (task is no longer modifying)

**Implementation note:** The query uses JSON extraction from `dna_json`. SQLite's `json_each()` can parse the `modifies` array:
```sql
SELECT mn.slug, mn.status FROM mindspace_nodes mn, json_each(json_extract(mn.dna_json, '$.modifies')) je
WHERE je.value = ? AND mn.status IN ('active', 'review', 'rework') AND mn.id != ?
```

#### Gate 2: Version Assignment

**Trigger:** `ready(dev) → active(dev)` transition, after Gate 1 passes, for tasks with `dna.modifies[]` containing gated components

**Logic:**
```
for each gated component in dna.modifies[]:
  scan component.version_dir for existing version directories
  extract highest version number (parse v0.0.{n})
  assigned_version = v0.0.{n+1}
  base_version = v0.0.{n}

  write to DNA:
    assigned_versions: { "viz": "v0.0.16" }
    base_versions: { "viz": "v0.0.15" }

  EMIT: VERSION_ASSIGNED event
```

**Purpose:** The system assigns version numbers — agents never choose their own. This eliminates version conflicts and ensures sequential ordering.

**Edge case:** If no versions exist yet, start at v0.0.1 with no base version.

#### Gate 3: Version Validation

**Trigger:** `active(dev) → review(dev)` transition for tasks with `dna.assigned_versions`

**Logic:**
```
for each component in dna.assigned_versions:
  assigned = dna.assigned_versions[component]  // e.g., "v0.0.16"
  base = dna.base_versions[component]          // e.g., "v0.0.15"

  // Check 1: Assigned version directory exists
  if !exists(component.version_dir + assigned):
    REJECT: "Version directory {assigned} not found for component {component}. Expected at: {path}"

  // Check 2: Contains required files
  for each expected file in component.files:
    if !exists(component.version_dir + assigned + '/' + file):
      REJECT: "Missing file {file} in {assigned} for component {component}"

  // Check 3: Differs from base (if base exists)
  if base exists:
    for each file in component.files:
      if file_contents(assigned/file) === file_contents(base/file):
        // All files identical = nothing changed
    if ALL files identical:
      REJECT: "Version {assigned} is identical to base {base} for component {component}. No changes detected."

  // Check 4: Active symlink points to assigned version
  if readlink(component.active_symlink) !== component.version_dir + assigned:
    REJECT: "Active symlink must point to {assigned}, currently points to {current}"

  // Check 5: changelog.json exists and references this task
  changelog = JSON.parse(read(component.version_dir + assigned + '/changelog.json'))
  if changelog.task !== task.slug:
    REJECT: "changelog.json task field must be '{slug}', found '{changelog.task}'"
```

**Purpose:** Ensures the agent actually created the correct incremental version with meaningful changes before submitting for review.

### A2A Event Emission Layer

#### Event Definitions

Three component-specific events emitted by the gate logic:

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `COMPONENT_LOCKED` | Gate 1 rejects (component in use) | `{ component, locked_by_task, locked_by_status, requesting_task, estimated_unlock }` |
| `COMPONENT_AVAILABLE` | Locking task reaches complete/cancelled | `{ component, released_by_task, next_version_available }` |
| `VERSION_ASSIGNED` | Gate 2 assigns version number | `{ component, task_slug, assigned_version, base_version }` |

#### Event Payload Schemas

**COMPONENT_LOCKED:**
```json
{
  "event": "COMPONENT_LOCKED",
  "timestamp": "2026-03-12T12:00:00.000Z",
  "component": "viz",
  "locked_by_task": "wf-v18-approval-mode-enforcement",
  "locked_by_status": "review",
  "requesting_task": "ms-viz-polling-fix-v2",
  "estimated_unlock": "When wf-v18-approval-mode-enforcement reaches complete or cancelled"
}
```

**COMPONENT_AVAILABLE:**
```json
{
  "event": "COMPONENT_AVAILABLE",
  "timestamp": "2026-03-12T12:30:00.000Z",
  "component": "viz",
  "released_by_task": "wf-v18-approval-mode-enforcement",
  "next_version_available": "v0.0.17"
}
```

**VERSION_ASSIGNED:**
```json
{
  "event": "VERSION_ASSIGNED",
  "timestamp": "2026-03-12T12:00:00.000Z",
  "component": "viz",
  "task_slug": "wf-v18-approval-mode-enforcement",
  "assigned_version": "v0.0.16",
  "base_version": "v0.0.15"
}
```

#### Emission Mechanism: File-Based Event Log

**File:** `/tmp/component-events.jsonl` (one JSON object per line, append-only)

**Why file-based (not SSE):**
- No SSE infrastructure exists in the codebase
- Agent monitor (`agent-monitor.cjs`) already uses file-based communication (`/tmp/agent-work-{role}.json`)
- The file-based pattern is proven and agents already know how to read it
- When SSE infrastructure lands (per A2A research doc), the `emitComponentEvent()` function adds a broadcast call — no gate logic changes needed

**Implementation:**

```javascript
// In interface-cli.js — new helper function
function emitComponentEvent(event) {
  const entry = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString()
  });
  const fs = require('fs');
  fs.appendFileSync('/tmp/component-events.jsonl', entry + '\n');

  // Future SSE hook: when A2A infrastructure exists, add:
  // broadcastToSubscribers('component-events', event);
}
```

**Emission points in gate logic:**

1. **Gate 1 — on REJECT:**
```javascript
emitComponentEvent({
  event: 'COMPONENT_LOCKED',
  component: componentName,
  locked_by_task: lockingTask.slug,
  locked_by_status: lockingTask.status,
  requesting_task: currentSlug,
  estimated_unlock: `When ${lockingTask.slug} reaches complete or cancelled`
});
```

2. **Gate 2 — on version assignment:**
```javascript
emitComponentEvent({
  event: 'VERSION_ASSIGNED',
  component: componentName,
  task_slug: currentSlug,
  assigned_version: assignedVersion,
  base_version: baseVersion
});
```

3. **COMPONENT_AVAILABLE — on task completion/cancellation:**

In the existing `cmdTransition` flow, after a successful transition to `complete` or `cancelled`, check if the task had `dna.modifies[]` with gated components:

```javascript
// After successful transition to complete/cancelled:
if (['complete', 'cancelled'].includes(newStatus) && dna.modifies) {
  const registry = loadComponentRegistry();
  for (const comp of dna.modifies) {
    if (registry.components[comp]?.gated) {
      const nextVersion = getNextVersionNumber(registry.components[comp]);
      emitComponentEvent({
        event: 'COMPONENT_AVAILABLE',
        component: comp,
        released_by_task: slug,
        next_version_available: nextVersion
      });
    }
  }
}
```

#### Agent Subscription (Current)

Agents poll the event log when blocked:

```bash
# Check if a component is locked
grep "COMPONENT_LOCKED" /tmp/component-events.jsonl | grep '"viz"' | tail -1

# Check if a component became available
grep "COMPONENT_AVAILABLE" /tmp/component-events.jsonl | grep '"viz"' | tail -1
```

The agent monitor (`agent-monitor.cjs`) can optionally tail this file and include component lock status in its work output. This is a future enhancement — agents can read the file directly for now.

#### Future SSE Upgrade Path

When A2A SSE infrastructure is built (per research doc at `tracks/process/research/2026-02-09-agent-mcp-peer-architecture.pdsa.md`):

1. `emitComponentEvent()` adds `broadcastToSubscribers()` call
2. Agents subscribe to component-specific SSE channels: `GET /api/stream?component=viz`
3. Event format stays identical — only the transport changes
4. File log is retained as audit trail

No gate logic changes needed for the upgrade — only the `emitComponentEvent()` function body changes.

### DNA Field Additions

| Field | Set By | When | Example |
|-------|--------|------|---------|
| `modifies` | PDSA | During design, before approval | `["viz"]` |
| `assigned_versions` | System (Gate 2) | At `ready→active(dev)` | `{"viz": "v0.0.16"}` |
| `base_versions` | System (Gate 2) | At `ready→active(dev)` | `{"viz": "v0.0.15"}` |

`modifies` is validated against `component-registry.json` — unknown components are rejected.

### Workflow Integration

**Where gates fire in `cmdTransition()`:**

```
existing: dependency scheduling gate (pending→ready)
existing: dependency reflection gate (pending→ready)
NEW:      component lock gate (ready→active with modifies[])
NEW:      version assignment gate (ready→active with gated components)
existing: version enforcement gate v2 (active→approval/review with pdsa_ref)
NEW:      version validation gate (active→review with assigned_versions)
existing: changelog quality gate (→complete)
NEW:      component available event (→complete/cancelled with modifies[])
existing: liaison approval mode gate (human-decision transitions)
existing: role consistency enforcement (all transitions)
```

### `requiresDna` Update

Add `modifies` to the `active→approval` transition's requiresDna:

```javascript
'active->approval': {
  allowedActors: ['pdsa'],
  requireRole: 'pdsa',
  requiresDna: ['pdsa_ref', 'memory_contribution_id', 'modifies'],
  newRole: 'liaison'
}
```

This ensures PDSA declares `modifies` before submitting for approval. If a task doesn't modify any gated component, it declares `modifies: []` (empty array).

**Note:** Do NOT add `modifies` to `ready→active(dev)` requiresDna — it must already be in DNA from the PDSA phase (set before `active→approval`).

### Files Changed

| File | Change |
|------|--------|
| `component-registry.json` (NEW) | Component registry with viz entry |
| `src/db/interface-cli.js` | Add 3 gate functions, `emitComponentEvent()` helper, COMPONENT_AVAILABLE emission on complete/cancelled |
| `src/db/workflow-engine.js` | Add `modifies` to `active->approval` requiresDna |

### Verification Plan

1. **Component lock:** Create two tasks with `modifies: ["viz"]`. Transition first to active. Second task's `ready→active` should be rejected with lock error.
2. **Lock event:** After rejection, `/tmp/component-events.jsonl` contains COMPONENT_LOCKED event with correct payload.
3. **Version assignment:** Transition a task with `modifies: ["viz"]` to active. Check DNA — `assigned_versions` and `base_versions` should be auto-populated.
4. **Assignment event:** `/tmp/component-events.jsonl` contains VERSION_ASSIGNED event.
5. **Validation — missing dir:** Try `active→review` without creating the version directory. Should be rejected.
6. **Validation — identical content:** Create version dir but copy base without changes. Should be rejected.
7. **Validation — wrong symlink:** Create version dir with changes but don't update symlink. Should be rejected.
8. **Validation — wrong changelog task:** Create version dir with changelog referencing different task. Should be rejected.
9. **Happy path:** Create proper version dir with changes, correct symlink, correct changelog. `active→review` should pass.
10. **Available event:** Complete the first task. `/tmp/component-events.jsonl` contains COMPONENT_AVAILABLE event. Second task can now transition to active.
11. **No modifies:** Task without `modifies` field — all gates are skipped, behaves like today. No events emitted.
12. **Empty modifies:** Task with `modifies: []` — all gates are skipped. No events emitted.
13. **Unknown component:** Task with `modifies: ["unknown"]` — rejected at approval gate.

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
