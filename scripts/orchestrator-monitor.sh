#!/bin/bash
# Orchestrator Monitor Script
# Usage: Called periodically by orchestrator agent
# Version: 1.2 (2026-02-04)
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

WORKSPACE="/home/developer/workspaces/github/PichlerThomas"
PROJECTS=("xpollination-mcp-server" "HomePage")

echo "=== $(date '+%H:%M:%S') ORCHESTRATOR MONITOR ==="

# 1. Check MCP for orchestrator tasks across all projects
echo "MCP:"
for PROJECT in "${PROJECTS[@]}"; do
  DB_PATH="$WORKSPACE/$PROJECT/data/xpollination.db"
  if [ -f "$DB_PATH" ]; then
    TASKS=$(node -e "
      const Database = require('better-sqlite3');
      const db = new Database('$DB_PATH', { readonly: true });
      const tasks = db.prepare(\"SELECT slug FROM mindspace_nodes WHERE status='ready' AND (dna_json LIKE '%role\\\":\\\"orchestrator%' OR dna_json LIKE '%role\\\":\\\"orch%')\").all();
      if (tasks.length > 0) {
        tasks.forEach(t => console.log('  [$PROJECT] TASK:', t.slug));
      }
      db.close();
    " 2>/dev/null)
    if [ -n "$TASKS" ]; then
      echo "$TASKS"
    fi
  fi
done
echo "  (no orchestrator tasks)" | grep -v "TASK:" > /dev/null && echo "  no orchestrator tasks"

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
