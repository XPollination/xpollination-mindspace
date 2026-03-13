#!/bin/bash
#===============================================================================
# claude-unblock.sh — Auto-confirm permission prompts for ALL Claude agents
#
# Monitors any agent running in any tmux session on the system. Runs inside
# its own persistent tmux session so it survives terminal disconnects.
# One instance per target session — run multiple for full system coverage.
#
# Usage:
#   claude-unblock                          # claude-agents: all panes (0-3)
#   claude-unblock liaison                  # claude-agents: pane 0 only
#   claude-unblock HomeAssistantDevOpsAgent # HomeAssistantDevOpsAgent: pane 0
#   claude-unblock <any-tmux-session>       # Any session: pane 0
#
# Full system coverage (all agents on this machine):
#   claude-unblock                          # covers claude-agents (4 panes)
#   claude-unblock HomeAssistantDevOpsAgent # covers HomeAssistant agent
#   # ... one call per additional agent session
#
# Behavior:
#   - First run  → creates tmux session "claude-unblock[-name]", starts monitor
#   - Next run   → attaches to existing session (monitor already running)
#   - Detach     → Ctrl+B D (monitor keeps running in background)
#   - Stop       → attach and Ctrl+C, or: tmux kill-session -t claude-unblock-*
#
# Modes:
#   agents (default) → claude-agents session, panes 0-3 (LIAISON, PDSA, DEV, QA)
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

# --- Configuration ---
readonly HETZNER_VPN_IP="10.33.33.1"
readonly HETZNER_USER="developer"
readonly HETZNER_HOME="/home/${HETZNER_USER}"
readonly SELF_PATH="$(realpath "$0")"
readonly CLAUDE_BIN="${HETZNER_HOME}/.local/bin/claude"

# --- Functions ---

is_on_hetzner() {
    [[ -x "$CLAUDE_BIN" ]]
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

run_monitor() {
    # This function runs inside the tmux session — it IS the monitor loop.
    local mode="$1"

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
            PANES=([0]="LIAISON" [1]="PDSA" [2]="DEV" [3]="QA")
            echo "=== claude-unblock: ALL PANES mode (panes 0-3: LIAISON, PDSA, DEV, QA) ==="
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

            # Capture pane with deep scrollback — narrow panes (8-15 chars) wrap a single
            # permission prompt across 100+ lines, pushing "❯ 1. Yes" far above visible area
            local output
            output=$(tmux capture-pane -t "$TARGET" -p -S -300 2>/dev/null) || continue

            # Only process if there's an active prompt (bottom of pane has prompt indicator)
            # Use tail -12 because narrow panes wrap the footer across many lines:
            # "Esc to cancel · Tab to amend · ctrl+e to explain" can span 8+ lines
            local bottom
            bottom=$(echo "$output" | tail -12)

            # Active prompt detection: two prompt formats exist:
            # 1. Tool execution prompts: show "Esc to cancel" footer
            # 2. Trust/domain prompts: show "Do you want to allow Claude to..."
            # NEVER use generic patterns like "❯ [0-9]+" — they match displayed
            # tool output (line numbers, numbered lists) and cause false positives.
            local bottom_collapsed
            bottom_collapsed=$(echo "$bottom" | tr '\n' ' ' | tr -s ' ')
            if echo "$bottom_collapsed" | grep -qE 'Esc to cancel|Do you want to allow'; then

                # Use ONLY the prompt area for option matching (last 40 lines).
                # The full 300-line scrollback contains prior agent output that
                # causes false matches — e.g. "2." in output + "Yes" elsewhere
                # would match "2\..*Yes" and pick option 2 (No) instead of 1 (Yes).
                local prompt_area
                prompt_area=$(echo "$output" | tail -40 | tr '\n' ' ' | tr -s ' ')

                # SAFETY: Only auto-confirm tool PERMISSION, TRUST, and SAFETY prompts.
                # Never auto-confirm AskUserQuestion (human decision prompts).
                # Four prompt types exist:
                # 1. Tool execution: "● Bash(...)" — have ● bullet near options
                # 2. Trust/domain:   "Do you want to allow Claude to fetch..." — no ●
                # 3. Safety warning: "Do you want to proceed?" — no ●, command safety check
                # 4. AskUserQuestion: "? Approve to send?" — no ● AND no trust/safety language
                #
                # Strategy: check prompt_area (tail -40) for ● OR known safe prompt language.
                # Narrow panes (15 chars) wrap options across 8+ empty lines, pushing the ●
                # and "Do you want" text 30+ lines above the bottom. tail -20 misses them.
                # prompt_area (tail -40) is already computed and large enough.
                if ! echo "$prompt_area" | grep -qE '●'; then
                    # No ● bullet — check for trust/safety prompt language
                    if ! echo "$prompt_area" | grep -qE 'Do you want to allow|Claude wants to|Do you want to proceed|Run shell command'; then
                        continue
                    fi
                fi

                # Find the best option: prefer "don't ask again" > numbered Yes > Enter
                if echo "$prompt_area" | grep -qiE "don.t ask again"; then
                    # Extract the option number for "don't ask again"
                    # Use single-digit [1-9] only — multi-digit numbers (183, etc.)
                    # are line numbers from Read tool output, not option numbers.
                    # Narrow panes (15 chars) may render "2Yes" instead of "2. Yes"
                    # because the period wraps to a different line.
                    local option
                    option=$(echo "$prompt_area" | grep -oiE '[1-9]\.?[^.]{0,80}don.t ask again' | head -1 | grep -oE '^[1-9]')
                    if [[ -n "$option" ]]; then
                        tmux send-keys -t "$TARGET" "$option"
                        confirm_count=$((confirm_count + 1))
                        echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option $option (don't ask again) [#$confirm_count]"
                        sleep 3
                        continue
                    fi
                fi

                if echo "$prompt_area" | grep -qE '❯.*[0-9]+\. Yes'; then
                    # Pick the highest-numbered "Yes" option (allow all > allow once)
                    # but NEVER pick an option that doesn't contain "Yes"
                    if echo "$prompt_area" | grep -qE '3\.[^0-9]*Yes'; then
                        tmux send-keys -t "$TARGET" 3
                        confirm_count=$((confirm_count + 1))
                        echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 3 (yes/allow all) [#$confirm_count]"
                    elif echo "$prompt_area" | grep -qE '2\.[^0-9]*Yes'; then
                        tmux send-keys -t "$TARGET" 2
                        confirm_count=$((confirm_count + 1))
                        echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 2 (yes/allow all) [#$confirm_count]"
                    else
                        tmux send-keys -t "$TARGET" 1
                        confirm_count=$((confirm_count + 1))
                        echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 1 (yes) [#$confirm_count]"
                    fi
                    sleep 3
                    continue
                fi

                # Fallback: "Do you want to proceed" with numbered options
                if echo "$prompt_area" | grep -qE 'Do you want'; then
                    if echo "$prompt_area" | grep -qE '[0-9]+\. Yes'; then
                        tmux send-keys -t "$TARGET" 1
                        confirm_count=$((confirm_count + 1))
                        echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Confirmed prompt (option 1) [#$confirm_count]"
                    else
                        tmux send-keys -t "$TARGET" Enter
                        confirm_count=$((confirm_count + 1))
                        echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Confirmed 'Do you want' (Enter) [#$confirm_count]"
                    fi
                    sleep 3
                    continue
                fi
            fi
        done

        scan_count=$((scan_count + 1))
        # Periodic heartbeat every ~30 scans (~3 min)
        if (( scan_count % 30 == 0 )); then
            echo "[$(date '+%H:%M:%S')] ... scanning (${confirm_count} confirmed so far)"
        fi

        sleep 6
    done
}

# --- Main ---

MODE="${1:-agents}"

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
Usage: claude-unblock [agents|liaison|<session-name>]

Monitors any Claude agent tmux session and auto-confirms permission prompts.
Run one instance per agent session for full system coverage.

  claude-unblock                          claude-agents: all panes (0-3)
  claude-unblock liaison                  claude-agents: pane 0 only
  claude-unblock HomeAssistantDevOpsAgent HomeAssistant agent session
  claude-unblock <session-name>           Any tmux session (pane 0)

The monitor runs in a persistent tmux session (survives disconnects).
  Detach: Ctrl+B D    Reattach: claude-unblock [mode]
  Stop:   Ctrl+C (inside session) or: tmux kill-session -t claude-unblock-*
EOF
    exit 0
fi

if is_on_hetzner; then
    # If running as thomas, re-exec as developer
    if [[ "$(whoami)" != "developer" ]]; then
        exec sudo -i -u developer bash "$SELF_PATH" "$MODE"
    fi

    # Unset TMUX to allow running from inside an existing tmux session
    unset TMUX

    # Session name for the unblock monitor tmux session
    if [[ "$MODE" == "agents" ]]; then
        SESSION_NAME="claude-unblock"
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
    # Not on Hetzner — SSH in
    run_remote "$MODE"
fi
