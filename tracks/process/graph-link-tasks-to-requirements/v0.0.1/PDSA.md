# PDSA: Link Existing Tasks to Requirements

**Task:** `graph-link-tasks-to-requirements`
**Version:** v0.0.1
**Status:** Design

## Plan

Create a script that maps existing tasks to requirements based on their `group` field, then updates DNA with `requirement_refs` arrays.

### Group-to-Requirement Mapping

| Group Pattern | Requirement(s) | Rationale |
|--------------|----------------|-----------|
| AUTH | REQ-AUTH-001, REQ-AUTH-002 | Authentication tasks |
| WORKFLOW | REQ-WF-001, REQ-WF-002 | Workflow engine tasks |
| A2A | REQ-A2A-001, REQ-A2A-002 | Agent protocol tasks |
| INFRA | REQ-INFRA-001, REQ-INFRA-002 | Infrastructure tasks |
| VIZ | REQ-VIZ-001, REQ-VIZ-002 | Visualization tasks |
| HIERARCHY, H1 | REQ-GRAPH-001, REQ-GRAPH-002 | Hierarchy/graph tasks |
| graph-* (slug) | REQ-GRAPH-001, REQ-GRAPH-002 | This graph-* task series |

### Script: `scripts/link-tasks-to-requirements.js`

```javascript
// 1. Query all tasks from mindspace_nodes
// 2. For each task with a matching group, compute requirement_refs
// 3. Call interface-cli.js update-dna to add requirement_refs
// 4. Report: how many tasks linked, which requirements covered
```

**Algorithm:**
1. Read all non-terminal tasks (`SELECT slug, dna_json FROM mindspace_nodes WHERE status != 'cancelled'`)
2. Parse DNA, check `group` field
3. Apply mapping rules (exact match + prefix match)
4. For tasks already having `requirement_refs`, merge (don't overwrite)
5. Write back via `interface-cli.js update-dna`

**Idempotency:** Merges requirement_refs — running twice adds no duplicates.

### Target: 20+ tasks linked

Based on group counts:
- AUTH: 18 tasks → REQ-AUTH-*
- WORKFLOW: 8 tasks → REQ-WF-*
- HIERARCHY + H1: 28 tasks → REQ-GRAPH-*
- VIZ: 11 tasks → REQ-VIZ-*
- A2A: 6 tasks → REQ-A2A-*
- INFRA: 8 tasks → REQ-INFRA-*

Total: ~79 tasks can be linked. Easily exceeds 20+ target.

## Do

DEV creates `scripts/link-tasks-to-requirements.js` that:
1. Reads task DNA from DB (via sqlite3 or interface-cli list)
2. Applies group→requirement mapping
3. Updates DNA via interface-cli update-dna
4. Outputs summary

## Study

Verify:
- 20+ tasks have `requirement_refs` in DNA
- Each linked requirement exists in requirements table
- Merge logic preserves existing requirement_refs
- Script is idempotent

## Act

### Design Decisions
1. **Script, not migration**: This modifies DNA JSON (workflow data), not schema tables.
2. **Group-based mapping**: Leverages existing group field. No manual slug-by-slug mapping needed.
3. **Merge, don't overwrite**: If task already has requirement_refs, append new ones.
4. **Conservative mapping**: Only map groups with clear capability alignment. Ambiguous groups (A0, A1, etc.) are skipped.
