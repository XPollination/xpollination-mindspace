# PDSA: Real-Time Content Validation at Write Time

**Date:** 2026-02-04
**Node:** req-realtime-content-validation (5ee70088-2a9c-4214-9351-13d004aaec72)
**Type:** Requirement
**Status:** ACTIVE

## PLAN

### Problem Statement

`fix-dual-links-display` was marked complete, but `extend-workflow-engine-rules` still had broken format.

**Root cause:** No enforcement mechanism. Agents work outside the system with tools that have no automatic validation.

### Systemic Issue

1. **Knowledge ripple effect:** When rules update, how does the team know?
2. **No validation at write:** Agents can populate fields with invalid data
3. **Discovery too late:** Issues found during manual review
4. **Information overload:** Agents cannot track all rules

### Goals

- AC1: Analyze where validation can be injected (interface-cli.js)
- AC2: Design validation rules for common fields
- AC3: Define error feedback mechanism
- AC4: Ensure validation is automatic (agents cannot bypass)
- AC5: Document how new rules get added

---

## DO (Findings)

### AC1: Validation Injection Points

**Analyzed:** `src/db/interface-cli.js` (358 lines)

**Current validation points:**
| Location | Validation | Type |
|----------|------------|------|
| Line 175-177 | Status value | Enum check |
| Line 89-91 | Actor value | Enum check |
| Line 104-109 | Transition permission | Matrix check |
| Line 214-218 | DNA JSON syntax | Parse check |

**Recommended injection point:** `cmdUpdateDna` function (lines 210-247)

```javascript
// Current flow:
cmdUpdateDna(id, dnaJson, actor)
  → checkPermission(actor, 'updateDna')
  → JSON.parse(dnaJson)
  → merge with existing DNA
  → write to database

// NEW flow with validation:
cmdUpdateDna(id, dnaJson, actor)
  → checkPermission(actor, 'updateDna')
  → JSON.parse(dnaJson)
  → validateDnaFields(dna)  // NEW - validate before write
  → merge with existing DNA
  → write to database
```

### AC2: Validation Rules for Common Fields

**Field validation schema:**

| Field | Type | Validation Rule |
|-------|------|-----------------|
| `status` | enum | Must be in VALID_STATUSES |
| `role` | enum | Must be in ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator', 'system'] |
| `pdsa_file` | path | File MUST exist and be readable |
| `pdsa_ref.git` | url | Must start with https://github.com/ |
| `pdsa_ref.workspace` | path | File MUST exist and be readable |
| `findings` | string | Non-empty when verification_complete=true |
| `proposed_design` | string | Non-empty for type=design when verification_complete=true |

**Implementation:**

```javascript
const FIELD_VALIDATORS = {
  pdsa_file: (value) => {
    if (!fs.existsSync(value)) {
      return `File does not exist: ${value}`;
    }
    return null; // valid
  },

  pdsa_ref: (value) => {
    if (value?.git && !value.git.startsWith('https://github.com/')) {
      return `pdsa_ref.git must be a GitHub URL`;
    }
    if (value?.workspace && !fs.existsSync(value.workspace)) {
      return `pdsa_ref.workspace file does not exist: ${value.workspace}`;
    }
    return null;
  },

  role: (value) => {
    if (!VALID_ACTORS.includes(value)) {
      return `Invalid role: ${value}. Valid: ${VALID_ACTORS.join(', ')}`;
    }
    return null;
  }
};

function validateDnaFields(dna) {
  const errors = [];
  for (const [field, validator] of Object.entries(FIELD_VALIDATORS)) {
    if (dna[field] !== undefined) {
      const error = validator(dna[field]);
      if (error) errors.push(error);
    }
  }
  return errors;
}
```

### AC3: Error Feedback Mechanism

**Design decision:** Reject invalid writes with clear error message.

**Pattern:**
```
Agent attempts: update-dna my-task '{"pdsa_file":"docs/pdsa/"}'
System response:
{
  "error": "Validation failed",
  "fields": {
    "pdsa_file": "File does not exist: docs/pdsa/"
  }
}
```

**Why rejection over inline error storage:**
- Invalid data never enters database
- Agent must fix immediately
- No cleanup needed later
- Clear feedback loop

### AC4: Automatic Enforcement

**Guarantee:** All DNA writes go through `interface-cli.js`

**Current enforcement:**
- Direct SQL access denied per CLAUDE.md instructions
- All agents instructed to use interface-cli.js

**Strengthen with:**
1. Add validation to interface-cli.js (this design)
2. Consider SQLite trigger as backup (write-time check)
3. CI check for direct SQL in code commits

### AC5: Adding New Validation Rules

**Pattern for adding rules:**

1. Add validator function to `FIELD_VALIDATORS` object
2. No code changes needed elsewhere
3. Document rule in CLAUDE.md

**Example adding a new rule:**

```javascript
// Add to FIELD_VALIDATORS:
acceptance_criteria: (value) => {
  if (!Array.isArray(value)) {
    return 'acceptance_criteria must be an array';
  }
  if (value.some(ac => !ac.startsWith('AC'))) {
    return 'Each criterion must start with AC';
  }
  return null;
}
```

---

## STUDY

### Validation

| AC | Design | Status |
|----|--------|--------|
| AC1 | cmdUpdateDna injection point identified | Complete |
| AC2 | Field validators for pdsa_file, pdsa_ref, role | Complete |
| AC3 | Reject invalid writes with error message | Complete |
| AC4 | interface-cli.js is single entry point | Complete |
| AC5 | FIELD_VALIDATORS pattern for extensibility | Complete |

### Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Reject invalid | Clean data, immediate feedback | Blocks agent until fixed |
| Store error inline | Agent can continue | Dirty data, needs cleanup |
| SQLite trigger | Backup enforcement | Complex, harder to debug |

**Recommendation:** Reject invalid writes. Clean data > agent convenience.

---

## ACT

### Implementation Tasks

1. **Dev task:** Add `validateDnaFields()` to interface-cli.js
2. **Dev task:** Add validators for pdsa_file, pdsa_ref, role
3. **Dev task:** Call validation before merge in cmdUpdateDna
4. **Test task:** Verify invalid writes are rejected
5. **Doc task:** Update CLAUDE.md with validation rules

### Proposed Implementation Order

1. Core validation framework (validateDnaFields)
2. pdsa_file validator (most common issue)
3. role validator (prevents agent assignment errors)
4. pdsa_ref validator (format enforcement)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-realtime-content-validation.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-realtime-content-validation.pdsa.md
