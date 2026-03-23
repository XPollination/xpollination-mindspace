# XPollination A2A Bootstrap Skill

Connect to the XPollination A2A network via Hive discovery, authenticate, and subscribe to SSE events.

```
/xpo.claude.a2a <role>
```

Where `<role>` is: `liaison`, `pdsa`, `qa`, `dev`

---

## Step 1: Discover Hive

Fetch the agent discovery endpoint to find available services:

```bash
HIVE_URL="${HIVE_URL:-https://hive.xpollination.earth}"
curl -s ${HIVE_URL}/.well-known/agent.json
```

Parse the response for endpoints and capabilities. The `agent.json` contains:
- `endpoints` — available API routes
- `capabilities` — what the Hive can do
- `related_services` — linked services (e.g., Mindspace)

## Step 2: Authenticate via Checkin

Use your API key (Bearer token) to authenticate and register with the A2A server:

```bash
curl -s -X POST ${HIVE_URL}/a2a/checkin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{\"agent_id\": \"agent-${role}\", \"agent_name\": \"$(echo ${role} | tr a-z A-Z)\", \"capabilities\": [\"task_execution\", \"brain_query\"]}"
```

## Step 3: Subscribe to SSE Events

Connect to the SSE stream for real-time task notifications:

```bash
# EventSource connection (in-agent, not bash)
# URL: ${HIVE_URL}/a2a/events?agent_id=agent-${role}
# Events: task_claimed, task_submitted, task_reviewed, object_created, service_evolve
```

The SSE connection receives events as they happen — no polling needed.

## Step 4: Start Working

Once connected via SSE, the agent receives task notifications in real-time.
Use the A2A endpoints for task lifecycle:

- `POST /a2a/claim` — Claim a task
- `POST /a2a/submit` — Submit completed work
- `POST /a2a/create` — Create new objects via twin protocol

## Fallback: Monitor Polling

If the A2A server is unavailable, fallback to the existing monitor polling:

```bash
/xpo.claude.monitor ${role}
```

This uses the legacy polling mechanism (30s interval) instead of SSE.

## Reconnect Logic

On SSE disconnection, retry up to 3 attempts with exponential backoff:

1. Wait 5s, reconnect
2. Wait 15s, reconnect
3. Wait 30s, reconnect
4. If all 3 retry attempts fail → fallback to monitor polling

## Role Identity

| Role | agent_id | Pane |
|------|----------|------|
| liaison | agent-liaison | 0 |
| pdsa | agent-pdsa | 1 |
| dev | agent-dev | 2 |
| qa | agent-qa | 3 |
