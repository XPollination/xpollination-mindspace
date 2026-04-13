# A2A Agent Body — LLM-Agnostic Agent Runtime

**Ref:** MISSION-A2A-AGENT-BODY
**Version:** v1.0.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Active — PoC proven 2026-04-08, end-to-end working
**Supersedes:** MISSION-AGENT-WORKSPACE (writable container mount approach abandoned)

<!-- @section: journey | v:1 -->
## The Journey (2026-04-07 → 2026-04-08)

| Step | What happened | What it revealed |
|------|--------------|-----------------|
| 1. Task View UX mission | Chrome CDP sandbox audit of kanban. Filter bugs found. | Agents can't see the UI. Need config-driven board. |
| 2. Created tasks for UX mission | 6 tasks, thin DNA, missing decisions | LIAISON task quality gates needed — 6 gates defined |
| 3. Tasks auto-advanced | Announcer claimed tasks before agents existed | `pending` is the only safe state. Announcer grabs `ready`. |
| 4. Activated viz +Team agents | Agents ran inside Docker, created files | Work trapped in ephemeral container. No git. No persistence. |
| 5. Tried to fix container | Writable mounts, git install, SSH keys | Each fix created new problems. Fighting the architecture. |
| 6. Thomas stopped it | "We already solved this on the host" | Container is for API/viz/DB. Agents don't belong inside. |
| 7. The insight | Separate brain (LLM) from body (A2A protocol) | One file. Any LLM. Any host. Same protocol. |
| 8. Built xpo-agent.js | 335 lines, zero dependencies, reused sse-bridge patterns | Connects, streams, launches Claude in tmux on host |
| 9. Integrated claude-session.sh | `claude-session agent-pdsa` | Thomas types one command, gets A2A-connected agent |
| 10. **End-to-end proof** | Task ready → SSE → xpo-agent → Claude works | **It works.** Full workspace, git, CLAUDE.md, everything. |

<!-- @section: problem | v:1 -->
## Problem Statement

Agents spawned via viz +Team run inside the Docker container. This creates problems that don't exist on the host: no git, ephemeral filesystem, no SSH, shared branch state, no CLAUDE.md, no skills. The container approach tries to recreate a development environment inside Docker — solving problems we already solved on the host.

The real value of the container is: A2A server, viz, database. The agents don't need to be inside it.

### The insight

Separate the **brain** (LLM — Claude, ChatGPT, Ollama) from the **body** (A2A identity + protocol). The body is a lightweight process that authenticates with A2A, opens the event channel, and launches any LLM with the right context. The LLM runs on the host with full workspace access.

---

<!-- @section: design | v:1 -->
## Design: `xpo-agent` — The A2A Body

### Architecture

```
┌──────────────────────────────────┐
│  xpo-agent (A2A Body)            │
│                                  │
│  1. Connect to A2A server        │
│  2. Authenticate, get agent_id   │
│  3. Open SSE event stream        │
│  4. Build system prompt with:    │
│     - Agent identity             │
│     - A2A commands (curl)        │
│     - Project + workspace context│
│  5. Launch LLM process           │
│  6. Bridge events → terminal     │
│  7. Send heartbeats              │
└────────┬─────────────────────────┘
         │ launches
         ▼
┌──────────────────────────────────┐
│  LLM (replaceable)              │
│                                  │
│  claude / chatgpt / ollama       │
│  Runs on host. Full workspace.   │
│  Sends A2A messages via curl.    │
│  Commits via git.                │
└──────────────────────────────────┘
```

### Usage

```bash
# Start a PDSA agent with Claude Code
xpo-agent --role pdsa --project xpollination-mindspace --api http://localhost:3101

# Start a DEV agent with Ollama
xpo-agent --role dev --project xpollination-mindspace --llm ollama --model codellama

# Start a QA agent, connect to remote hub
xpo-agent --role qa --project xpollination-mindspace --api https://mindspace.xpollination.earth
```

### What xpo-agent does

1. **Connect:** POST /a2a/connect with role, project, capabilities → receives agent_id
2. **Stream:** Opens SSE at /a2a/stream/{agent_id} — receives task events
3. **Prompt:** Builds system prompt with A2A identity, commands, workspace path
4. **Launch:** Starts LLM process (default: claude) in the project workspace directory
5. **Bridge:** Forwards SSE events to LLM's terminal as task instructions
6. **Heartbeat:** Sends periodic heartbeats to keep connection alive
7. **Cleanup:** On exit, sends DISCONNECT to A2A

### What the LLM receives (system prompt)

```
You are the {ROLE} agent in XPollination Mindspace.

## Identity
- Role: {role}
- Agent ID: {agent_id}
- Project: {project_slug}
- A2A Server: {api_url}

## A2A Commands
Send messages:
  curl -s -X POST {api_url}/a2a/message \
    -H 'Content-Type: application/json' \
    -d '{"agent_id":"{agent_id}","type":"<TYPE>", ...}'

Deliver work:
  node {body_path}/a2a-deliver.js --slug <task> --transition <status> --role {role}

## Workspace
Working directory: {workspace_path}
Git configured. Commit and push your changes.
```

This is LLM-agnostic — it's text. Works for Claude, ChatGPT, Ollama, anything with shell access.

### Why this is portable (Robin's hub)

```
Robin's server:
  $ xpo-agent --role dev \
              --project xpollination-mindspace \
              --api https://mindspace.xpollination.earth \
              --workspace ~/workspaces/xpollination-mindspace \
              --llm ollama --model codellama
```

Same tool. Different host, different LLM, different workspace path. Same A2A protocol.

---

<!-- @section: implementation | v:1 -->
## Implementation Plan

### File: `src/a2a/xpo-agent.js`

Single file. No build step. Runs with Node.js.

Existing pieces to reuse:
- `src/a2a/sse-bridge.js` — SSE connection + event parsing (merge into xpo-agent)
- `scripts/a2a-deliver.js` — delivery script (agents call this)
- `scripts/start-agent.sh` — system prompt template (extract and improve)

### Phase 1: Standalone body (today)

Create `xpo-agent.js` that:
- Parses args: --role, --project, --api, --workspace, --llm
- Connects to A2A
- Opens SSE stream
- Builds system prompt
- Launches LLM in project workspace
- Bridges events to terminal
- Sends heartbeats

Test: run from this host session, connect to beta A2A, receive events.

### Phase 2: Viz integration

Update `team.ts` to:
- Instead of creating tmux+claude inside container
- Call a host-side endpoint or script that runs `xpo-agent`
- Viz terminal connects to host tmux (original runner architecture)

### Phase 3: Multi-LLM

- Claude Code: default, uses --append-system-prompt
- Ollama: launch via `ollama run` with piped system prompt
- ChatGPT: launch via API wrapper CLI
- Generic: any process that reads stdin/stdout

---

<!-- @section: ancillary | v:1 -->
## Ancillary Fixes (from MISSION-AGENT-WORKSPACE)

These remain valid regardless of body architecture:

| Fix | Description |
|-----|-------------|
| tmux mouse scroll | `set -g mouse on` in container tmux.conf — mousewheel should scroll, not send key up/down |
| +Team disabled without project | Buttons greyed out when "All Projects" selected, tooltip "Select a project first" |
| Agents blind to unclaimed DNA | Announcements summary-only. Full DNA after claim. OBJECT_QUERY restricted by role. |
| Pending = hard boundary | No task delivery for status=pending. SSE bridge must verify status. |

---

<!-- @section: decisions | v:1 -->
## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Agents run on host, not in container | Container is for API/viz/DB. Host has workspace, git, SSH, skills. |
| D2 | xpo-agent is the A2A body — separate from LLM | Brain (LLM) is replaceable. Body (A2A protocol) is constant. |
| D3 | Single Node.js file, no build step | Must run anywhere with just `node xpo-agent.js`. Robin installs one file. |
| D4 | System prompt is LLM-agnostic text | curl commands work in any shell. No Claude-specific APIs required. |
| D5 | Viz +Team triggers host-side agent start | Container doesn't create tmux sessions. Host does. |
| D6 | Supersedes MISSION-AGENT-WORKSPACE | Container writable mount approach abandoned. A2A body is the solution. |
