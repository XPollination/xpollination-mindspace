#!/bin/bash
# drift-check.sh — Verify production state matches baseline snapshot
# Usage: bash scripts/drift-check.sh [snapshot.json]
# Exit code: 0 = no drift, 1 = drift detected
#
# Reads ports, repos, services, and Qdrant collections from the snapshot JSON.
# No hardcoded values — all checks derived from snapshot baseline.

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

# Helper: extract values from snapshot JSON via python3
json_query() {
  python3 -c "import json,sys; data=json.load(open('$SNAPSHOT')); $1"
}

echo "=== Drift Check: $(date -Iseconds) ==="
echo "Snapshot: $SNAPSHOT"
SNAP_TS=$(json_query "print(data.get('snapshot_timestamp','unknown'))")
echo "Snapshot timestamp: $SNAP_TS"
echo ""

# --- 1. Listening ports (from snapshot) ---
echo "[Ports]"
PORTS=$(json_query "
for p in data.get('listening_ports', []):
    print(p['port'])
" | sort -n | uniq)

for port in $PORTS; do
  if ss -tlnH | grep -q ":${port} "; then
    check "port $port listening" "ok"
  else
    check "port $port listening" "not listening"
  fi
done

# --- 2. Git repos (from snapshot) ---
echo ""
echo "[Git Repos]"
REPOS_DIR="/home/developer/workspaces/github/PichlerThomas"
REPO_ENTRIES=$(json_query "
for name, info in data.get('git_repos', {}).items():
    print(f\"{name}|{info['branch']}\")")

while IFS='|' read -r name branch; do
  [ -z "$name" ] && continue
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
done <<< "$REPO_ENTRIES"

# --- 3. Docker containers (verified via ports, docker socket needs root) ---
echo ""
echo "[Docker Services (port-based)]"
DOCKER_ENTRIES=$(json_query "
for p in data.get('listening_ports', []):
    svc = p.get('service', '')
    if 'Docker' in svc or 'docker' in svc:
        name = svc.split('(')[0].strip().split(' ')[0]
        print(f\"{name}|{p['port']}\")")

while IFS='|' read -r name port; do
  [ -z "$name" ] && continue
  if ss -tlnH | grep -q ":${port} "; then
    check "docker $name (port $port)" "ok"
  else
    check "docker $name (port $port)" "not listening"
  fi
done <<< "$DOCKER_ENTRIES"

# --- 4. Systemd services (from snapshot) ---
echo ""
echo "[Systemd Services]"
SYSTEMD_SVCS=$(json_query "
ss = data.get('systemd_services', {})
if isinstance(ss, dict):
    for s in ss.get('running', []):
        print(s)
else:
    for s in ss:
        print(s.get('name', s) if isinstance(s, dict) else s)")

for svc in $SYSTEMD_SVCS; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    check "systemd $svc active" "ok"
  else
    check "systemd $svc active" "inactive"
  fi
done

# --- 5. VPN (from snapshot) ---
echo ""
echo "[VPN]"
VPN_IFACE=$(json_query "
vpn = data.get('vpn', {})
print(vpn.get('interface', 'wg0'))" 2>/dev/null || echo "wg0")

if ip link show "$VPN_IFACE" >/dev/null 2>&1; then
  check "$VPN_IFACE interface up" "ok"
else
  check "$VPN_IFACE interface up" "not found"
fi

# --- 6. Non-systemd services (from snapshot) ---
echo ""
echo "[Non-systemd Services]"
NON_SYSTEMD=$(json_query "
for s in data.get('non_systemd_services', []):
    ports = s.get('ports', [s.get('port', '')])
    if isinstance(ports, list) and ports:
        for p in ports:
            print(f\"{s['name']}|{p}\")
    else:
        print(f\"{s['name']}|{ports}\")" 2>/dev/null || echo "")

while IFS='|' read -r name port; do
  [ -z "$name" ] && continue
  if [ -n "$port" ] && ss -tlnH | grep -q ":${port} "; then
    check "$name (port $port)" "ok"
  elif [ -n "$port" ]; then
    check "$name (port $port)" "not listening"
  fi
done <<< "$NON_SYSTEMD"

# --- 7. Qdrant collections (from snapshot) ---
echo ""
echo "[Qdrant Collections]"
QDRANT_COLLS=$(json_query "
for c in data.get('qdrant_collections', []):
    print(c['name'])")

for coll in $QDRANT_COLLS; do
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
