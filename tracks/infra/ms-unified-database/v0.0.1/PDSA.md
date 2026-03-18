# PDSA: Unify Databases — Single Source of Truth

**Task:** ms-unified-database | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Two databases: xpollination.db (mindscape_nodes, CLI/Viz) and mindspace.db (tasks, API/A2A). Tasks in one are invisible to the other. Fundamental A2A blocker.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Migration script: read mindscape_nodes → write to tasks table in mindspace.db | Unify into single DB |
| D2 | Map fields: slug, status, dna_json, parent_ids, type | Schema alignment |
| D3 | Preserve workflow history | Audit trail |
| D4 | CLI and API both read/write tasks table after migration | Single source of truth |
| D5 | xpollination.db becomes read-only archive | No data loss |
| D6 | interface-cli.js switches from mindscape_nodes to tasks table | Core change |

### Acceptance Criteria
- AC1: All 400+ tasks migrated to tasks table with DNA preserved
- AC2: CLI reads/writes tasks table (not mindscape_nodes)
- AC3: API reads/writes same tasks table
- AC4: Workflow history preserved
- AC5: xpollination.db archived, not deleted

### Files: Migration script, `src/db/interface-cli.js`, `api/routes/tasks.ts`
