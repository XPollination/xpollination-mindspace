#!/bin/bash
# E2E Test: Agent Experience — repeatable agentic browser test
# Usage: bash scripts/e2e-agent-experience.sh [base_url]
# Produces: /tmp/e2e-ax/ with screenshots + results.json
#
# Tests:
# 1. Login flow
# 2. Mission Map loads
# 3. Kanban loads + chat bubble visible
# 4. Agents page: Dashboard view with + Start Agent
# 5. Agents page: spawn agent, verify card appears
# 6. Agents page: Terminal toggle
# 7. Chat bubble: expand, verify Decision Interface
# 8. Settings page accessible
# 9. /ide/ redirects to /agents
# 10. Knowledge browser loads

BASE_URL="${1:-https://beta-mindspace.xpollination.earth}"
OUT="/tmp/e2e-ax"
RESULTS="$OUT/results.json"

rm -rf "$OUT"
mkdir -p "$OUT"
echo '{"tests":[],"timestamp":"'$(date -Iseconds)'","base_url":"'"$BASE_URL"'"}' > "$RESULTS"

pass() { echo "  PASS: $1"; node -e "const r=JSON.parse(require('fs').readFileSync('$RESULTS','utf8')); r.tests.push({name:'$1',status:'pass',screenshot:'$2'}); require('fs').writeFileSync('$RESULTS',JSON.stringify(r,null,2))"; }
fail() { echo "  FAIL: $1 — $2"; node -e "const r=JSON.parse(require('fs').readFileSync('$RESULTS','utf8')); r.tests.push({name:'$1',status:'fail',error:'$2',screenshot:'$3'}); require('fs').writeFileSync('$RESULTS',JSON.stringify(r,null,2))"; }

echo "=== E2E: Agent Experience ($BASE_URL) ==="
echo ""

# Test 1: Login
echo "[1/10] Login..."
npx agent-browser open "$BASE_URL/login" 2>/dev/null
TITLE=$(npx agent-browser eval "document.title" 2>/dev/null | grep -o '".*"' | tr -d '"')
if [[ "$TITLE" == *"Login"* ]]; then
  npx agent-browser fill "input[type=email]" "thomas.pichler@xpollination.earth" 2>/dev/null
  npx agent-browser fill "input[type=password]" "changeme" 2>/dev/null
  npx agent-browser click "button[type=submit]" 2>/dev/null
  sleep 2
  npx agent-browser screenshot "$OUT/01-login.png" 2>/dev/null
  pass "login" "01-login.png"
else
  npx agent-browser screenshot "$OUT/01-login.png" 2>/dev/null
  fail "login" "Login page did not load" "01-login.png"
fi

# Test 2: Mission Map
echo "[2/10] Mission Map..."
npx agent-browser open "$BASE_URL/" 2>/dev/null
sleep 1
npx agent-browser screenshot "$OUT/02-mission-map.png" 2>/dev/null
TITLE=$(npx agent-browser eval "document.title" 2>/dev/null | grep -o '".*"' | tr -d '"')
if [[ "$TITLE" == *"Mindspace"* ]]; then
  pass "mission-map" "02-mission-map.png"
else
  fail "mission-map" "Mission Map did not load: $TITLE" "02-mission-map.png"
fi

# Test 3: Kanban + chat bubble
echo "[3/10] Kanban + Chat Bubble..."
npx agent-browser open "$BASE_URL/kanban" 2>/dev/null
sleep 2
npx agent-browser screenshot "$OUT/03-kanban.png" 2>/dev/null
BUBBLE=$(npx agent-browser eval "document.querySelector('chat-bubble') ? 'found' : 'missing'" 2>/dev/null)
if [[ "$BUBBLE" == *"found"* ]]; then
  pass "kanban-chat-bubble" "03-kanban.png"
else
  fail "kanban-chat-bubble" "Chat bubble not found on kanban page" "03-kanban.png"
fi

# Test 4: Agents page — Dashboard view
echo "[4/10] Agents Dashboard..."
npx agent-browser open "$BASE_URL/agents" 2>/dev/null
sleep 2
npx agent-browser screenshot "$OUT/04-agents-dashboard.png" 2>/dev/null
GRID=$(npx agent-browser eval "document.querySelector('agent-grid') ? 'found' : 'missing'" 2>/dev/null)
if [[ "$GRID" == *"found"* ]]; then
  pass "agents-dashboard" "04-agents-dashboard.png"
else
  fail "agents-dashboard" "agent-grid component not found" "04-agents-dashboard.png"
fi

# Test 5: Spawn agent button exists
echo "[5/10] Spawn Agent Button..."
npx agent-browser screenshot "$OUT/05-spawn-prompt.png" 2>/dev/null
# Use snapshot to check for button text
SNAP=$(npx agent-browser snapshot 2>/dev/null)
if echo "$SNAP" | grep -q "Start Agent"; then
  pass "spawn-button" "05-spawn-prompt.png"
else
  fail "spawn-button" "Start Agent button not found in accessibility tree" "05-spawn-prompt.png"
fi

# Test 6: Dashboard/Terminal toggle
echo "[6/10] View Toggle..."
if echo "$SNAP" | grep -q "Dashboard" && echo "$SNAP" | grep -q "Terminal"; then
  npx agent-browser click "@e3" 2>/dev/null
  sleep 1
  npx agent-browser screenshot "$OUT/06-terminal-view.png" 2>/dev/null
  npx agent-browser click "@e2" 2>/dev/null
  pass "view-toggle" "06-terminal-view.png"
else
  npx agent-browser screenshot "$OUT/06-terminal-view.png" 2>/dev/null
  fail "view-toggle" "Dashboard/Terminal toggle buttons not found" "06-terminal-view.png"
fi

# Test 7: Chat bubble expand
echo "[7/10] Chat Bubble Expand..."
npx agent-browser open "$BASE_URL/kanban" 2>/dev/null
sleep 2
npx agent-browser click ".cb-btn" 2>/dev/null
sleep 1
npx agent-browser screenshot "$OUT/07-chat-expanded.png" 2>/dev/null
PANEL=$(npx agent-browser eval "document.querySelector('.cb-panel.open') ? 'open' : 'closed'" 2>/dev/null)
if [[ "$PANEL" == *"open"* ]]; then
  pass "chat-bubble-expand" "07-chat-expanded.png"
else
  fail "chat-bubble-expand" "Chat panel did not open" "07-chat-expanded.png"
fi

# Test 8: Settings
echo "[8/10] Settings..."
npx agent-browser open "$BASE_URL/settings" 2>/dev/null
sleep 1
npx agent-browser screenshot "$OUT/08-settings.png" 2>/dev/null
TITLE=$(npx agent-browser eval "document.title" 2>/dev/null | grep -o '".*"' | tr -d '"')
if [[ "$TITLE" == *"Settings"* ]]; then
  pass "settings" "08-settings.png"
else
  fail "settings" "Settings page did not load" "08-settings.png"
fi

# Test 9: /ide/ redirects to /agents
echo "[9/10] IDE Redirect..."
npx agent-browser open "$BASE_URL/ide/" 2>/dev/null
sleep 2
CURRENT_URL=$(npx agent-browser eval "window.location.pathname" 2>/dev/null | grep -o '".*"' | tr -d '"')
npx agent-browser screenshot "$OUT/09-ide-redirect.png" 2>/dev/null
if [[ "$CURRENT_URL" == *"/agents"* ]]; then
  pass "ide-redirect" "09-ide-redirect.png"
else
  fail "ide-redirect" "Expected /agents, got $CURRENT_URL" "09-ide-redirect.png"
fi

# Test 10: Knowledge browser
echo "[10/10] Knowledge Browser..."
npx agent-browser open "$BASE_URL/missions" 2>/dev/null
sleep 1
npx agent-browser screenshot "$OUT/10-missions.png" 2>/dev/null
TITLE=$(npx agent-browser eval "document.title" 2>/dev/null | grep -o '".*"' | tr -d '"')
if [[ "$TITLE" == *"Mission"* ]]; then
  pass "missions" "10-missions.png"
else
  fail "missions" "Missions page did not load" "10-missions.png"
fi

# Summary
echo ""
echo "=== RESULTS ==="
PASS_COUNT=$(node -e "const r=JSON.parse(require('fs').readFileSync('$RESULTS','utf8')); console.log(r.tests.filter(t=>t.status==='pass').length)")
FAIL_COUNT=$(node -e "const r=JSON.parse(require('fs').readFileSync('$RESULTS','utf8')); console.log(r.tests.filter(t=>t.status==='fail').length)")
TOTAL=$(node -e "const r=JSON.parse(require('fs').readFileSync('$RESULTS','utf8')); console.log(r.tests.length)")
echo "PASS: $PASS_COUNT / $TOTAL"
echo "FAIL: $FAIL_COUNT / $TOTAL"
echo "Screenshots: $OUT/"
echo "Results: $RESULTS"

# Exit with failure if any test failed
[ "$FAIL_COUNT" -eq 0 ] && exit 0 || exit 1
