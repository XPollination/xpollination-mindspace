# PDSA: integration-team-api

## Plan

REST API endpoints connecting TeamManager to the viz frontend.

### Endpoints

Add to `viz/server.js`:

```
GET    /api/team/:project          — getTeam() → team twin + runner statuses
POST   /api/team/:project/start    — addFullTeam() → creates 4 runners
POST   /api/team/:project/agent    — addRunner({role}) → single runner
DELETE /api/team/:project/agent/:id — terminateRunner(id)
PUT    /api/team/:project/state     — pause/resume team
GET    /api/team/:project/runners   — getRunners() → runner status list
```

### Integration Points
- `TeamManager` from `src/xp0/runner/team-manager.ts` (12 tests pass)
- `MindspaceNode` provides storage + transport context
- Replace old tmux agent spawning in "Start Agentic Team" button

### Acceptance Criteria
1. GET /api/team/:project returns current team state
2. POST /start creates team with 4 runners
3. DELETE /agent/:id terminates runner
4. Frontend button triggers /start instead of tmux
5. Runner status visible via /runners

### Dev Instructions
1. Add routes to viz/server.js
2. Import TeamManager, create instance per project
3. Wire "Start Agentic Team" button to POST /start
4. Add test file for API routes
