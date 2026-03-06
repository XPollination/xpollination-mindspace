#!/bin/bash
# drift-check.sh — Verify production state matches baseline snapshot
# Usage: bash scripts/drift-check.sh [snapshot.json]
# Exit code: 0 = no drift, 1 = drift detected

set -euo pipefail

SNAPSHOT="${1:-snapshots/production-2026-03-06T05-03-01Z.json}"

if [ ! -f "$SNAPSHOT" ]; then
  echo "FAIL: Snapshot not found: $SNAPSHOT"
  exit 1
fi

DRIFT=0
CHECKS=0
PASSED=0

check() {
  CHECKS=$((CHECKS + 1))
  local desc="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    PASSED=$((PASSED + 1))
    echo "  OK: $desc"
  else
    DRIFT=1
    echo "  DRIFT: $desc — $result"
  fi
}

echo "=== Drift Check: $(date -Iseconds) ==="
echo "Snapshot: $SNAPSHOT"
echo ""

# --- 1. Listening ports ---
echo "[Ports]"
for port in 22 80 443 3200 3201 3210 5005 6333 8080; do
  if ss -tlnH | grep -q ":${port} "; then
    check "port $port listening" "ok"
  else
    check "port $port listening" "not listening"
  fi
done

# --- 2. Git repos ---
echo ""
echo "[Git Repos]"
REPOS_DIR="/home/developer/workspaces/github/PichlerThomas"
while IFS='|' read -r name branch; do
  repo_dir="$REPOS_DIR/$name"
  if [ ! -d "$repo_dir/.git" ]; then
    check "repo $name exists" "missing"
  else
    current_branch=$(git -C "$repo_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    if [ "$current_branch" = "$branch" ] || [ "$current_branch" = "HEAD" ]; then
      check "repo $name on $branch" "ok"
    else
      check "repo $name on $branch" "on $current_branch"
    fi
  fi
done <<'REPOS'
HomeAssistant|main
HomePage|main
ProfileAssistant|main
xpollination-best-practices|main
xpollination-hive|master
xpollination-mcp-server|main
xpollination-mindspace|main
REPOS

# --- 3. Docker containers (verified via ports, docker socket needs root) ---
echo ""
echo "[Docker Services (port-based)]"
# umami: 3000, qdrant: 6333, paperless-ngx: 8000, uptime-kuma: 3001
for entry in "umami:3000" "qdrant:6333" "paperless-ngx:8000" "uptime-kuma:3001"; do
  name="${entry%%:*}"
  port="${entry##*:}"
  if ss -tlnH | grep -q ":${port} "; then
    check "docker $name (port $port)" "ok"
  else
    check "docker $name (port $port)" "not listening"
  fi
done

# --- 4. Systemd services ---
echo ""
echo "[Systemd Services]"
for svc in nginx ssh docker fail2ban cron paperless-share-webhook paperless-title-generator parental-control review-server; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    check "systemd $svc active" "ok"
  else
    check "systemd $svc active" "inactive"
  fi
done

# --- 5. VPN ---
echo ""
echo "[VPN]"
if ip link show wg0 >/dev/null 2>&1; then
  check "wg0 interface up" "ok"
else
  check "wg0 interface up" "not found"
fi

# --- 6. Non-systemd services (brain-api, viz-server) ---
echo ""
echo "[Non-systemd Services]"
if ss -tlnH | grep -q ":3200 "; then
  check "brain-api (port 3200)" "ok"
else
  check "brain-api (port 3200)" "not listening"
fi
if ss -tlnH | grep -q ":8080 "; then
  check "viz-server (port 8080)" "ok"
else
  check "viz-server (port 8080)" "not listening"
fi

# --- 7. Qdrant collections ---
echo ""
echo "[Qdrant Collections]"
for coll in thought_space thought_space_shared thought_space_maria best_practices queries; do
  status=$(curl -s "http://localhost:6333/collections/$coll" 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 || echo "")
  if echo "$status" | grep -q '"green"'; then
    check "qdrant $coll" "ok"
  else
    check "qdrant $coll" "missing or unhealthy"
  fi
done

# --- Summary ---
echo ""
echo "=== Summary: $PASSED/$CHECKS passed ==="
if [ "$DRIFT" -eq 0 ]; then
  echo "No drift detected."
  exit 0
else
  echo "DRIFT DETECTED — review items above."
  exit 1
fi
