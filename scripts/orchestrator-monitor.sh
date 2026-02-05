#!/bin/bash
# Orchestrator Monitor Script
# Usage: Called periodically by orchestrator agent
# Version: 1.3 (2026-02-05)
#
# PURPOSE:
# - Check MCP for orchestrator-assigned tasks across ALL projects
# - Check agent panes for permission prompts needing confirmation
#
# PROJECTS MONITORED:
# - xpollination-mcp-server
# - HomePage
#
# IMPROVEMENT LOG:
# v1.0 - Initial version: MCP check + pane prompt detection
# v1.1 - Fixed Running pattern detection (Unicode ellipsis)
# v1.2 - Multi-project support (xpollination-mcp-server + HomePage)
# v1.3 - Use interface-cli.js instead of direct SQL (protocol compliance)

WORKSPACE="/home/developer/workspaces/github/PichlerThomas"
CLI_PATH="$WORKSPACE/xpollination-mcp-server/src/db/interface-cli.js"
PROJECTS=("xpollination-mcp-server" "HomePage")

echo "=== $(date '+%H:%M:%S') ORCHESTRATOR MONITOR ==="

# 1. Check MCP for orchestrator tasks across all projects (via interface-cli.js)
echo "MCP:"
FOUND_TASKS=0
for PROJECT in "${PROJECTS[@]}"; do
  DB_PATH="$WORKSPACE/$PROJECT/data/xpollination.db"
  if [ -f "$DB_PATH" ]; then
    RESULT=$(DATABASE_PATH="$DB_PATH" node "$CLI_PATH" list --status=ready --role=orchestrator 2>/dev/null)
    COUNT=$(echo "$RESULT" | node -e "const d=require('fs').readFileSync(0,'utf8');try{const j=JSON.parse(d);console.log(j.count||0)}catch{console.log(0)}" 2>/dev/null)
    if [ "$COUNT" != "0" ] && [ -n "$COUNT" ]; then
      echo "$RESULT" | node -e "const d=require('fs').readFileSync(0,'utf8');try{const j=JSON.parse(d);j.nodes.forEach(n=>console.log('  [$PROJECT] TASK:',n.slug))}catch{}" 2>/dev/null
      FOUND_TASKS=1
    fi
  fi
done
if [ "$FOUND_TASKS" = "0" ]; then
  echo "  no orchestrator tasks"
fi

# 2. Check PDSA pane for prompts
PDSA_STATUS=$(tmux capture-pane -t claude-dual:0.1 -p 2>/dev/null | tail -20)
if echo "$PDSA_STATUS" | grep -q "Do you want to"; then
  echo "PDSA: ⚠️  PROMPT DETECTED - needs confirmation"
  echo "$PDSA_STATUS" | grep "Do you want" | head -1
elif echo "$PDSA_STATUS" | grep -qE "Running|⎿.*Running"; then
  echo "PDSA: ✓ Looping"
else
  echo "PDSA: ○ Idle"
fi

# 3. Check Dev pane for prompts
DEV_STATUS=$(tmux capture-pane -t claude-dual:0.2 -p 2>/dev/null | tail -20)
if echo "$DEV_STATUS" | grep -q "Do you want to"; then
  echo "DEV:  ⚠️  PROMPT DETECTED - needs confirmation"
  echo "$DEV_STATUS" | grep "Do you want" | head -1
elif echo "$DEV_STATUS" | grep -qE "Running|⎿.*Running"; then
  echo "DEV:  ✓ Looping"
else
  echo "DEV:  ○ Idle"
fi

echo "---"
