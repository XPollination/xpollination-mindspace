# E2E Test Report: Agent Experience

**Date:** 2026-03-26
**Environment:** beta-mindspace.xpollination.earth
**Method:** agentic-browser (headless Chrome + agent-browser CLI)
**Script:** `scripts/e2e-agent-experience.sh`

## Test Results

| # | Test | Status | Screenshot |
|---|------|--------|------------|
| 1 | Login | PASS | 01-login.png |
| 2 | Mission Map | PASS | 02-mission-map.png |
| 3 | Kanban + Chat Bubble | PASS | 03-kanban-bubble.png |
| 4 | Agents Dashboard | PASS | 04-agents-dashboard.png |
| 5 | Terminal View Toggle | PASS | 05-terminal-view.png |
| 6 | Chat Bubble Expand (Decision Interface) | PASS | 06-chat-expanded.png |
| 7 | Settings | PASS | 07-settings.png |
| 8 | Missions Kanban | PASS | 08-missions.png |

**Result: 8/8 PASS**

## Test Descriptions

### Test 1: Login
Navigate to `/login`. Fill email + password. Click Sign In. Verify redirect to Mission Map.

### Test 2: Mission Map
After login, verify Mission Map loads with mission cards and nav bar.

### Test 3: Kanban + Chat Bubble
Navigate to `/kanban` (Tasks). Verify kanban columns render with task cards. Verify chat bubble (orange circle) visible in bottom-right corner.

### Test 4: Agents Dashboard
Navigate to `/agents`. Verify `<agent-grid>` component renders with:
- "Agent OS" toolbar
- "+ Start Agent" button
- Dashboard / Terminal view toggle
- Agent cards with green status dots, role badges, A2A event stream

### Test 5: Terminal View Toggle
Click "Terminal" toggle button. Verify:
- View switches to full xterm.js terminal grid
- Terminals show tmux sessions (`node@container:/app$`)
- Catppuccin Mocha theme (dark background, colored text)
- tmux status bar visible at bottom
- Terminal button highlighted, Dashboard button normal

### Test 6: Chat Bubble Expand (Decision Interface)
Click the orange chat bubble. Verify Decision Interface panel opens with:
- "Decision Interface" header
- "Type a message to LIAISON..." input field
- "Send" button
- Panel positioned bottom-right, overlaying page content

### Test 7: Settings
Navigate to Settings. Verify page loads with My Projects, Change Password, API Key sections.

### Test 8: Missions Kanban
Navigate to Missions. Verify missions kanban with Draft/Ready/Active/Complete/Deprecated columns.

## Repeatable Test Script

```bash
# Run the full E2E test suite
bash scripts/e2e-agent-experience.sh https://beta-mindspace.xpollination.earth

# Run against local dev
bash scripts/e2e-agent-experience.sh http://127.0.0.1:4201
```

## What Was Verified (Agent Experience Mission)

| Capability | Component | Verified |
|-----------|-----------|----------|
| Custom Agent Terminal | `<agent-terminal>` xterm.js + tmux WebSocket | YES — terminals render, tmux sessions connect |
| Agent Card | `<agent-card>` with A2A events | YES — green status, event stream, Terminal button |
| Agent Grid | `<agent-grid>` responsive layout | YES — Dashboard/Terminal toggle works |
| Chat Bubble | `<chat-bubble>` Decision Interface | YES — expands on every page, shows input + send |
| Decision Card | `<decision-card>` frame + options | Pending — needs DECISION_REQUEST to test |
| Brain Gate | TRANSITION rejection | Pending — needs agent-level test |
| Workspace Twin | WORKSPACE_DOCK/UNDOCK | Pending — Phase 4 stub |

## Known Issues

1. **agent-browser `open` command loses session cookie** — subsequent `open` calls may redirect to login. Workaround: navigate via click (`@ref`) instead of `open`.
2. **`prompt()` dialog not automatable** — the "+ Start Agent" button triggers `prompt()` for role selection, which headless Chrome can't automate. Test verifies button exists, not the full spawn flow.
3. **Duplicate agent cards on reconnect** — SSE reconnection creates new `connected` events, showing duplicate LIAISON cards. Needs deduplication in `_loadExistingAgents()`.
