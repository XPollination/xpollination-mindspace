# PDSA: integration-permission-model

## Plan

Relation-twin-based ACL: scoped task access, rate limiting, brain access scope.

### Three Features

**1. Scoped Task Access (T-SEC-3)**
When runner claims a task, create relation-twin: `{relationType: 'executes', source: runnerDID, target: taskCID}`. On `getTaskDNA()`, verify the relation exists. Runners can only read DNA of tasks they're executing.

**2. Rate Limiting (T-SEC-6)**
Track claim frequency per runner in a sliding window (last 60s). If >N claims/minute, reject. Store as relation-twins: `{relationType: 'claimed', source: runnerDID, target: taskCID, timestamp}`. Count recent relations to determine rate.

**3. Brain Access Scope (T-SEC-8)**
Delegation VC includes `scope.services: ['brain-read', 'brain-write']`. BrainClient checks delegation scope before allowing query/contribute.

### Design

**Files:**
- `src/xp0/node/mindspace-node.ts` — add permission checks to task operations
- `src/xp0/auth/permissions.ts` — new module for relation-based permission checks

```typescript
async canAccessTaskDNA(runnerDID: string, taskCID: string): Promise<boolean> {
  const relations = await this.storage.query({
    kind: 'relation',
    content: { relationType: 'executes', source: runnerDID, target: taskCID }
  });
  return relations.length > 0;
}
```

### Acceptance Criteria
1. Runner can only read DNA of executing tasks (T-SEC-3)
2. Rate limiting rejects fast-claiming runners (T-SEC-6)
3. Brain access requires delegation scope (T-SEC-8)
4. Permissions enforced via relation-twins, not config

### Dev Instructions
1. Create `src/xp0/auth/permissions.ts`
2. Add relation-twin creation on task claim in MindspaceNode
3. Add permission check to getTaskDNA/getTaskByLogicalId
4. Add rate limit check to claimTask
5. Add brain scope check to BrainClient
