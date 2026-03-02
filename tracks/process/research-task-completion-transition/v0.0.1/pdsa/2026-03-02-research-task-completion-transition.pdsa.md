# PDSA: Add approval→complete Transition for Research Tasks

**Date:** 2026-03-02
**Task:** research-task-completion-transition
**Status:** PLAN

## Plan

### Problem
Research-only tasks (that produce sub-tasks, not code) go through `approval→approved` which routes to QA (`newRole: 'qa'`). QA has nothing to test on a research task — the deliverable is the PDSA document itself, not code.

**Incident:** `multi-user-brain-research` got stuck at `active+qa` because `approval→approved` automatically sent it to QA. Had to be cancelled via system actor.

**Root cause:** The workflow engine has no `approval→complete` transition. LIAISON must use `approval→approved` even when the task is done after design approval. For research tasks that produce sub-tasks, the research IS done after LIAISON approves — it should go directly to complete.

### Design

#### Change 1: Add `approval->complete` transition for task type
**File:** `xpollination-mcp-server/src/db/workflow-engine.js`

Add after `approval->rework` (line 53):

```javascript
'approval->complete': {
  allowedActors: ['liaison'],
  newRole: 'liaison',
  requiresHumanConfirm: true,
  requiresDna: ['abstract_ref']
},
```

**Properties explained:**
- `allowedActors: ['liaison']` — same as other human-decision transitions. Only LIAISON (human proxy) can execute this.
- `newRole: 'liaison'` — completed tasks owned by liaison (same as `review->complete`).
- `requiresHumanConfirm: true` — Thomas must approve (subject to liaison approval mode gate).
- `requiresDna: ['abstract_ref']` — completion documentation gate applies (consistent with `review->complete` and `any->cancelled`).

**Why not add `thomas` to allowedActors?** The `approval->approved` transition includes `thomas` because it was designed for the early workflow when Thomas interacted directly. The newer pattern (LIAISON as proxy) only needs `liaison`. Keep it consistent with `review->complete` which only allows `liaison`.

#### Change 2: Same for bug type
**File:** `xpollination-mcp-server/src/db/workflow-engine.js`

Bug type doesn't have an `approval` state in its normal flow (bugs go directly `pending→ready→active→review→complete`). However, for consistency and future-proofing, we should NOT add this to bug type since bugs have no approval gate.

**Decision: task type only.** Bug type has no `approval→approved` transition and doesn't need `approval→complete`.

#### Change 3: Update WORKFLOW.md to v15
**File:** `xpollination-mcp-server/tracks/process/context/WORKFLOW.md`

Add to Human-Decision Transitions table:

```markdown
| approval → complete | Human approves research/design task as done (no QA needed) |
```

Add to Quality Gates table:

```markdown
| `approval->complete` | `abstract_ref` | `abstract_ref` must be GitHub URL | LIAISON |
```

Add to Change Log:

```markdown
| 2026-03-02 | v15 | Added approval→complete transition for research tasks that need no QA. Requires abstract_ref, human confirm, liaison only. | PDSA |
```

Add note to PDSA Design Path table:

```markdown
**Note:** For research/design tasks that produce sub-tasks (not code), LIAISON may use `approval→complete` instead of `approval→approved`. This skips QA testing (there's nothing to test) and completes the task directly after human approval.
```

### Files Modified
| File | Change |
|------|--------|
| `src/db/workflow-engine.js` | Add `approval->complete` to task type transitions |
| `tracks/process/context/WORKFLOW.md` | v15: Document new transition, update tables |

### NOT Changed
- Bug type transitions (no approval state in bug flow)
- interface-cli.js (no changes — `requiresHumanConfirm` and `requiresDna` enforcement already works generically)
- Viz server (no UI changes — transition appears naturally)
- Test file (QA writes tests, not PDSA)

### Use Case Flow
```
Research task (e.g., multi-user-brain-research):
  pending → ready(pdsa) → active(pdsa) → approval(liaison)
                                            ↓
                           approval → complete (LIAISON, human approves)
                                            ↓
                                          DONE

Normal task (e.g., multi-user-auth):
  pending → ready(pdsa) → active(pdsa) → approval(liaison)
                                            ↓
                           approval → approved (LIAISON, routes to QA)
                                            ↓
                           ... testing → dev → review chain → complete
```

LIAISON decides which path based on the task nature:
- **Research/design task** (deliverable is sub-tasks): `approval→complete`
- **Implementation task** (deliverable is code): `approval→approved`

### Risks
- **LIAISON misuses the shortcut** — uses `approval→complete` on tasks that DO need QA testing. Mitigation: `abstract_ref` gate ensures LIAISON documents why the task is complete. Thomas reviews the abstract.
- **Both paths available from `approval`** — LIAISON must choose correctly. Mitigation: the choice is clear from task DNA description (research produces sub-tasks, implementation produces code).

### Edge Cases
- **Task already at `approval` with no `abstract_ref`** — transition is blocked by DNA gate. LIAISON must create the abstract first (same as `review→complete`).
- **Existing `approval→approved` still works** — this adds a parallel path, doesn't modify the existing one. No backward compatibility issues.
- **`requiresHumanConfirm` + liaison approval mode** — the 3-mode gate (manual/semi/auto) applies to this transition too, since `requiresHumanConfirm: true` is set.

## Do
(To be completed by DEV agent)

## Study
- approval→complete allowed for liaison on task type
- approval→complete blocked for non-liaison actors
- approval→complete requires abstract_ref in DNA
- approval→complete requires human confirmation
- approval→complete sets role to liaison
- approval→approved still works unchanged
- Bug type has no approval→complete (not needed)
- WORKFLOW.md updated to v15

## Act
- Monitor: does LIAISON correctly choose between approval→complete and approval→approved?
- Consider: add `task_nature: "research"|"implementation"` to DNA to guide LIAISON's choice
