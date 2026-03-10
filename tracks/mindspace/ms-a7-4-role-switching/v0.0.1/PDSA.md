# PDSA: Agent role switching endpoint

**Task:** ms-a7-4-role-switching
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Agents need to switch roles dynamically (e.g., a PDSA agent becoming a QA agent). Currently there's no way to change an agent's `current_role` after registration. Role switching must validate the new role is in the agent's capabilities, update the agent record, and prepare for future claim release when lease tables exist.

## Requirements (AC from task DNA)

1. `POST /api/agents/:id/role-switch` with `{ from_role, to_role, reason }`
2. Validates `to_role` is in agent's `capabilities`
3. Releases current claims (future — depends on lease tables)
4. Logs brain thought on role switch
5. Role switch updates agent record

## Investigation

### Existing agents table (008-agents.sql)

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  current_role TEXT,
  capabilities TEXT,   -- JSON array of roles, e.g. '["pdsa","qa"]'
  project_slug TEXT,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  connected_at TEXT,
  last_seen TEXT,
  disconnected_at TEXT
);
```

### Existing agents.ts routes

- VALID_ROLES: `['pdsa', 'dev', 'qa', 'liaison', 'orchestrator']`
- VALID_STATUSES: `['active', 'idle', 'disconnected']`
- POST /register — sets `current_role` and `capabilities` at registration
- Capabilities stored as JSON string array

### Lease/claim tables

No lease or task-claiming tables exist on develop yet (depends on ms-a3-3-task-claiming, ms-a3-4-lease-creation). Claim release on role switch is a future concern. The endpoint should log a placeholder note and be ready for integration.

### Brain integration

The task DNA says "Logs brain thought." The brain API is at `http://localhost:3200/api/v1/memory`. However, the mindspace API server should NOT call the brain directly — that couples two services. Instead, the endpoint returns the role switch result, and the caller (agent/orchestrator) is responsible for brain logging. The endpoint should include enough data in the response for the caller to log.

## Design

### File 1: `api/routes/agents.ts` (UPDATE)

Add role-switch endpoint to existing agents router.

```typescript
// POST /api/agents/:id/role-switch — switch agent role
agentsRouter.post('/:id/role-switch', (req: Request, res: Response) => {
  const { id } = req.params;
  const { from_role, to_role, reason } = req.body;

  // Validate required fields
  if (!to_role) {
    res.status(400).json({ error: 'Missing required field: to_role' });
    return;
  }

  if (!VALID_ROLES.includes(to_role)) {
    res.status(400).json({ error: `Invalid to_role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.status === 'disconnected') {
    res.status(409).json({ error: 'Cannot switch role of disconnected agent' });
    return;
  }

  // Validate from_role matches current role (if provided)
  if (from_role && agent.current_role !== from_role) {
    res.status(409).json({
      error: `Role mismatch: agent current role is '${agent.current_role}', not '${from_role}'`
    });
    return;
  }

  // Validate to_role is in agent's capabilities
  const capabilities = agent.capabilities ? JSON.parse(agent.capabilities) : [];
  if (capabilities.length > 0 && !capabilities.includes(to_role)) {
    res.status(403).json({
      error: `Role '${to_role}' not in agent capabilities: [${capabilities.join(', ')}]`
    });
    return;
  }

  // No-op if already in target role
  if (agent.current_role === to_role) {
    res.status(200).json({
      ...agent,
      capabilities: capabilities,
      switched: false,
      message: `Agent already has role '${to_role}'`
    });
    return;
  }

  const previousRole = agent.current_role;

  // Update role and last_seen
  db.prepare(
    "UPDATE agents SET current_role = ?, last_seen = datetime('now') WHERE id = ?"
  ).run(to_role, id);

  // Future: release claims/leases held under previous role
  // When lease tables exist, add: db.prepare('UPDATE leases SET released_at = ... WHERE agent_id = ? AND released_at IS NULL').run(id);

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;

  res.status(200).json({
    ...updated,
    capabilities: capabilities,
    switched: true,
    previous_role: previousRole,
    reason: reason || null
  });
});
```

Key design decisions:
- **Added to existing agents.ts** — not a separate file; role switching is a core agent operation
- **`from_role` is optional** — allows caller to assert current role for safety (409 if mismatch), but not required
- **Capabilities validation** — if agent has non-empty capabilities array, `to_role` must be in it. If capabilities is empty/null, any valid role is allowed (agent registered without capability restrictions)
- **Disconnected agents can't switch** — must re-register first (409 Conflict)
- **No-op for same role** — returns 200 with `switched: false` instead of error
- **No direct brain call** — returns `previous_role` and `reason` in response so caller can log to brain
- **Future claim release** — comment placeholder for lease table integration
- **Updates `last_seen`** — role switch is agent activity

## Files Changed

1. `api/routes/agents.ts` — Add POST `/:id/role-switch` endpoint (UPDATE)

## Testing

1. POST /role-switch returns 200 with switched agent for valid role switch
2. Response includes `switched: true`, `previous_role`, `reason`
3. Returns 400 when `to_role` is missing
4. Returns 400 when `to_role` is not a valid role
5. Returns 404 for non-existent agent
6. Returns 409 for disconnected agent
7. Returns 409 when `from_role` doesn't match current role
8. Returns 403 when `to_role` is not in agent capabilities
9. Allows any valid role when capabilities is empty/null
10. Returns 200 with `switched: false` when already in target role
11. Updates `current_role` in database after successful switch
12. Updates `last_seen` on successful switch
13. `reason` is included in response when provided
14. `reason` is null when not provided
15. Returns 401 when not authenticated
