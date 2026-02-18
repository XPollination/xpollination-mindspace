# PDSA: Regulated Database Access - Interface Layer

**Date:** 2026-02-04
**Node:** req-regulated-database-access (5e936caf-44c4-47b8-9eec-8faee2395e87)
**Type:** Requirement
**Status:** ACTIVE

## PLAN

### Problem Statement

All agents have DIRECT database access via `better-sqlite3`. This creates:
- No controlled access patterns
- No validation layer
- No audit trail
- Agents can bypass workflow rules
- Data integrity at risk

### Vision

**Mid-term:** Data lives INSIDE the file (true self-contained objects)
**Short-term:** Regulated interface layer for database access

---

## DO (Findings)

### AC1: Current Direct-Access Chaos

| Agent | Current Access | Risk |
|-------|---------------|------|
| PDSA | Direct DB via node -e | Can bypass workflow rules |
| QA | Direct DB via node -e | Can modify without validation |
| Orchestrator | Direct DB | Can corrupt data |
| LIAISON | Direct DB | No audit trail |
| Dev | Direct DB | Needed for implementation |

**Pattern observed:** All agents run `node -e 'const Database = require("better-sqlite3")...'`

### AC2: Interface Design

```javascript
// src/db/interface.ts

class DatabaseInterface {
  // READ operations (all agents)
  getNode(id: string): Node
  listNodes(filter: NodeFilter): Node[]

  // WRITE operations (validated)
  createNode(type: string, dna: object, actor: string): string
  updateNodeDna(id: string, dna: object, actor: string): void

  // WORKFLOW operations (enforced rules)
  transitionStatus(id: string, newStatus: string, actor: string): void

  // NO raw SQL exposure
  // NO direct db.prepare() access
}

// Validation on every write
function validateTransition(node, newStatus, actor) {
  // Check workflow rules
  // Check actor permissions
  // Validate required DNA fields
  // Return allowed or throw error
}
```

### AC3: Access Control Matrix

| Actor | getNode | listNodes | createNode | updateDna | transition |
|-------|---------|-----------|------------|-----------|------------|
| pdsa | ✓ | ✓ | ✓ | ✓ (own tasks) | ✓ (allowed transitions) |
| qa | ✓ | ✓ | ✗ | ✓ (review fields) | ✓ (review→complete/rework) |
| dev | ✓ | ✓ | ✗ | ✓ (impl fields) | ✓ (active→review) |
| liaison | ✓ | ✓ | ✓ | ✓ | ✓ (all) |
| system | ✓ | ✓ | ✓ | ✓ | ✓ (automated) |

### AC4: Claude Settings Configuration

Add to `.claude/settings.local.json`:

```json
{
  "permissions": {
    "deny": [
      "Bash(sqlite3:*)",
      "Bash(*better-sqlite3*)",
      "Bash(*Database(*xpollination.db*)"
    ],
    "allow": [
      "Bash(node src/db/interface.js:*)"
    ]
  }
}
```

**Note:** This is conceptual - actual Claude settings syntax may differ.

### AC5: Dev Agent Exception

**Temporary exception:** Dev agent keeps direct DB access because:
- Implementing the interface layer itself
- Needs to debug database issues
- Writing migration scripts

**Sunset plan:** Once interface is stable, dev also uses interface.

### AC6: Workflow Engine Connection

Interface integrates with workflow engine design:

```
Agent Request → Interface → Workflow Validator → Database
                              ↓
                         Check rules:
                         - Valid transition?
                         - Actor permitted?
                         - Required fields present?
                         - Output fields before complete?
```

### AC7: Path to Data-Inside-File Vision

**Current:** SQLite database, separate from objects
**Phase 1:** Interface layer (this task)
**Phase 2:** Objects carry their own state in DNA
**Phase 3:** No central database - objects self-contained
**Phase 4:** Objects stored as files with embedded data

```
Today:        Node → DB lookup → data
Future:       Node file contains all data (like biological cell)
```

---

## STUDY

### Implementation Approach

1. Create `src/db/interface.ts` with typed operations
2. Create CLI wrapper `src/db/interface-cli.js` for agent access
3. Add validation logic connecting to workflow rules
4. Update Claude settings to restrict direct access
5. Migrate agents one by one to use interface

### Risk

Agents currently hardcoded to use `better-sqlite3`. Migration requires:
- Updating monitoring skill
- Updating all agent patterns
- Testing thoroughly before enforcement

---

## ACT

### Recommended Next Steps

1. **Dev task:** Create interface module
2. **Dev task:** Create CLI wrapper for agents
3. **Config task:** Update Claude settings
4. **Migration:** Update monitoring skill to use interface
5. **Enforcement:** Enable deny rules after migration

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-regulated-database-access.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-regulated-database-access.pdsa.md
