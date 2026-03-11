# XPollination Agent Connect

Central skill for bootstrapping an agent connection to the Mindspace API.

```
/xpo.agent.connect <role-suffix>
```

Where `<role-suffix>` is the agent role: `liaison`, `pdsa`, `dev`, `qa`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MINDSPACE_API_URL` | Yes | Base URL of the Mindspace API (e.g., `http://localhost:4200`) |
| `AGENT_API_KEY` | Yes | API key for authenticating agent requests |

---

## Step 1: Extract Role from Suffix

The role is determined from the command argument (suffix). Map to identity:

| Suffix | agent_id | agent_name | Role |
|--------|----------|------------|------|
| `liaison` | `agent-liaison` | `LIAISON` | liaison |
| `pdsa` | `agent-pdsa` | `PDSA` | pdsa |
| `dev` | `agent-dev` | `DEV` | dev |
| `qa` | `agent-qa` | `QA` | qa |

If no suffix or invalid suffix provided, abort with an error.

## Step 2: Fetch Agent Card

Discover the Mindspace API capabilities via the Agent Card:

```bash
curl -s "$MINDSPACE_API_URL/api/agent-card" \
  -H "Authorization: Bearer $AGENT_API_KEY"
```

The Agent Card returns the API schema, supported message types, and project configuration. Parse the response to understand available endpoints and capabilities.

## Step 3: Construct Digital Twin

Build the digital twin JSON payload containing the agent's identity and state:

```json
{
  "identity": {
    "agent_id": "agent-<role>",
    "agent_name": "<ROLE>",
    "role": "<role>"
  },
  "project": {
    "slug": "<project-slug>",
    "context": "active project context"
  },
  "state": {
    "status": "connecting",
    "capabilities": ["<role>"],
    "session_id": "<generated-uuid>"
  },
  "metadata": {
    "version": "1.0.0",
    "connected_at": "<iso-timestamp>"
  }
}
```

## Step 4: Connect to Mindspace

Send the digital twin to register/reconnect the agent:

```bash
curl -s -X POST "$MINDSPACE_API_URL/a2a/connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -d "$TWIN_JSON"
```

### WELCOME Response

On successful connection, the server returns a WELCOME message:

```json
{
  "type": "WELCOME",
  "agent_id": "agent-<role>",
  "session_id": "<session-id>",
  "bond_id": "<bond-id>",
  "timestamp": "<iso>"
}
```

Parse the WELCOME to extract `session_id` and `bond_id` for subsequent requests.

### Reconnect Handling

If the agent was previously connected (e.g., after a context compaction or restart), the connect endpoint handles reconnection automatically. The server will:
- Reactivate the agent if it was idle/disconnected
- Create a new bond or renew the existing one
- Return the same WELCOME format

No special reconnect endpoint is needed — POST /a2a/connect is idempotent for the same agent_id.

## Step 5: Open SSE Stream

Subscribe to server-sent events for real-time messages:

```bash
curl -s -N "$MINDSPACE_API_URL/a2a/events/$AGENT_ID" \
  -H "Authorization: Bearer $AGENT_API_KEY"
```

The SSE stream delivers:
- `ATTESTATION_REQUIRED` — transition attestation requests
- `TASK_ASSIGNED` — new task assignments
- `ROLE_SWITCH` — role change notifications
- Server heartbeat comments (`: heartbeat <timestamp>`)

## Step 6: Start HEARTBEAT Loop

Send HEARTBEAT messages every 30 seconds to maintain the connection:

```bash
while true; do
  curl -s -X POST "$MINDSPACE_API_URL/a2a/message" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AGENT_API_KEY" \
    -d "{\"agent_id\": \"$AGENT_ID\", \"type\": \"HEARTBEAT\"}"
  sleep 30
done
```

The HEARTBEAT loop:
- Keeps the agent marked as active
- Renews the agent bond (prevents expiry)
- Reactivates idle agents automatically
- Runs in background, interval 30 seconds

## Step 7: Enter Message Handler Loop

Process incoming SSE events in a loop:

1. Parse each SSE event (type + JSON data)
2. Dispatch to appropriate handler based on event type
3. For `ATTESTATION_REQUIRED`: submit attestation checks via `ATTESTATION_SUBMITTED`
4. For `TASK_ASSIGNED`: claim and process the task
5. Log all events for debugging

## Step 8: DISCONNECT on Session End

When the agent session ends (context clear, shutdown, or explicit disconnect):

```bash
curl -s -X POST "$MINDSPACE_API_URL/a2a/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"type\": \"DISCONNECT\"}"
```

This:
- Sets agent status to `disconnected`
- Expires the active bond
- Cleans up SSE connection server-side

Always DISCONNECT before ending. Do not leave zombie connections.

---

## Full Bootstrap Sequence

```
1. Extract role from suffix argument
2. Fetch Agent Card from MINDSPACE_API_URL
3. Construct digital twin (identity, role, project, state, metadata)
4. POST /a2a/connect with twin → receive WELCOME
5. Open SSE stream at /a2a/events/:agentId
6. Start HEARTBEAT loop (30s interval, background)
7. Enter message handler loop (process SSE events)
8. DISCONNECT on session end
```

The agent bootstraps from zero knowledge — only the role suffix and environment variables are needed. The Agent Card provides API discovery, the twin establishes identity, and the connect flow handles both fresh connections and reconnect scenarios.
