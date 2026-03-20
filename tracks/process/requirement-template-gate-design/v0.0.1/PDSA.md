# PDSA: Requirement Template Gate in Workflow Engine

**Task:** `requirement-template-gate-design`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Requirements can be created with empty or unstructured content_md. A requirement should follow a standard template with 9 sections to be considered "complete" for implementation.

### 9 Section Headings (RequirementInterface v1.0)

1. **Statement** — What the requirement is
2. **Rationale** — Why this requirement exists
3. **Scope** — Boundaries (in/out)
4. **Acceptance Criteria** — How to verify completion
5. **Behavior Specification** — Expected behavior details
6. **Constraints** — Technical or business constraints
7. **Dependencies** — What this depends on
8. **Verification Method** — How to test/verify
9. **Change Impact** — What changes when this is implemented

### Regex Patterns

```javascript
const REQUIRED_SECTIONS = [
  { name: 'Statement', pattern: /^##\s+Statement/mi },
  { name: 'Rationale', pattern: /^##\s+Rationale/mi },
  { name: 'Scope', pattern: /^##\s+Scope/mi },
  { name: 'Acceptance Criteria', pattern: /^##\s+Acceptance\s+Criteria/mi },
  { name: 'Behavior Specification', pattern: /^##\s+Behavior\s+Spec(ification)?/mi },
  { name: 'Constraints', pattern: /^##\s+Constraints/mi },
  { name: 'Dependencies', pattern: /^##\s+Dependencies/mi },
  { name: 'Verification Method', pattern: /^##\s+Verification\s+(Method|Plan)/mi },
  { name: 'Change Impact', pattern: /^##\s+Change\s+Impact/mi }
];
```

### Validation Function

```javascript
function validateRequirementTemplate(contentMd) {
  if (!contentMd) return ['content_md is empty — requirement needs structured content'];

  const missing = REQUIRED_SECTIONS.filter(s => !s.pattern.test(contentMd));
  if (missing.length > 0) {
    return [`Requirement content_md missing ${missing.length} sections: ${missing.map(s => s.name).join(', ')}`];
  }
  return [];
}
```

### Integration Point

**Where:** In cmdCreate, AFTER DNA validation, BEFORE database write.

**When:** Only triggered when creating a task that references a requirement (has `requirement_ref` in DNA). The gate checks the REFERENCED requirement's content_md, not the task's content.

```javascript
// In cmdCreate, after validateDnaFields:
if (dna.requirement_ref) {
  // Look up the referenced requirement
  const req = db.prepare(
    `SELECT content_md FROM requirements WHERE req_id_human = ?`
  ).get(dna.requirement_ref);

  if (req && req.content_md) {
    const templateErrors = validateRequirementTemplate(req.content_md);
    if (templateErrors.length > 0) {
      error(`Requirement ${dna.requirement_ref} does not meet template: ${templateErrors.join('; ')}`);
    }
  }
  // If requirement has no content_md, skip check (backward compat)
}
```

### Decision: content_md NULL vs Empty vs Partial

| State | Behavior |
|-------|----------|
| `NULL` | Skip validation (requirement not yet enriched) |
| Empty string | Error: "content_md is empty" |
| Has some sections | Error: lists missing sections |
| Has all 9 sections | Pass |

### Backward Compatibility

- Tasks without `requirement_ref`: unaffected
- Requirements without `content_md`: unaffected (NULL = skip)
- Only blocks task creation when the referenced requirement has content_md that's incomplete

## Do

DEV adds `validateRequirementTemplate()` to interface-cli.js and integrates into cmdCreate.

## Study

Verify:
- Create task with requirement_ref pointing to fully-templated requirement → success
- Create task with requirement_ref pointing to requirement with missing sections → error listing missing sections
- Create task without requirement_ref → success (unaffected)
- Create task with requirement_ref pointing to requirement with NULL content_md → success (skip)

## Act

### Design Decisions
1. **Gate on task creation, not requirement creation**: Requirements can be created incomplete and enriched later. The gate fires when a task USES the requirement.
2. **Regex for headings**: Simple, fast. Checks structure not content quality.
3. **NULL = skip**: Backward compat. Existing requirements without content_md don't block.
4. **Flexible patterns**: `Behavior Spec` OR `Behavior Specification`, `Verification Method` OR `Verification Plan`.
