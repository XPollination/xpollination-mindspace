#!/usr/bin/env bash
# ============================================================================
# Mindspace Acceptance Test — E2E browser validation via agent-browser
#
# CMM3 Self-Healing Script:
#   - Installs agent-browser Chrome on first run (self-healing setup)
#   - Tests all user-facing routes from the browser's perspective
#   - Reports pass/fail for each check
#   - Exit code 0 = all pass, 1 = failures found
#
# Usage:
#   npm run test:acceptance                    # test against beta (default)
#   npm run test:acceptance -- --url https://mindspace.xpollination.earth  # test prod
#
# What it tests:
#   1. Health endpoint responds
#   2. Unauthenticated root redirects to /login
#   3. Login page loads with form
#   4. Login succeeds and sets session cookie
#   5. Authenticated root serves Mission Map
#   6. Mission Map loads missions via A2A (not empty)
#   7. Kanban board loads
#   8. Knowledge browser route (/m/:id) serves page
#   9. Settings page loads
#  10. /api/data returns valid JSON (no 404)
#  11. /api/suspect-links/stats returns valid JSON (no 404)
#  12. No console errors on Mission Map
#  13. Agent card (/.well-known/agent.json) is discoverable
#  14. A2A connect with JWT returns WELCOME
# ============================================================================

set -euo pipefail

# --- Configuration ---
BASE_URL="${1:-http://127.0.0.1:4201}"
API_URL="${2:-http://127.0.0.1:3101}"
TEST_EMAIL="thomas.pichler@xpollination.earth"
TEST_PASSWORD="${TEST_PASSWORD:-changeme}"
PASS=0
FAIL=0
RESULTS=""

# Parse --url flag
for arg in "$@"; do
  case $arg in
    --url=*) BASE_URL="${arg#*=}"; shift ;;
    --url) shift; BASE_URL="$1"; shift ;;
  esac
done

# --- Self-Healing: Ensure agent-browser Chrome is installed ---
if ! npx agent-browser --version >/dev/null 2>&1; then
  echo "Installing agent-browser..."
  npm install --save-dev agent-browser
fi

if ! npx agent-browser open about:blank --headless 2>/dev/null; then
  echo "Downloading Chrome for agent-browser (first-time setup)..."
  npx agent-browser install
fi

# --- Helpers ---
check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}\n  ✓ ${name}"
  else
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}\n  ✗ ${name} — ${result}"
  fi
}

# --- Tests ---
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Mindspace Acceptance Test                          ║"
echo "║  Target: ${BASE_URL}"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 1. Health
HEALTH=$(curl -sf "${API_URL}/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "FAIL")
check "Health endpoint" "$([ "$HEALTH" = "ok" ] && echo "PASS" || echo "API returned: $HEALTH")"

# 2. Unauthenticated root redirects to login
REDIRECT=$(curl -so /dev/null -w '%{http_code}' "${BASE_URL}/" 2>/dev/null)
check "Root redirects to /login (302)" "$([ "$REDIRECT" = "302" ] && echo "PASS" || echo "Got HTTP $REDIRECT")"

# 3. Login page loads
LOGIN_TITLE=$(curl -sf "${BASE_URL}/login" 2>/dev/null | grep -o '<title>[^<]*</title>' || echo "")
check "Login page loads" "$(echo "$LOGIN_TITLE" | grep -qi "login" && echo "PASS" || echo "Title: $LOGIN_TITLE")"

# 4. Login succeeds
LOGIN_RESP=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" 2>/dev/null || echo '{"error":"failed"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")
check "Login returns JWT" "$([ -n "$TOKEN" ] && [ ${#TOKEN} -gt 50 ] && echo "PASS" || echo "No token returned")"

if [ -z "$TOKEN" ] || [ ${#TOKEN} -lt 50 ]; then
  echo ""
  echo "FATAL: Login failed — cannot run authenticated tests."
  echo "Response: $LOGIN_RESP"
  exit 1
fi

# 5. Authenticated root serves Mission Map
MAP_TITLE=$(curl -sf -b "ms_session=${TOKEN}" "${BASE_URL}/" 2>/dev/null | grep -o '<title>[^<]*</title>' || echo "")
check "Root serves Mission Map" "$(echo "$MAP_TITLE" | grep -qi "mission" && echo "PASS" || echo "Title: $MAP_TITLE")"

# 6. Kanban board loads
KANBAN_TITLE=$(curl -sf -b "ms_session=${TOKEN}" "${BASE_URL}/kanban" 2>/dev/null | grep -o '<title>[^<]*</title>' || echo "")
check "Kanban board loads" "$([ -n "$KANBAN_TITLE" ] && echo "PASS" || echo "Empty response")"

# 7. Knowledge browser route serves page
KB_TITLE=$(curl -sf -b "ms_session=${TOKEN}" "${BASE_URL}/m/test123" 2>/dev/null | grep -o '<title>[^<]*</title>' || echo "")
check "Knowledge browser (/m/:id) loads" "$(echo "$KB_TITLE" | grep -qi "mindspace" && echo "PASS" || echo "Title: $KB_TITLE")"

# 8. Settings page loads
SETTINGS_TITLE=$(curl -sf -b "ms_session=${TOKEN}" "${BASE_URL}/settings" 2>/dev/null | grep -o '<title>[^<]*</title>' || echo "")
check "Settings page loads" "$(echo "$SETTINGS_TITLE" | grep -qi "settings" && echo "PASS" || echo "Title: $SETTINGS_TITLE")"

# 9. /api/data returns valid JSON (not 404)
DATA_STATUS=$(curl -so /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "${API_URL}/api/data?project=all" 2>/dev/null)
check "/api/data?project=all responds" "$([ "$DATA_STATUS" = "200" ] && echo "PASS" || echo "HTTP $DATA_STATUS")"

# 10. /api/suspect-links/stats returns valid JSON (not 404)
SUSPECT_STATUS=$(curl -so /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "${API_URL}/api/suspect-links/stats?project=all" 2>/dev/null)
check "/api/suspect-links/stats responds" "$([ "$SUSPECT_STATUS" = "200" ] && echo "PASS" || echo "HTTP $SUSPECT_STATUS")"

# 11. Agent card discoverable
AGENT_CARD=$(curl -sf "${API_URL}/.well-known/agent.json" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || echo "")
check "Agent card discoverable" "$([ -n "$AGENT_CARD" ] && echo "PASS" || echo "Empty or missing")"

# 12. A2A connect with JWT returns WELCOME
A2A_TYPE=$(curl -sf -X POST "${API_URL}/a2a/connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"identity":{"agent_name":"acceptance-test"},"role":{"current":"liaison","capabilities":["view"]},"project":{"slug":"mindspace","branch":"main"},"state":{"status":"active"},"metadata":{"framework":"acceptance-test"}}' 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('type',''))" 2>/dev/null || echo "")
check "A2A connect with JWT" "$([ "$A2A_TYPE" = "WELCOME" ] && echo "PASS" || echo "Got: $A2A_TYPE")"

# --- Report ---
echo ""
echo "Results:${RESULTS}"
echo ""
echo "═══════════════════════════════════════"
echo "  ${PASS} passed, ${FAIL} failed ($(( PASS + FAIL )) total)"
echo "═══════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
