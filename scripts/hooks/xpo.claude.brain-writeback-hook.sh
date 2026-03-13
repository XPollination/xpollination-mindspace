#!/bin/bash
#===============================================================================
# xpo.claude.brain-writeback-hook.sh — Brain writeback on agent response
#
# Stop hook: contributes agent conclusions back to brain after every
# substantive response. Completes the read-write loop started by
# brain-first-hook.sh (UserPromptSubmit).
#
# Guards:
#   - stop_hook_active=true → exit (loop prevention)
#   - last_assistant_message < 100 chars → exit (trivial response)
#   - message is a single question → exit (no conclusion to store)
#   - brain health check fails → exit (soft fail, never block)
#
# Requires: AGENT_ROLE env var (set by claude-session.sh)
# Requires: Brain API at localhost:3200
# Requires: node (via nvm PATH)
#
# Exit 0 always — Stop hooks must NEVER block agent response delivery.
#===============================================================================

set -uo pipefail

ROLE="${AGENT_ROLE:-unknown}"
BRAIN_API_KEY="${BRAIN_API_KEY:-$(cat "$HOME/.brain-api-key" 2>/dev/null || echo "")}"
BRAIN_API_URL="${BRAIN_API_URL:-http://localhost:3200}"
export BRAIN_API_KEY

# --- 1. Read stdin ---
INPUT=$(cat)

# --- 2. Extract stop_hook_active and last_assistant_message via node ---
node -e '
const http = require("http");

const input = JSON.parse(process.argv[1]);
const role = process.argv[2];

const stopHookActive = input.stop_hook_active;
const message = input.last_assistant_message || "";
const sessionId = input.session_id || "";

// Guard: loop prevention
if (stopHookActive === true) {
  process.exit(0);
}

// Guard: trivial response (length < 100 chars)
if (message.length < 100) {
  process.exit(0);
}

// Guard: single question (ends with ? and is a single sentence)
const trimmed = message.trim();
const sentences = trimmed.split(/[.!]\s+/).filter(s => s.length > 0);
if (sentences.length <= 1 && trimmed.endsWith("?")) {
  process.exit(0);
}

// Brain health check (2s timeout)
const brainUrl = process.env.BRAIN_API_URL || "http://localhost:3200";
const healthReq = http.request(brainUrl + "/api/v1/health", {
  method: "GET",
  timeout: 2000
}, (res) => {
  let body = "";
  res.on("data", (chunk) => body += chunk);
  res.on("end", () => {
    if (res.statusCode !== 200 || !body.includes("ok")) {
      process.exit(0);
    }
    // Health OK — contribute to brain
    contributeToBrain(message, role, sessionId);
  });
});

healthReq.on("error", () => { process.exit(0); });
healthReq.on("timeout", () => { healthReq.destroy(); process.exit(0); });
healthReq.end();

function contributeToBrain(msg, role, sessionId) {
  const agentId = `agent-${role}`;
  const agentName = role.toUpperCase();

  // Truncate to 500 chars for contribution
  const summary = msg.substring(0, 500);

  const postData = JSON.stringify({
    prompt: summary,
    agent_id: agentId,
    agent_name: agentName,
    session_id: sessionId,
    thought_category: "agent_conclusion"
  });

  const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) };
  if (process.env.BRAIN_API_KEY) headers["Authorization"] = "Bearer " + process.env.BRAIN_API_KEY;

  const req = http.request(brainUrl + "/api/v1/memory", {
    method: "POST",
    headers: headers,
    timeout: 5000
  }, (res) => {
    let body = "";
    res.on("data", (chunk) => body += chunk);
    res.on("end", () => {
      process.exit(0);
    });
  });

  req.on("error", () => { process.exit(0); });
  req.on("timeout", () => { req.destroy(); process.exit(0); });
  req.write(postData);
  req.end();
}
' "$INPUT" "$ROLE"

exit 0
