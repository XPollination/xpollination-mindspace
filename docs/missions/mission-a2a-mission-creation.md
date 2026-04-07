# A2A Mission Creation Protocol — From Conversation to Executable Tasks

**Ref:** MISSION-A2A-MISSION-CREATION
**Version:** v1.0.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — documenting the manual process for future A2A enforcement

<!-- @section: problem | v:1 -->
## Problem Statement

Every time LIAISON creates a mission with tasks, the same mistakes recur:
1. Tasks skip PDSA (created as role=dev directly)
2. DNA is thin (missing stakeholder, constraints, embedded context)
3. Decisions in the mission have no corresponding tasks
4. Task announcer auto-advances tasks before agents exist

These mistakes happen because:
- The A2A OBJECT_CREATE handler has zero validation
- LIAISON self-enforces quality gates manually — and forgets
- There is no documented process for mission creation
- The same mistakes were already in brain (`h1-2-capability-crud has role:dev`) but LIAISON didn't query brain before creating tasks

This mission documents the **manual process** of creating a mission via A2A, so that when we build enforcement into the A2A protocol, we have the spec.

---

<!-- @section: current-process | v:1 -->
## Current Process (Manual, 2026-04-07)

### Step 1: Research Phase

LIAISON works with Thomas to understand the problem. This involves:
- Reading documentation (not code — documentation IS knowledge)
- Using Chrome CDP sandbox to observe the actual UI
- Querying brain for prior art and known issues
- Producing research findings in the mission document

**Output:** Mission document with problem statement, research tasks, findings.

### Step 2: Decision Phase

From research, LIAISON proposes decisions. Thomas confirms, rejects, or refines.

**Output:** Numbered decisions (D1, D2, ...) in the mission document.

### Step 3: Task Creation (where mistakes happen)

LIAISON creates tasks from decisions. This is where Gate 1-6 must be applied.

**Current flow (manual, error-prone):**
```
LIAISON reads decisions → creates tasks via A2A OBJECT_CREATE → hopes DNA is complete
```

**Required flow (with gates):**
```
LIAISON reads decisions
  → For each decision: draft task DNA
    → Gate 1: 9 mandatory fields present?
    → Gate 2: description embeds context (>200 chars, file paths, reasoning)?
    → Gate 3: every decision has a task?
    → Gate 4: dependencies form valid DAG?
    → Gate 5: verification protocol defined?
    → Gate 6: role = pdsa? (PDSA Design Path)
  → All gates pass → create via A2A OBJECT_CREATE
  → Any gate fails → fix before creating
```

### Step 4: Task Placement

Tasks are created in the BETA system (development environment) at status `pending`.

**Critical rule:** Tasks stay at `pending` until Thomas activates the team. The task announcer (`api/lib/task-announcer.ts`) auto-claims anything at `ready`, `rework`, `approval`, `review`, or `approved` every 10 seconds. `pending` is the only safe state.

When Thomas is ready: transition T1, T2 (the tasks with no dependencies) from `pending → ready`. The announcer delivers them to the PDSA agent.

### Step 5: Verification

As tasks complete, LIAISON verifies each one against the verification protocol defined in the mission before transitioning forward.

---

<!-- @section: a2a-flow | v:1 -->
## A2A Message Flow for Mission Creation

### Creating a mission

```
LIAISON → A2A Server:
{
  "type": "OBJECT_CREATE",
  "object_type": "mission",
  "payload": {
    "slug": "mission-xxx",
    "title": "...",
    "project_slug": "xpollination-mindspace",
    "description": "...",
    "content_md": "full markdown content"
  }
}

A2A Server → LIAISON:
{
  "type": "ACK",
  "object_id": "uuid",
  "object_type": "mission"
}
```

**Current gaps:**
- `content_md` is not set on create (must be done via OBJECT_UPDATE after)
- `short_id` is not auto-generated (must be set via direct DB update)
- No validation on content quality

### Creating a task

```
LIAISON → A2A Server:
{
  "type": "OBJECT_CREATE",
  "object_type": "task",
  "payload": {
    "slug": "ux-xxx",
    "title": "...",
    "project_slug": "xpollination-mindspace",
    "status": "pending",
    "dna": {
      "title": "...",
      "role": "pdsa",              ← MUST be pdsa (Gate 6)
      "group": "MISSION-XXX",
      "priority": "high",
      "description": "...",        ← MUST be >200 chars with embedded context (Gate 2)
      "acceptance_criteria": "...",
      "stakeholder": "...",         ← MUST be present (Gate 1)
      "constraints": "...",         ← MUST be present (Gate 1)
      "depends_on": [],
      "mission_ref": "MISSION-XXX",
      "decisions": "D1"
    }
  }
}
```

**Current gaps (zero validation):**
- Accepts any role (should reject role != pdsa|liaison)
- Accepts empty/missing DNA fields (should require 9 fields)
- Accepts short descriptions (should require >200 chars)
- No check that mission_ref points to an existing mission
- No check that depends_on slugs exist

### Updating mission content

```
LIAISON → A2A Server:
{
  "type": "OBJECT_UPDATE",
  "object_type": "mission",
  "object_id": "mission-xxx",
  "payload": {
    "content_md": "full markdown content"
  }
}
```

**Current gaps:**
- `short_id` update via OBJECT_UPDATE doesn't persist (must use direct DB)
- No version tracking on content_md updates

---

<!-- @section: future-enforcement | v:1 -->
## Future: A2A Enforcement

### Phase 1: Validation gates in OBJECT_CREATE (task)

Add to `api/routes/a2a-message.ts`, case `'task'` (line 721):

```typescript
// Validate task DNA before creation
const dna = payload.dna || {};

// Gate 6: PDSA-first
const initialRole = dna.role || payload.current_role || 'pdsa';
if (!['pdsa', 'liaison'].includes(initialRole)) {
  return res.status(400).json({
    type: 'ERROR',
    error: `Task must start with role=pdsa (PDSA Design Path). Got: ${initialRole}. ` +
           `DEV and QA receive work through the workflow, not direct assignment.`
  });
}

// Gate 1: Required DNA fields
const required = ['title', 'description', 'acceptance_criteria', 'stakeholder', 'priority', 'constraints'];
const missing = required.filter(f => !dna[f]);
if (missing.length > 0) {
  return res.status(400).json({
    type: 'ERROR',
    error: `Task DNA missing required fields: ${missing.join(', ')}`
  });
}

// Gate 2: Self-contained description
if ((dna.description || '').length < 200) {
  return res.status(400).json({
    type: 'ERROR',
    error: `Description too short (${(dna.description || '').length} chars). ` +
           `Must embed file paths, reasoning, and context (>200 chars).`
  });
}
```

### Phase 2: Mission creation with auto short_id

Fix OBJECT_CREATE for missions:
- Auto-generate `short_id` on create (not require manual DB update)
- Accept `content_md` on create (not require separate OBJECT_UPDATE)

### Phase 3: Decision-task coverage check

When all tasks for a mission are created, LIAISON calls a new A2A message type:

```
{
  "type": "MISSION_VALIDATE",
  "mission_id": "mission-xxx",
  "checks": ["decision_coverage", "dependency_dag", "dna_completeness"]
}
```

The server parses the mission `content_md`, extracts decisions (D1..Dn), and checks that every decision has at least one task with `decisions` referencing it.

---

<!-- @section: lessons | v:1 -->
## Lessons from MISSION-TASK-VIEW-UX

| What | Mistake | Root cause | Fix |
|------|---------|-----------|-----|
| Role assignment | 5/8 tasks created as role=dev | No validation in OBJECT_CREATE | Gate 6 in A2A |
| DNA completeness | 0/6 tasks had stakeholder or constraints | No required fields check | Gate 1 in A2A |
| Self-contained | Descriptions were 200 chars, referenced mission | No length/content check | Gate 2 in A2A |
| Decision coverage | D2, D3 had no tasks (2 of 7 decisions) | No systematic check | Gate 3 (manual now, MISSION_VALIDATE later) |
| Auto-advance | Announcer claimed tasks before agents existed | Tasks created at `ready` | Create at `pending`, manually transition to `ready` |
| Brain not queried | Brain already had "tasks must start pdsa" | LIAISON didn't query brain before creating | Query brain for "task creation" before every batch |
