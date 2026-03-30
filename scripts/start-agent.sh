#!/bin/bash
# Start Agent — per-user isolated Claude Code with A2A connection
# Usage: start-agent.sh <role> <userId> [api_url]

ROLE="${1:-liaison}"
USER_ID="${2:-default}"
API_URL="${3:-http://localhost:${API_PORT:-3100}}"
AGENT_JWT="${AGENT_JWT:-}"

echo "═══ Starting ${ROLE^^} Agent (user: ${USER_ID}) ═══"

# Per-user Claude config (isolation: each user has own OAuth token, settings)
CLAUDE_USER_DIR="/home/node/.claude-${USER_ID}"
mkdir -p "$CLAUDE_USER_DIR"
cp -n /home/node/.claude/settings.json "$CLAUDE_USER_DIR/" 2>/dev/null
chmod 700 "$CLAUDE_USER_DIR"
export CLAUDE_CONFIG_DIR="$CLAUDE_USER_DIR"

# Self-healing: ensure Claude Code available
if ! command -v claude &> /dev/null; then
  echo "▸ Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code 2>/dev/null
  if ! command -v claude &> /dev/null; then
    echo "✗ Claude Code not available. Starting bash."
    exec bash
  fi
fi
echo "▸ Claude Code: $(claude --version 2>/dev/null || echo 'available')"

# Connect to A2A
echo "▸ Connecting to A2A at ${API_URL}..."
WELCOME=$(curl -s -X POST "${API_URL}/a2a/connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AGENT_JWT}" \
  -d "{
    \"identity\": {\"agent_name\": \"${ROLE}-agent-${USER_ID}\"},
    \"role\": {\"current\": \"${ROLE}\", \"capabilities\": [\"${ROLE}\"]},
    \"project\": {\"slug\": \"xpollination-mindspace\"},
    \"state\": {\"status\": \"active\"},
    \"metadata\": {\"framework\": \"claude-code-terminal\", \"user_id\": \"${USER_ID}\"}
  }")

AGENT_ID=$(echo "$WELCOME" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).agent_id||'')}catch{console.log('')}})" 2>/dev/null)
ACTIONS=$(echo "$WELCOME" | node -e "process.stdin.on('data',d=>{try{console.log((JSON.parse(d).available_actions||[]).join(', '))}catch{console.log('TRANSITION, OBJECT_QUERY, BRAIN_QUERY, BRAIN_CONTRIBUTE')}})" 2>/dev/null)

[ -z "$AGENT_ID" ] && AGENT_ID="offline" && echo "⚠ A2A offline — Claude starts without live connection"
echo "▸ Agent ID: ${AGENT_ID}"
echo "▸ Actions: ${ACTIONS}"
echo ""

SYSTEM_PROMPT="You are the ${ROLE^^} agent in XPollination Mindspace.

## Identity
- Role: ${ROLE}
- Agent ID: ${AGENT_ID}
- User: ${USER_ID}
- A2A Server: ${API_URL}

## Communication — A2A ONLY
All project management operations go through A2A protocol. NO direct database access. NO sqlite3. NO interface-cli.js.

Available A2A message types: ${ACTIONS}

Send messages:
curl -s -X POST ${API_URL}/a2a/message -H 'Content-Type: application/json' -d '{\"agent_id\":\"${AGENT_ID}\",\"type\":\"<TYPE>\", ...}'

Examples:
- Query tasks: {\"type\":\"OBJECT_QUERY\",\"object_type\":\"task\",\"filters\":{\"role\":\"${ROLE}\"}}
- Transition: {\"type\":\"TRANSITION\",\"task_slug\":\"...\",\"to_status\":\"review\"}
- Brain query: {\"type\":\"BRAIN_QUERY\",\"prompt\":\"...\"}
- Brain contribute: {\"type\":\"BRAIN_CONTRIBUTE\",\"prompt\":\"...\"}

## Brain Gate
Every transition from active work requires a brain contribution first.

## Workspace
You can read and write files in the project workspace. Use git to commit and push changes. Follow the git protocol: specific file staging, atomic commands, one-liner commits."

# Wire sandbox MCP if SANDBOX_URL is configured (station capability)
MCP_FLAG=""
if [ -n "$SANDBOX_URL" ] && [ "$SANDBOX_URL" != "disabled" ]; then
  cat > /tmp/mcp-sandbox-${USER_ID}.json <<MCPEOF
{"mcpServers":{"sandbox":{"type":"http","url":"${SANDBOX_URL}/mcp"}}}
MCPEOF
  MCP_FLAG="--mcp-config /tmp/mcp-sandbox-${USER_ID}.json"
  echo "▸ Sandbox MCP: ${SANDBOX_URL}"
elif [ -f "/app/scripts/mcp-sandbox.json" ]; then
  MCP_FLAG="--mcp-config /app/scripts/mcp-sandbox.json"
  echo "▸ Sandbox MCP: from static config"
fi

exec claude --system-prompt "$SYSTEM_PROMPT" $MCP_FLAG
