# PDSA: runner-team-ui

## Plan

User-facing team management in the Tasks view. Users add/remove agents to projects. Each action evolves the team twin.

### Design

**Backend:** `viz/api/team.js` — REST endpoints for team management
**Frontend:** Team section in Tasks view (existing viz)

### API Endpoints

```
GET    /api/team/:project           — get team twin for project
POST   /api/team/:project/agent     — add agent (evolves team twin)
DELETE /api/team/:project/agent/:id — remove agent (evolves team twin)
PUT    /api/team/:project/state     — pause/resume/stop team
```

### Team Twin (schema xp0/team/v0.0.1)
Already defined in runner-schemas. Content:
```json
{
  "project": "mindspace",
  "owner": "did:key:z6Mk...",
  "agents": [{"role": "dev", "runnerRef": "bafy..."}],
  "capacity": {"maxConcurrentAgents": 4, "availableRoles": ["dev","pdsa","qa"]},
  "state": "active"
}
```

### UI Components
1. **Agent list** — table showing role, runner name, status
2. **Add agent button** — select role + runner from available runners
3. **Remove button** — per agent row
4. **Capacity display** — current/max agents, available roles
5. **Team state toggle** — active/paused/stopped

### Acceptance Criteria
1. GET returns current team twin for project
2. POST adds agent, evolves team twin (new CID)
3. DELETE removes agent, evolves team twin
4. UI displays agent list from team twin
5. Add/remove actions update UI reactively

### Dev Instructions
1. Create `viz/api/team.js` with 4 endpoints
2. Add team section to Tasks view HTML
3. Create `viz/team.test.js` for API tests
4. Git add, commit, push

### What NOT To Do
- Do NOT implement runner discovery (manual add for now)
- Do NOT implement auto-scaling
- Do NOT add WebSocket updates (polling is fine for MVP)
