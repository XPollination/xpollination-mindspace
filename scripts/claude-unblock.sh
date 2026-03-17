#!/bin/bash
#===============================================================================
# claude-unblock.sh — Auto-confirm permission prompts for ALL Claude agents
#
# Monitors any agent running in any tmux session on the system. Runs inside
# its own persistent tmux session so it survives terminal disconnects.
# One instance per target session — run multiple for full system coverage.
#
# Usage:
#   claude-unblock                          # ALL sessions, all panes (auto-discover)
#   claude-unblock agents                   # claude-agents: agent panes 1-3 (PDSA, DEV, QA)
#   claude-unblock liaison                  # claude-agents: pane 0 only
#   claude-unblock HomeAssistantDevOpsAgent # HomeAssistantDevOpsAgent: pane 0
#   claude-unblock <any-tmux-session>       # Any session: pane 0
#
# Full system coverage:
#   claude-unblock                          # single instance covers everything
#
# Behavior:
#   - First run  → creates tmux session "claude-unblock[-name]", starts monitor
#   - Next run   → attaches to existing session (monitor already running)
#   - Detach     → Ctrl+B D (monitor keeps running in background)
#   - Stop       → attach and Ctrl+C, or: tmux kill-session -t claude-unblock-*
#
# Modes:
#   all (default)    → auto-discover ALL tmux sessions (except claude-unblock*), all panes
#   agents           → claude-agents session, agent panes 1-3 (PDSA, DEV, QA) — excludes human pane
#   liaison          → claude-agents session, pane 0 only (LIAISON)
#   <session-name>   → any tmux session, pane 0
#
# What it does:
#   - Checks last 300 lines of each pane every 6 seconds
#   - Detects "❯ N. Yes/Allow" permission prompts
#   - Prefers "don't ask again" > "allow all" > "yes"
#   - Detects "Do you want to proceed" prompts
#   - Logs every action with timestamp and pane name
#   - Handles narrow panes (15+ chars) where prompts wrap heavily
#
# What it does NOT do:
#   - Never sends Enter to "accept edits on" (mode indicator, not a prompt)
#   - Never auto-confirms AskUserQuestion (human decision prompts)
#   - Never interferes with agent typing or active work
#
# Prerequisites:
#   - Target tmux session must be running (script waits if not yet started)
#   - On Hetzner: works directly
#   - Remote: SSHes to Hetzner via VPN (like claude-session)
#===============================================================================

set -euo pipefail

# --- Environment Detection ---
# Three modes (same as claude-session.sh):
#   1. Hetzner server  → Claude at /home/developer/.local/bin/claude
#   2. Local machine   → Claude in PATH (e.g. macOS with homebrew/npm global)
#   3. Remote (no claude) → SSH to Hetzner
readonly HETZNER_VPN_IP="10.33.33.1"
readonly HETZNER_USER="developer"
readonly HETZNER_HOME="/home/${HETZNER_USER}"
readonly SELF_PATH="$(realpath "$0")"

if [[ -x "${HETZNER_HOME}/.local/bin/claude" ]]; then
    readonly RUN_MODE="hetzner"
elif command -v claude &>/dev/null; then
    readonly RUN_MODE="local"
else
    readonly RUN_MODE="remote"
fi

# --- Functions ---

is_local_or_hetzner() {
    [[ "$RUN_MODE" == "hetzner" || "$RUN_MODE" == "local" ]]
}

run_remote() {
    local mode="$1"
    local ssh_key="${HOME}/.ssh/hetzner-dev"

    if [[ ! -f "$ssh_key" ]]; then
        echo "ERROR: SSH key not found at ${ssh_key}"
        exit 1
    fi

    exec ssh -t -i "$ssh_key" -o StrictHostKeyChecking=accept-new \
        "${HETZNER_USER}@${HETZNER_VPN_IP}" \
        "$SELF_PATH" "$mode"
}

# Global confirm counter file for cross-subshell tracking
CONFIRM_FILE="/tmp/claude-unblock-confirms"
echo 0 > "$CONFIRM_FILE" 2>/dev/null || true

increment_confirms() {
    local count
    count=$(cat "$CONFIRM_FILE" 2>/dev/null || echo 0)
    echo $((count + 1)) > "$CONFIRM_FILE"
    echo $((count + 1))
}

process_pane() {
    # Process a single pane: detect and auto-confirm permission prompts.
    # Args: $1 = TARGET (e.g. "session:0.1"), $2 = PANE_NAME (label for logging)
    local TARGET="$1"
    local PANE_NAME="$2"

    # Capture pane with deep scrollback — narrow panes (8-15 chars) wrap a single
    # permission prompt across 100+ lines, pushing "❯ 1. Yes" far above visible area
    local output
    output=$(tmux capture-pane -t "$TARGET" -p -S -300 2>/dev/null) || return 1

    # Only process if there's an active prompt (bottom of pane has prompt indicator)
    local bottom
    bottom=$(echo "$output" | tail -12)

    local bottom_collapsed
    bottom_collapsed=$(echo "$bottom" | tr '\n' ' ' | tr -s ' ')
    if ! echo "$bottom_collapsed" | grep -qE 'Esc to cancel|Do you want to allow'; then
        return 0
    fi

    # "Esc to cancel" confirmed in bottom — this IS a prompt. Now search the FULL
    # captured output for keywords and options. Narrow panes (60 chars) with long
    # command previews push "Do you want to proceed" 45+ lines above the bottom,
    # far beyond a tail-40 window. Using full 300-line capture ensures we find it.
    #
    # Bug fixed 2026-03-16: tail-40 missed prompts in narrow panes where command
    # text between options 2 and 3 was 40+ lines. PDSA hung for hours.
    local full_collapsed
    full_collapsed=$(echo "$output" | tr '\n' ' ' | tr -s ' ')

    # SAFETY: Only auto-confirm tool PERMISSION, TRUST, and SAFETY prompts.
    # Never auto-confirm AskUserQuestion (human decision prompts).
    if ! echo "$full_collapsed" | grep -qE '●'; then
        if ! echo "$full_collapsed" | grep -qE 'Do you want to allow|Claude wants to|Do you want to proceed|Run shell command'; then
            return 0
        fi
    fi

    local confirm_count

    # Find the best option: prefer "don't ask again" > numbered Yes > Enter
    if echo "$full_collapsed" | grep -qiE "don.t ask again"; then
        local option
        option=$(echo "$full_collapsed" | grep -oiE '[1-9]\.?[^.]{0,80}don.t ask again' | head -1 | grep -oE '^[1-9]')
        if [[ -n "$option" ]]; then
            tmux send-keys -t "$TARGET" "$option"
            confirm_count=$(increment_confirms)
            echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option $option (don't ask again) [#$confirm_count]"
            sleep 3
            return 0
        fi
    fi

    if echo "$full_collapsed" | grep -qE '❯.*[0-9]+\. Yes'; then
        if echo "$full_collapsed" | grep -qE '3\.[^0-9]*Yes'; then
            tmux send-keys -t "$TARGET" 3
            confirm_count=$(increment_confirms)
            echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 3 (yes/allow all) [#$confirm_count]"
        elif echo "$full_collapsed" | grep -qE '2\.[^0-9]*Yes'; then
            tmux send-keys -t "$TARGET" 2
            confirm_count=$(increment_confirms)
            echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 2 (yes/allow all) [#$confirm_count]"
        else
            tmux send-keys -t "$TARGET" 1
            confirm_count=$(increment_confirms)
            echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 1 (yes) [#$confirm_count]"
        fi
        sleep 3
        return 0
    fi

    # Fallback: "Do you want to proceed" with numbered options
    if echo "$full_collapsed" | grep -qE 'Do you want'; then
        if echo "$full_collapsed" | grep -qE '[0-9]+\. Yes'; then
            tmux send-keys -t "$TARGET" 1
            confirm_count=$(increment_confirms)
            echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Confirmed prompt (option 1) [#$confirm_count]"
        else
            tmux send-keys -t "$TARGET" Enter
            confirm_count=$(increment_confirms)
            echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Confirmed 'Do you want' (Enter) [#$confirm_count]"
        fi
        sleep 3
        return 0
    fi

    return 0
}

discover_targets() {
    # Build a list of "session:0.pane_id label" targets from all non-unblock tmux sessions.
    # Output: one line per target: "session:0.pane_id|LABEL"
    local sessions
    sessions=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -v '^claude-unblock' || true)
    for sess in $sessions; do
        local panes
        panes=$(tmux list-panes -t "$sess" -F '#{pane_index}' 2>/dev/null || true)
        for pane_id in $panes; do
            echo "${sess}:0.${pane_id}|${sess}/p${pane_id}"
        done
    done
}

run_monitor() {
    # This function runs inside the tmux session — it IS the monitor loop.
    local mode="$1"

    # --- "all" mode: auto-discover ALL sessions and panes ---
    if [[ "$mode" == "all" ]]; then
        echo "=== claude-unblock: AUTO-DISCOVER mode (all sessions, all panes) ==="
        echo "Poll interval: 6s | Re-discover sessions every ~60s"
        echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "Detach: Ctrl+B D (monitor keeps running)"
        echo "Stop:   Ctrl+C"
        echo "---"

        local confirm_count=0
        local scan_count=0
        local targets=""

        while true; do
            # Re-discover targets every ~10 scans (~60s)
            if (( scan_count % 10 == 0 )); then
                local new_targets
                new_targets=$(discover_targets)
                if [[ "$new_targets" != "$targets" ]]; then
                    targets="$new_targets"
                    local count
                    count=$(echo "$targets" | grep -c '.' || true)
                    echo "[$(date '+%H:%M:%S')] Discovered $count panes across sessions"
                    echo "$targets" | while IFS='|' read -r tgt label; do
                        echo "  → $label ($tgt)"
                    done
                fi
            fi

            echo "$targets" | while IFS='|' read -r TARGET PANE_NAME; do
                [[ -z "$TARGET" ]] && continue
                process_pane "$TARGET" "$PANE_NAME" || true
            done

            # Read confirm_count from temp file (subshell workaround)
            if [[ -f /tmp/claude-unblock-confirms ]]; then
                confirm_count=$(cat /tmp/claude-unblock-confirms)
            fi

            scan_count=$((scan_count + 1))
            if (( scan_count % 30 == 0 )); then
                echo "[$(date '+%H:%M:%S')] ... scanning (${confirm_count} confirmed so far)"
            fi

            sleep 6
        done
        return
    fi

    # --- Legacy modes: agents, liaison, <session-name> ---
    local agent_session
    declare -A PANES

    if [[ "$mode" == "liaison" || "$mode" == "agents" ]]; then
        # Built-in modes: find the claude-agents session
        agent_session=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -m1 'claude-agents' || true)
        if [[ -z "$agent_session" ]]; then
            echo "ERROR: claude-agents tmux session not found"
            echo "Start it first: claude-session claude-agents"
            echo "Waiting for claude-agents session..."
            while true; do
                agent_session=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -m1 'claude-agents' || true)
                if [[ -n "$agent_session" ]]; then
                    echo "Found session: $agent_session"
                    break
                fi
                sleep 10
            done
        fi

        if [[ "$mode" == "liaison" ]]; then
            PANES=([0]="LIAISON")
            echo "=== claude-unblock: LIAISON mode (pane 0 only) ==="
        else
            PANES=([1]="PDSA" [2]="DEV" [3]="QA")
            echo "=== claude-unblock: AGENT PANES mode (panes 1-3: PDSA, DEV, QA) ==="
        fi
    else
        # Named session mode: monitor pane 0 of the given session
        agent_session="$mode"

        # Wait for the named session to exist
        if ! tmux has-session -t "$agent_session" 2>/dev/null; then
            echo "Waiting for tmux session '$agent_session'..."
            while true; do
                if tmux has-session -t "$agent_session" 2>/dev/null; then
                    echo "Found session: $agent_session"
                    break
                fi
                sleep 10
            done
        fi

        PANES=([0]="$agent_session")
        echo "=== claude-unblock: SESSION mode ($agent_session, pane 0) ==="
    fi

    echo "Agent session: $agent_session"
    echo "Monitoring: ${PANES[*]}"
    echo "Poll interval: 6s"
    echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Detach: Ctrl+B D (monitor keeps running)"
    echo "Stop:   Ctrl+C"
    echo "---"

    local confirm_count=0
    local scan_count=0

    while true; do
        for PANE_ID in "${!PANES[@]}"; do
            local PANE_NAME="${PANES[$PANE_ID]}"
            local TARGET="${agent_session}:0.${PANE_ID}"
            process_pane "$TARGET" "$PANE_NAME" || true
        done

        confirm_count=$(cat "$CONFIRM_FILE" 2>/dev/null || echo 0)
        scan_count=$((scan_count + 1))
        if (( scan_count % 30 == 0 )); then
            echo "[$(date '+%H:%M:%S')] ... scanning (${confirm_count} confirmed so far)"
        fi

        sleep 6
    done
}

# --- Main ---

MODE="${1:-all}"

# Handle --run flag (internal: called inside the tmux session)
if [[ "$MODE" == "--run-"* ]]; then
    # Extract the actual mode from --run-<mode>
    run_mode="${MODE#--run-}"
    run_monitor "$run_mode"
    exit 0
fi

# Show help for -h/--help
if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
    cat <<'EOF'
Usage: claude-unblock [all|agents|liaison|<session-name>]

Monitors Claude agent tmux sessions and auto-confirms permission prompts.

  claude-unblock                          ALL sessions, all panes (auto-discover)
  claude-unblock agents                   claude-agents: all panes (0-3)
  claude-unblock liaison                  claude-agents: pane 0 only
  claude-unblock HomeAssistantDevOpsAgent HomeAssistant agent session
  claude-unblock <session-name>           Any tmux session (pane 0)

Default mode (no args) auto-discovers all tmux sessions and monitors all panes.
Sessions are re-discovered every ~60s, so new sessions are picked up automatically.

The monitor runs in a persistent tmux session (survives disconnects).
  Detach: Ctrl+B D    Reattach: claude-unblock [mode]
  Stop:   Ctrl+C (inside session) or: tmux kill-session -t claude-unblock-*
EOF
    exit 0
fi

if is_local_or_hetzner; then
    # On Hetzner: if running as thomas, re-exec as developer
    if [[ "$RUN_MODE" == "hetzner" && "$(whoami)" != "developer" ]]; then
        exec sudo -i -u developer bash "$SELF_PATH" "$MODE"
    fi

    # Unset TMUX to allow running from inside an existing tmux session
    unset TMUX

    # Session name for the unblock monitor tmux session
    if [[ "$MODE" == "all" ]]; then
        SESSION_NAME="claude-unblock"
    elif [[ "$MODE" == "agents" ]]; then
        SESSION_NAME="claude-unblock-agents"
    else
        # liaison → claude-unblock-liaison
        # HomeAssistantDevOpsAgent → claude-unblock-HomeAssistantDevOpsAgent
        SESSION_NAME="claude-unblock-${MODE}"
    fi
    RUN_FLAG="--run-${MODE}"

    # If session exists, just attach
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo "Monitor already running. Attaching..."
        exec tmux attach -t "$SESSION_NAME"
    fi

    # Create new session running the monitor
    echo "Starting unblock monitor in tmux session '$SESSION_NAME'..."
    tmux new-session -d -s "$SESSION_NAME" "bash $SELF_PATH $RUN_FLAG"

    # Attach
    exec tmux attach -t "$SESSION_NAME"
else
    # Not on Hetzner and no local Claude — SSH in
    run_remote "$MODE"
fi
