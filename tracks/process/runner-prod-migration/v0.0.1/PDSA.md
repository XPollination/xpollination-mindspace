# PDSA: runner-prod-migration

## Plan

Replace the tmux-based "Start Agentic Team" button with the runner system. This is the production cutover.

### Old Flow (Remove)
```
Button click → server spawns tmux sessions → Claude Code starts in panes → terminal WebSocket to browser
```

### New Flow (Implement)
```
Button click → team twin created → runner processes start → runners connect to A2A → status shown in viz
```

### Changes Required

#### 1. Remove Old Agent Spawning
- Remove tmux session creation from `scripts/agent-runtime.js`
- Remove terminal WebSocket forwarding
- Remove pane management code

#### 2. New Team Start Endpoint
- `POST /api/team/:project/start` — creates team twin, starts runner processes
- Uses `TeamManager.addFullTeam()` from runner-team-ui
- Each runner is a child process: `node dist/src/xp0/runner/main.js --config runner-twin-cid`

#### 3. Runner Main Entry Point
- `src/xp0/runner/main.ts` — CLI entry point
  - Reads runner twin CID from `--config` flag
  - Loads runner twin from storage
  - Creates Runner instance
  - Starts lifecycle (start → listen → execute loop → stop on SIGTERM)

#### 4. Viz Updates
- Replace "Start Agentic Team" button behavior
- Show runner status (ready/busy/stopped) instead of tmux pane status
- Team management UI already built (runner-team-ui)

#### 5. Systemd Service Update
- Update `xpollination-mindspace.service` to not start agent-runtime
- Runner processes are managed by TeamManager, not systemd directly

### Acceptance Criteria
1. "Start Agentic Team" creates runners via team twin
2. Runners appear in viz with correct status
3. Old tmux code removed
4. Runners pick up tasks and execute with mock-claude in test
5. SIGTERM triggers clean shutdown (brain contribution, stopped twin)

### Dev Instructions
1. Create `src/xp0/runner/main.ts` entry point
2. Modify team start endpoint to use TeamManager
3. Remove old tmux agent spawning code
4. Update viz to show runner status
5. Test with mock-claude in test environment
6. Git add, commit, push

### What NOT To Do
- Do NOT remove systemd service (still needed for viz/api)
- Do NOT migrate to runner for brain service (brain stays as-is)
- Do NOT implement persistent-session mode (per-task only)
- Do NOT change the A2A server (runners connect to existing A2A)
