#!/bin/bash
#===============================================================================
# xpo.claude.a2a-deliver-hook.sh — Stop hook: auto-deliver task results to A2A
#
# Safety net for Option 3 (explicit a2a-deliver.js command).
# Fires on every Claude response. Checks if agent has an active task
# and Claude's response looks like completed work. If so, writes
# results to a delivery file that the task announcer picks up.
#
# Does NOT call A2A directly (avoid re-entry with brain-writeback hook).
# Instead writes to /tmp/a2a-pending-delivery-{role}.json for the announcer.
#
# Guards:
#   - stop_hook_active=true → exit (loop prevention)
#   - No AGENT_ROLE → exit
#   - No active task file → exit
#   - Response < 200 chars → exit (trivial response)
#
# Exit 0 always — Stop hooks must NEVER block.
#===============================================================================

set -uo pipefail

ROLE="${AGENT_ROLE:-}"
if [ -z "$ROLE" ]; then exit 0; fi

# Read stdin (hook input JSON)
INPUT=$(cat)

# Check loop prevention
ACTIVE=$(echo "$INPUT" | node -e 'try{const i=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));console.log(i.stop_hook_active?"yes":"no")}catch{console.log("no")}' 2>/dev/null)
if [ "$ACTIVE" = "yes" ]; then exit 0; fi

# Extract last assistant message
MSG=$(echo "$INPUT" | node -e 'try{const i=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));console.log(i.last_assistant_message||"")}catch{console.log("")}' 2>/dev/null)

# Guard: trivial response
if [ ${#MSG} -lt 200 ]; then exit 0; fi

# Check if there's an active task for this agent
TASK_FILE="/tmp/a2a-active-task-${ROLE}.json"
if [ ! -f "$TASK_FILE" ]; then exit 0; fi

SLUG=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).slug)}catch{console.log("")}' "$TASK_FILE" 2>/dev/null)
if [ -z "$SLUG" ]; then exit 0; fi

# Write pending delivery for the task announcer to pick up
DELIVERY_FILE="/tmp/a2a-pending-delivery-${ROLE}.json"
node -e '
const fs = require("fs");
const slug = process.argv[1];
const role = process.argv[2];
const msg = process.argv[3];
fs.writeFileSync(process.argv[4], JSON.stringify({
  slug, role, response: msg.substring(0, 2000), timestamp: new Date().toISOString()
}));
' "$SLUG" "$ROLE" "$MSG" "$DELIVERY_FILE" 2>/dev/null

exit 0
