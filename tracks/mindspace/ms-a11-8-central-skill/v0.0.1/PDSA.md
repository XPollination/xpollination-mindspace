# PDSA: Central Skill Script (/xpo.agent.connect/)

**Task:** ms-a11-8-central-skill
**Status:** Design
**Version:** v0.0.1

## Plan

Create a Claude Code skill (`SKILL.md`) that bootstraps any agent from zero knowledge. The skill reads its invocation name suffix to determine the role, fetches the Agent Card for endpoint discovery, builds a digital twin, authenticates via A2A connect, opens an SSE stream, and enters a message handler loop.

### Dependencies

- **ms-a11-5-a2a-message-router** (complete): A2A message router
- **t1-3-repos-bootstrap** (complete)

### Investigation

**Current infrastructure:**
- Agent Card at `GET /.well-known/agent.json` returns endpoints, auth config, capabilities
- Twin schema at `GET /schemas/digital-twin-v1.json` defines identity, role, project, state, metadata
- A2A connect at `POST /a2a/connect` validates twin, returns WELCOME with agent_id + session_id + endpoints
- A2A stream at `GET /a2a/stream/:agentId` opens SSE connection for push messages
- A2A message at `POST /a2a/message` for agent→server messages (HEARTBEAT, ROLE_SWITCH, etc.)

**Design decisions:**
- Skill is invoked as `/xpo.agent.connect` or `/xpo.agent.connect.{role}` (e.g., `/xpo.agent.connect.pdsa`)
- If role suffix present, use it directly. If not, prompt agent to specify role
- Skill uses `curl` for HTTP calls (available in all Claude Code environments)
- Env vars: `MINDSPACE_URL`, `MINDSPACE_API_KEY`, `MINDSPACE_PROJECT` (project slug)
- SSE listening is done via `curl -N` in background with event parsing
- Message handler loop processes SSE events and dispatches to role-specific actions
- Skill is a single SKILL.md file installed at `~/.claude/skills/xpo.agent.connect/SKILL.md`
- Role symlinks (ms-a11-9) will create `/xpo.agent.connect.pdsa` etc. as aliases

## Do

### File Changes

#### 1. `skills/xpo.agent.connect/SKILL.md` (NEW)

```markdown
# XPollination Agent Connect

Bootstrap a Claude Code agent into the Mindspace orchestration system.

## Invocation

\`\`\`
/xpo.agent.connect          # prompts for role
/xpo.agent.connect.pdsa     # connects as PDSA agent
/xpo.agent.connect.dev      # connects as DEV agent
/xpo.agent.connect.qa       # connects as QA agent
/xpo.agent.connect.liaison  # connects as LIAISON agent
\`\`\`

## Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MINDSPACE_URL` | Mindspace server base URL | `https://mindspace.xpollination.earth` |
| `MINDSPACE_API_KEY` | API key for authentication | `xpo_...` |
| `MINDSPACE_PROJECT` | Project slug to connect to | `xpollination-mcp-server` |

## Step 1: Determine Role

Extract role from invocation name suffix. The skill name is available in the invocation context.

- If invoked as `/xpo.agent.connect.pdsa` → role = `pdsa`
- If invoked as `/xpo.agent.connect.dev` → role = `dev`
- If invoked as `/xpo.agent.connect.qa` → role = `qa`
- If invoked as `/xpo.agent.connect.liaison` → role = `liaison`
- If invoked as `/xpo.agent.connect` (no suffix) → ask the user which role

Set: `ROLE` = the determined role, `AGENT_NAME` = role uppercased

## Step 2: Discover Endpoints

Fetch the Agent Card:

\`\`\`bash
curl -s "$MINDSPACE_URL/.well-known/agent.json"
\`\`\`

Parse the response to extract:
- `connect_url` = endpoints.connect
- `message_url` = endpoints.message
- `stream_url_template` = endpoints.stream
- `twin_schema_url` = digital_twin_schema

## Step 3: Build Digital Twin

Construct the twin JSON matching the schema:

\`\`\`json
{
  "identity": {
    "agent_name": "AGENT_NAME",
    "api_key": "$MINDSPACE_API_KEY",
    "session_id": "<generated UUID>"
  },
  "role": {
    "current": "ROLE",
    "capabilities": ["ROLE"]
  },
  "project": {
    "slug": "$MINDSPACE_PROJECT",
    "branch": "develop"
  },
  "state": {
    "status": "idle",
    "task": null,
    "lease": null,
    "heartbeat": null,
    "score": null
  },
  "metadata": {
    "framework": "claude-code",
    "connected_at": null,
    "agent_id": null
  }
}
\`\`\`

## Step 4: Connect (CHECKIN)

POST the digital twin to the connect endpoint:

\`\`\`bash
curl -s -X POST "$connect_url" \
  -H "Content-Type: application/json" \
  -d "$TWIN_JSON"
\`\`\`

**Expected response (WELCOME):**
\`\`\`json
{
  "type": "WELCOME",
  "agent_id": "uuid",
  "session_id": "uuid",
  "reconnect": false,
  "project": { "slug": "...", "access_role": "admin" },
  "endpoints": {
    "stream": "/a2a/stream/uuid",
    "heartbeat": "/api/agents/uuid/heartbeat",
    "disconnect": "/api/agents/uuid/status"
  }
}
\`\`\`

Save: `AGENT_ID` = agent_id, `STREAM_URL` = stream endpoint, `SESSION_ID` = session_id

If type is ERROR, display the error and stop.

## Step 5: Open SSE Stream

Start SSE listener in background:

\`\`\`bash
curl -s -N "$MINDSPACE_URL$STREAM_URL" > /tmp/agent-sse-$AGENT_ID.log 2>&1 &
SSE_PID=$!
\`\`\`

## Step 6: Heartbeat Loop

Start heartbeat in background (every 25s):

\`\`\`bash
while true; do
  curl -s -X POST "$message_url" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\":\"$AGENT_ID\",\"type\":\"HEARTBEAT\"}" > /dev/null
  sleep 25
done &
HEARTBEAT_PID=$!
\`\`\`

## Step 7: Message Handler

Poll SSE log for events and dispatch:

- **TASK_AVAILABLE**: New task available for this role. Check task details, decide to claim.
- **ATTESTATION_REQUIRED**: Transition needs attestation. Read required_checks, perform checks, submit.
- **LEASE_WARNING**: Lease expiring soon. Renew or release task.
- **LEASE_EXPIRED**: Lease expired. Task released.

The agent is now connected and receiving events. It should:
1. Query for available tasks: check PM system
2. Claim tasks matching its role
3. Process tasks according to role-specific workflows
4. Submit results and transitions

## Step 8: Disconnect (on exit)

\`\`\`bash
curl -s -X POST "$message_url" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"$AGENT_ID\",\"type\":\"DISCONNECT\"}"
kill $SSE_PID $HEARTBEAT_PID 2>/dev/null
\`\`\`
\`\`\`

## Study

### Test Cases (14 total)

**Role extraction (3):**
1. Skill invoked as `/xpo.agent.connect.pdsa` extracts role=pdsa
2. Skill invoked as `/xpo.agent.connect` (no suffix) prompts for role
3. Invalid role suffix rejected

**Agent Card discovery (2):**
4. Fetches Agent Card and parses all endpoint URLs
5. Handles Agent Card fetch failure gracefully

**Connect flow (4):**
6. Builds valid twin JSON matching schema
7. POST to connect returns WELCOME with agent_id
8. Re-registration (reconnect=true) works correctly
9. Authentication failure (bad API key) shows clear error

**SSE + Heartbeat (3):**
10. SSE stream opens successfully after connect
11. Heartbeat loop sends periodic HEARTBEAT messages
12. Disconnect cleans up SSE and heartbeat

**End-to-end (2):**
13. Full bootstrap: discover → connect → stream → heartbeat → disconnect
14. Missing env vars show helpful error messages

## Act

### Deployment

- 1 file: skills/xpo.agent.connect/SKILL.md (NEW)
- Install: symlink to `~/.claude/skills/xpo.agent.connect/SKILL.md`
- Role symlinks (ms-a11-9) will add `/xpo.agent.connect.pdsa` etc.
- No server-side changes — skill is client-side only, uses existing A2A endpoints
