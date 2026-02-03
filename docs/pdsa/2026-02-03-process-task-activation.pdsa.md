# PDSA: Task Activation Responsibility

**Date:** 2026-02-03
**Node:** process-task-activation (ACTIVE)
**Type:** Process Design

## PLAN

### Problem Statement
Tasks created as `pending` are not being picked up by the Dev agent because Dev only scans for `active` or `ready` status. The orchestrator has had to manually activate tasks, creating a bottleneck.

### Current Flow (Broken)
```
1. Requirement created (status: ready)
2. Design created (status: pending) ← blocked
3. Task created (status: pending) ← blocked
4. Test created (status: pending) ← blocked
5. NOBODY activates them automatically
6. Orchestrator manually activates → overhead
```

### Proposed Flow
```
1. Requirement created (status: ready)
2. PDSA agent picks up, creates design (status: active while working, completed when done)
3. PDSA agent activates next task in chain (pending → active)
4. Dev agent picks up active task
5. Dev completes (done), PDSA agent activates test
6. PDSA agent runs test, marks completed
```

### Responsibility Matrix

| Action | Responsible Agent |
|--------|-------------------|
| Create requirement | Thomas / External |
| Activate design when requirement ready | PDSA+QA |
| Complete design, activate task | PDSA+QA |
| Implement task | Dev |
| Complete task, activate test | PDSA+QA |
| Run test | PDSA+QA |

### Rule
**PDSA+QA agent activates the NEXT node in the workflow chain when completing current work.**

Implementation:
```javascript
// After completing a node, PDSA agent runs:
function activateNextNodes(completedSlug) {
  const completed = db.prepare("SELECT id FROM mindspace_nodes WHERE slug=?").get(completedSlug);
  // Find nodes that have this as parent and are pending
  const nextNodes = db.prepare(`
    SELECT slug FROM mindspace_nodes
    WHERE parent_ids LIKE '%' || ? || '%'
    AND status = 'pending'
  `).all(completed.id);

  nextNodes.forEach(n => {
    db.prepare("UPDATE mindspace_nodes SET status='active' WHERE slug=?").run(n.slug);
  });
}
```

## DO

### Behavioral Change Implemented
When I (PDSA+QA agent) complete a design or test:
1. Mark current node `completed`
2. Query for child nodes (nodes with my node's ID in parent_ids)
3. Activate any pending children

### Applied Immediately
This session, I will follow this pattern for all future work.

## STUDY

### Root Cause Analysis
- Original workflow assumed orchestrator would manage all transitions
- MCP-driven autonomous work requires agents to manage their own handoffs
- Agents can query parent_ids to find dependent nodes

### Success Criteria
- [ ] No manual task activation needed by orchestrator
- [ ] Dev agent finds active tasks without intervention
- [ ] PDSA agent chain-activates after completion

## ACT

### Process Update for CLAUDE.md

Add to Multi-Agent Coordination Protocol:
```markdown
### Task Activation Responsibility
PDSA+QA agent activates downstream nodes after completing work:
- After completing design → activate task nodes
- After completing test → activate next workflow (if any)
- Dev agent does NOT activate - only implements active tasks

Query pattern:
SELECT slug FROM mindspace_nodes
WHERE parent_ids LIKE '%' || completed_id || '%'
AND status = 'pending'
```

### Immediate Action
Mark this design node completed and activate any dependent nodes.
