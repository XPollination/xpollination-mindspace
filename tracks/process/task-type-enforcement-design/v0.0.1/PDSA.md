# PDSA: Task Type Field and Type-Specific DNA Validation

**Task:** `task-type-enforcement-design`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Tasks are created without type classification. A design task and an implementation task have different mandatory fields, but the current validation treats all tasks the same.

### Decision: task_type as DNA field (not top-level column)

**Rationale:** Adding a column requires migration + schema change. DNA is already the flexible data store. `task_type` in DNA is queryable via `json_extract(dna_json, '$.task_type')` and doesn't require schema changes. Backward compat: existing tasks without task_type continue to work.

### task_type Enum

| Type | Purpose | Mandatory Fields |
|------|---------|-----------------|
| `design` | PDSA designs | title, role, description, acceptance_criteria, scope_boundary |
| `test` | QA TDD tests | title, role, description, depends_on (the design it tests) |
| `impl` | DEV implementations | title, role, description, depends_on (the design + test) |
| `bug` | Bug fixes | title, role, description, parent_ids (already enforced) |
| `research` | Investigation/analysis | title, role, description |
| `content` | Content creation | title, role, description |

### Shared Base Fields (all types)

Every task must have:
- `title` (string, non-empty)
- `role` (string, one of: pdsa, dev, qa, liaison)
- `description` (string, non-empty)
- `task_type` (string, one of the enum values above)

### Type-Specific Extensions

**design:**
```json
{
  "task_type": "design",
  "acceptance_criteria": [...],  // array, at least 1 item
  "scope_boundary": { "in_scope": [...], "out_of_scope": [...] }
}
```

**test:**
```json
{
  "task_type": "test",
  "depends_on": [...]  // must reference a design task
}
```

**impl:**
```json
{
  "task_type": "impl",
  "depends_on": [...]  // must reference design + test tasks
}
```

**bug, research, content:** Base fields only. Lighter validation.

### Validation in cmdCreate

```javascript
function validateTaskType(dna) {
  const errors = [];
  const VALID_TASK_TYPES = ['design', 'test', 'impl', 'bug', 'research', 'content'];

  // task_type is optional for backward compat
  if (!dna.task_type) return errors; // skip validation if not set

  if (!VALID_TASK_TYPES.includes(dna.task_type)) {
    errors.push(`task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`);
    return errors;
  }

  // Type-specific validation
  if (dna.task_type === 'design') {
    if (!dna.acceptance_criteria || !Array.isArray(dna.acceptance_criteria) || dna.acceptance_criteria.length === 0) {
      errors.push('Design tasks require acceptance_criteria (non-empty array)');
    }
    if (!dna.scope_boundary || !dna.scope_boundary.in_scope) {
      errors.push('Design tasks require scope_boundary with in_scope');
    }
  }

  if (dna.task_type === 'test' || dna.task_type === 'impl') {
    if (!dna.depends_on || !Array.isArray(dna.depends_on) || dna.depends_on.length === 0) {
      errors.push(`${dna.task_type} tasks require depends_on (reference to design task)`);
    }
  }

  return errors;
}
```

### Backward Compatibility

- Existing tasks without `task_type`: validation skipped, no errors
- New tasks created without `task_type`: allowed (defaults to no type-specific validation)
- Liaison can set `task_type` at creation time to trigger type-specific gates

## Do

DEV adds `validateTaskType()` to interface-cli.js, called from cmdCreate after existing validation.

## Study

Verify:
- `create task my-design '{"title":"x","role":"pdsa","task_type":"design","description":"y"}'` → errors (missing acceptance_criteria)
- `create task my-design '{"title":"x","role":"pdsa","task_type":"design","description":"y","acceptance_criteria":[{"id":"AC1","description":"test"}],"scope_boundary":{"in_scope":["x"],"out_of_scope":[]}}'` → success
- `create task my-old '{"title":"x","role":"dev","description":"y"}'` → success (no task_type, backward compat)

## Act

### Design Decisions
1. **DNA field, not column**: No migration needed. JSON queryable. Flexible.
2. **Optional by default**: Backward compat. Only enforced when task_type is explicitly set.
3. **Lighter validation for research/content**: These are exploratory — don't need rigid structure.
4. **acceptance_criteria as array of objects**: Matches existing pattern in new tasks (see this task's own DNA).
5. **scope_boundary mandatory for design**: Prevents scope creep — must explicitly state what's in/out.
