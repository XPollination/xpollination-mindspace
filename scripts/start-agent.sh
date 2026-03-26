#!/bin/bash
# Start Agent — connects to A2A, gets WELCOME, starts Claude Code
# Usage: start-agent.sh <role> [api_url]
# The A2A WELCOME tells Claude everything it needs to know.

ROLE="${1:-liaison}"
API_URL="${2:-http://localhost:3100}"

echo "═══ Starting ${ROLE^^} Agent ═══"
echo ""

# 1. Self-healing: ensure Claude Code is available
if ! command -v claude &> /dev/null; then
  echo "▸ Claude Code not found — installing..."
  npm install -g @anthropic-ai/claude-code 2>/dev/null
  if ! command -v claude &> /dev/null; then
    echo "✗ Claude Code installation failed. Please install manually: npm install -g @anthropic-ai/claude-code"
    echo "  Starting bash shell instead..."
    exec bash
  fi
fi
echo "▸ Claude Code: $(claude --version 2>/dev/null || echo 'available')"

# 2. Connect to A2A server
echo "▸ Connecting to A2A server at ${API_URL}..."
WELCOME=$(curl -s -X POST "${API_URL}/a2a/connect" \
  -H "Content-Type: application/json" \
  -d "{
    \"identity\": {\"agent_name\": \"${ROLE}-agent\"},
    \"role\": {\"current\": \"${ROLE}\", \"capabilities\": [\"${ROLE}\"]},
    \"project\": {\"slug\": \"xpollination-mindspace\"},
    \"state\": {\"status\": \"active\"},
    \"metadata\": {\"framework\": \"claude-code-terminal\"}
  }")

# 3. Parse WELCOME
AGENT_ID=$(echo "$WELCOME" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.agent_id||'')}catch{console.log('')}})" 2>/dev/null)
ACTIONS=$(echo "$WELCOME" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log((j.available_actions||[]).join(', '))}catch{console.log('TRANSITION, OBJECT_QUERY, BRAIN_QUERY, BRAIN_CONTRIBUTE')}})" 2>/dev/null)

if [ -z "$AGENT_ID" ]; then
  echo "⚠ A2A connect failed — starting Claude without A2A context"
  echo "  You can connect manually: curl -X POST ${API_URL}/a2a/connect"
  AGENT_ID="offline"
  ACTIONS="TRANSITION, OBJECT_QUERY, BRAIN_QUERY, BRAIN_CONTRIBUTE"
fi

echo "▸ Agent ID: ${AGENT_ID}"
echo "▸ Role: ${ROLE^^}"
echo "▸ Available actions: ${ACTIONS}"
echo ""

# 4. Build system prompt from WELCOME
SYSTEM_PROMPT="You are the ${ROLE^^} agent in the XPollination Mindspace agentic OS.

## Identity
- Role: ${ROLE}
- Agent ID: ${AGENT_ID}
- A2A Server: ${API_URL}

## Available Actions (from A2A WELCOME)
${ACTIONS}

## How to Act
Send A2A messages via curl:
  curl -s -X POST ${API_URL}/a2a/message -H 'Content-Type: application/json' -d '{\"agent_id\":\"${AGENT_ID}\",\"type\":\"<ACTION>\", ...}'

Examples:
- Query tasks: {\"type\":\"OBJECT_QUERY\",\"agent_id\":\"${AGENT_ID}\",\"object_type\":\"task\",\"filters\":{\"status\":\"ready\"}}
- Transition: {\"type\":\"TRANSITION\",\"agent_id\":\"${AGENT_ID}\",\"task_slug\":\"my-task\",\"to_status\":\"active\"}
- Brain query: {\"type\":\"BRAIN_QUERY\",\"agent_id\":\"${AGENT_ID}\",\"prompt\":\"what should I work on?\"}
- Brain contribute: {\"type\":\"BRAIN_CONTRIBUTE\",\"agent_id\":\"${AGENT_ID}\",\"prompt\":\"I learned that...\"}

## Brain Gate (CRITICAL)
Every transition from active work REQUIRES a brain contribution first.
1. Send BRAIN_CONTRIBUTE with your findings
2. Get thought_id from response
3. Include brain_contribution_id in your TRANSITION payload

## Decision Interface
Users send you messages via the chat bubble (HUMAN_INPUT events).
The A2A server broadcasts these to all connected agents.
Respond by sending your own messages back via A2A.

## Working Directory
$(pwd)"

# 5. Start Claude Code
echo "═══ Claude Code starting ═══"
echo ""
exec claude --system-prompt "$SYSTEM_PROMPT"
