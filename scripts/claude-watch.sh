#!/bin/bash
#===============================================================================
# claude-watch.sh — Live dashboard for running Claude Code sessions across
# ALL xp0 hosts (hetzner-cx22 local + office-xp0 per user).
#
# Usage:
#   claude-watch              Default: refresh every 5s
#   claude-watch 2            Refresh every 2s
#   claude-watch 10           Refresh every 10s
#   claude-watch --local      Local dashboard only (no SSH to office-xp0)
#
# What it shows per agent:
#   - Host + user
#   - Session/pane target
#   - Agent role / session name
#   - Status: WORKING / PROMPT / IDLE / ACTIVE / COMPACT / DEAD
#   - Last line of output (truncated)
#
# Prereqs:
#   - tmux sessions with Claude agents running
#   - On hetzner-cx22: runs directly as developer
#   - Elsewhere: SSHes to hetzner-cx22 VPN (10.33.33.1) via ~/.ssh/hetzner-dev
#   - For office-xp0 section: uses /home/developer/.ssh/id_ed25519_xp0_newserver
#===============================================================================

set -euo pipefail

readonly HETZNER_VPN_IP="10.33.33.1"
readonly HETZNER_USER="developer"
readonly CLAUDE_BIN="/home/${HETZNER_USER}/.local/bin/claude"
readonly SELF_PATH="$(realpath "$0")"

readonly OFFICE_HOST="178.104.208.66"
readonly OFFICE_USER="xpo-agent"
readonly OFFICE_KEY="/home/developer/.ssh/id_ed25519_xp0_newserver"
readonly OFFICE_USERS=(xpo-agent maria thomas sina)

# SSH key is developer-only; when invoked by other users, wrap via sudo -u developer.
if [[ "$(id -un)" == "developer" ]]; then
    SSH_WRAP=(ssh)
else
    SSH_WRAP=(sudo -u developer env "TERM=${TERM:-xterm-256color}" ssh)
fi

# Parse args
INTERVAL=5
LOCAL_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --local) LOCAL_ONLY=1 ;;
        -h|--help)
            cat <<'EOF'
Usage: claude-watch [interval] [--local]

  claude-watch         Multi-host dashboard, refresh every 5s
  claude-watch 2       Refresh every 2s
  claude-watch --local Only hetzner-cx22 (no office-xp0 SSH)

Shows all running Claude agents with status and activity across
hetzner-cx22 (developer) and office-xp0 (xpo-agent, maria, thomas).
Ctrl+C to exit.
EOF
            exit 0
            ;;
        *[0-9]*) INTERVAL="$arg" ;;
    esac
done

is_on_hetzner() {
    [[ -x "$CLAUDE_BIN" ]]
}

# --- Status helpers (operate on local tmux or on captured remote output) ---

_detect_status_from_text() {
    local bottom="$1"
    if echo "$bottom" | grep -qE 'Esc to cancel|Do you want to allow'; then
        echo "PROMPT"
    elif echo "$bottom" | grep -qE 'Thinking|Reasoning|Generating|Reading|Searching|Running'; then
        echo "WORKING"
    elif echo "$bottom" | grep -qE 'Compacting conversation'; then
        echo "COMPACT"
    elif echo "$bottom" | grep -qE '❯ $|❯  $'; then
        echo "IDLE"
    else
        echo "ACTIVE"
    fi
}

status_display() {
    case "$1" in
        WORKING) echo "WORKING" ;;
        PROMPT)  echo "⚠PROMPT" ;;
        IDLE)    echo "  IDLE " ;;
        COMPACT) echo "COMPACT" ;;
        ACTIVE)  echo " ACTIVE" ;;
        DEAD)    echo "  DEAD " ;;
        *)       echo "$1" ;;
    esac
}

# --- LOCAL host (hetzner-cx22) ---

render_local_row() {
    local target session pane_idx role status activity
    target="$1"
    session="$2"
    pane_idx="$3"
    role="$session"  # simple: just the session name

    local capture
    capture=$(tmux capture-pane -t "$target" -p -S -20 2>/dev/null || true)
    if [[ -z "$capture" ]]; then
        status="DEAD"
        activity="(no capture)"
    else
        status=$(_detect_status_from_text "$(echo "$capture" | tail -8 | tr '\n' ' ' | tr -s ' ')")
        activity=$(echo "$capture" | grep -v '^$' | tail -1 | head -c 45)
    fi

    printf "║ %-10s %-12s %-22s %-8s %-18s ║\n" \
        "local" "developer" "$target" "$(status_display "$status")" "$activity"
}

render_local_host() {
    local panes
    panes=$(tmux list-panes -a -F '#{session_name} #{window_index} #{pane_index} #{pane_pid}' 2>/dev/null || true)
    if [[ -z "$panes" ]]; then
        printf "║ %-74s ║\n" "local: no tmux sessions"
        return
    fi
    local found=0
    while IFS=' ' read -r session win_idx pane_idx pane_pid; do
        if pstree -p "$pane_pid" 2>/dev/null | grep -q claude; then
            render_local_row "${session}:${win_idx}.${pane_idx}" "$session" "$pane_idx"
            found=$((found + 1))
        fi
    done <<< "$panes"
    if [[ $found -eq 0 ]]; then
        printf "║ %-74s ║\n" "local: no claude agents in tmux"
    fi
}

# --- REMOTE host (office-xp0) ---

# Collect raw data from office-xp0 in one SSH call to minimize round-trips.
# Output format per line: user|session|pane_target|status|last-activity-45char
collect_office_xp0() {
    local remote_script
    remote_script='
for U in xpo-agent maria thomas; do
    if [[ "$(id -un)" == "$U" ]]; then RUN=""; else RUN="sudo -iu $U"; fi
    panes=$($RUN tmux list-panes -a -F "#{session_name}|#{window_index}|#{pane_index}|#{pane_current_command}" 2>/dev/null || true)
    [[ -z "$panes" ]] && continue
    while IFS="|" read -r S W P CMD; do
        [[ -z "$S" ]] && continue
        # Filter: only panes currently running claude
        if [[ "$CMD" != *claude* ]]; then continue; fi
        target="${S}:${W}.${P}"
        cap=$($RUN tmux capture-pane -t "$target" -p -S -20 2>/dev/null || true)
        bottom=$(echo "$cap" | tail -8 | tr "\n" " " | tr -s " ")
        # Classify in-line
        if echo "$bottom" | grep -qE "Esc to cancel|Do you want to allow"; then
            S_STATUS="PROMPT"
        elif echo "$bottom" | grep -qE "Thinking|Reasoning|Generating|Reading|Searching|Running"; then
            S_STATUS="WORKING"
        elif echo "$bottom" | grep -qE "Compacting conversation"; then
            S_STATUS="COMPACT"
        elif echo "$bottom" | grep -qE "❯ $|❯  $"; then
            S_STATUS="IDLE"
        else
            S_STATUS="ACTIVE"
        fi
        last=$(echo "$cap" | grep -v "^$" | tail -1 | head -c 45)
        echo "$U|$target|$S_STATUS|$last"
    done <<< "$panes"
done
'
    "${SSH_WRAP[@]}" -i "$OFFICE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -o ConnectTimeout=5 \
        "${OFFICE_USER}@${OFFICE_HOST}" "$remote_script" 2>/dev/null || true
}

render_remote_host() {
    local lines
    lines=$(collect_office_xp0)
    if [[ -z "$lines" ]]; then
        printf "║ %-74s ║\n" "office-xp0: no claude agents or SSH failed"
        return
    fi
    while IFS='|' read -r user target status activity; do
        [[ -z "$user" ]] && continue
        printf "║ %-10s %-12s %-22s %-8s %-18s ║\n" \
            "office-xp0" "$user" "$target" "$(status_display "$status")" "$activity"
    done <<< "$lines"
}

# --- Dashboard loop ---

run_dashboard() {
    while true; do
        clear
        local now
        now=$(date '+%Y-%m-%d %H:%M:%S')
        echo "╔════════════════════════════════════════════════════════════════════════════╗"
        printf "║  claude-watch — Multi-Host Agent Dashboard         %-20s ║\n" "$now"
        printf "║  Refresh: %ss%s    Ctrl+C to exit                                   ║\n" \
            "$INTERVAL" "$([[ $LOCAL_ONLY -eq 1 ]] && echo ' (--local)' || echo '')"
        echo "╠════════════════════════════════════════════════════════════════════════════╣"
        printf "║ %-10s %-12s %-22s %-8s %-18s ║\n" "HOST" "USER" "TARGET" "STATUS" "LAST ACTIVITY"
        echo "║ ────────── ──────────── ────────────────────── ──────── ────────────────── ║"
        render_local_host
        if [[ $LOCAL_ONLY -eq 0 ]]; then
            echo "║ ────────── ──────────── ────────────────────── ──────── ────────────────── ║"
            render_remote_host
        fi
        echo "╚════════════════════════════════════════════════════════════════════════════╝"
        sleep "$INTERVAL"
    done
}

# --- Main ---

if is_on_hetzner; then
    if [[ "$(whoami)" != "developer" ]]; then
        exec sudo -i -u developer bash "$SELF_PATH" "$@"
    fi
    run_dashboard
else
    ssh_key="${HOME}/.ssh/hetzner-dev"
    if [[ ! -f "$ssh_key" ]]; then
        echo "ERROR: SSH key not found at ${ssh_key}" >&2
        exit 1
    fi
    exec ssh -t -i "$ssh_key" -o StrictHostKeyChecking=accept-new \
        "${HETZNER_USER}@${HETZNER_VPN_IP}" "$SELF_PATH" "$@"
fi
