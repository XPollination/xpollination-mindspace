#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Thomas Pichler <herr.thomas.pichler@gmail.com>
#===============================================================================
# claude-unblock.sh — Auto-confirm permission prompts for Claude agents
#
# Auto-discovers ALL running Claude agents via tmux list-panes -a.
# Runs inside its own tmux session so it persists across terminal disconnects.
#
# Usage:
#   claude-unblock                          # Unblock ALL detected agents
#   claude-unblock liaison                  # Filter to LIAISON only
#   claude-unblock dev qa                   # Filter to DEV and QA
#   claude-unblock agents                   # Backward compat: all non-liaison
#   claude-unblock HomeAssistantDevOpsAgent # Filter to named session
#
# Behavior:
#   - First run  → creates tmux session "claude-unblock", starts monitor
#   - Next run   → attaches to existing session (monitor already running)
#   - Detach     → Ctrl+B D (monitor keeps running in background)
#   - Stop       → attach and Ctrl+C, or: tmux kill-session -t claude-unblock
#
# What it does:
#   - Auto-discovers all Claude agent panes via tmux list-panes -a
#   - Re-discovers agents every 60 seconds (adds new, removes dead)
#   - Checks last 300 lines of each pane every 6 seconds
#   - Detects "❯ N. Yes/Allow" permission prompts
#   - Prefers "don't ask again" > "allow all" > "yes"
#   - Detects "Do you want to proceed" prompts
#   - Logs every action with timestamp and pane name
#
# What it does NOT do:
#   - Never sends Enter to "accept edits on" (mode indicator, not a prompt)
#   - Never interferes with agent typing or active work
#   - Never auto-confirms AskUserQuestion (bullet gate ● protection)
#
# Prerequisites:
#   - At least one tmux session with Claude agents running
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
readonly REDISCOVER_INTERVAL=10  # re-discover every 10 cycles (~60s at 6s poll)

# --- Functions ---

is_on_hetzner() {
    # Developer has claude under their home; system-wide install (e.g. maria's
    # runtime) lives at /usr/local/bin/claude. Either marker means we're on the box.
    [[ -x "$CLAUDE_BIN" ]] || [[ -x "/usr/local/bin/claude" ]]
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

get_agent_name() {
    local session="$1" pane_idx="$2"
    if [[ "$session" == *"claude-agents"* ]]; then
        case "$pane_idx" in
            0) echo "LIAISON" ;;
            1) echo "PDSA" ;;
            2) echo "DEV" ;;
            3) echo "QA" ;;
            *) echo "${session}:${pane_idx}" ;;
        esac
    else
        echo "$session"
    fi
}

discover_agents() {
    # Auto-detect all panes running claude across ALL tmux sessions.
    # Returns lines of: TARGET AGENT_NAME
    # Uses tmux list-panes -a to find every pane, then filters for claude processes.
    local pane_list
    pane_list=$(tmux list-panes -a -F '#{session_name} #{window_index} #{pane_index} #{pane_current_command}' 2>/dev/null) || return

    while IFS=' ' read -r session win_idx pane_idx cmd; do
        # Match panes running claude (the CLI binary)
        if [[ "$cmd" == *"claude"* ]]; then
            local target="${session}:${win_idx}.${pane_idx}"
            local name
            name=$(get_agent_name "$session" "$pane_idx")
            echo "${target} ${name}"
        fi
    done <<< "$pane_list"
}

run_monitor() {
    # This function runs inside the tmux session — it IS the monitor loop.
    local -a target_filters=("$@")

    echo "=== claude-unblock: auto-discovery ==="
    echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"

    # Wait until at least one agent is detected
    local discovery_output=""
    while true; do
        discovery_output=$(discover_agents)
        if [[ -n "$discovery_output" ]]; then
            break
        fi
        echo "No Claude agents detected. Waiting..."
        sleep 10
    done

    # Build agent list from discovery
    declare -A AGENTS  # TARGET -> NAME
    local total_found=0

    while IFS=' ' read -r target name; do
        AGENTS["$target"]="$name"
        total_found=$((total_found + 1))
    done <<< "$discovery_output"

    echo "Detected ${total_found} Claude agents:"
    for target in "${!AGENTS[@]}"; do
        echo "  ${target}  ${AGENTS[$target]}"
    done

    # Apply target filter if specified
    if [[ ${#target_filters[@]} -gt 0 && "${target_filters[0]}" != "all" ]]; then
        declare -A FILTERED
        local filter_matched=0

        for target in "${!AGENTS[@]}"; do
            local agent_name="${AGENTS[$target]}"
            local agent_lower
            agent_lower=$(echo "$agent_name" | tr 'A-Z' 'a-z')

            for filter in "${target_filters[@]}"; do
                local filter_lower
                filter_lower=$(echo "$filter" | tr 'A-Z' 'a-z')

                # Backward compat: "agents" matches PDSA/DEV/QA (not LIAISON)
                if [[ "$filter_lower" == "agents" ]]; then
                    if [[ "$agent_lower" == "pdsa" || "$agent_lower" == "dev" || "$agent_lower" == "qa" ]]; then
                        FILTERED["$target"]="$agent_name"
                        filter_matched=$((filter_matched + 1))
                    fi
                elif [[ "$agent_lower" == "$filter_lower" || "$agent_name" == *"$filter"* ]]; then
                    FILTERED["$target"]="$agent_name"
                    filter_matched=$((filter_matched + 1))
                fi
            done
        done

        if [[ $filter_matched -eq 0 ]]; then
            echo "WARNING: No agents match filter: ${target_filters[*]}"
            echo "Available: ${AGENTS[*]}"
            echo "Falling back to ALL agents"
        else
            # Replace AGENTS with filtered set
            unset AGENTS
            declare -A AGENTS
            for target in "${!FILTERED[@]}"; do
                AGENTS["$target"]="${FILTERED[$target]}"
            done
            echo "Monitoring: ${AGENTS[*]} (${filter_matched} of ${total_found} agents)"
        fi
    else
        echo "Monitoring: ALL (${total_found} agents)"
    fi

    echo "Poll interval: 6s | Re-discovery: every 60s"
    echo "Detach: Ctrl+B D (monitor keeps running)"
    echo "Stop:   Ctrl+C"
    echo "---"

    local confirm_count=0
    local scan_count=0

    while true; do
        # Re-discover agents periodically
        if (( scan_count > 0 && scan_count % REDISCOVER_INTERVAL == 0 )); then
            local new_discovery
            new_discovery=$(discover_agents) || true

            if [[ -n "$new_discovery" ]]; then
                # Check for new agents
                while IFS=' ' read -r target name; do
                    if [[ -z "${AGENTS[$target]+x}" ]]; then
                        # Apply filter if active
                        local should_add=true
                        if [[ ${#target_filters[@]} -gt 0 && "${target_filters[0]}" != "all" ]]; then
                            should_add=false
                            local name_lower
                            name_lower=$(echo "$name" | tr 'A-Z' 'a-z')
                            for filter in "${target_filters[@]}"; do
                                local fl
                                fl=$(echo "$filter" | tr 'A-Z' 'a-z')
                                if [[ "$fl" == "agents" ]]; then
                                    if [[ "$name_lower" == "pdsa" || "$name_lower" == "dev" || "$name_lower" == "qa" ]]; then
                                        should_add=true
                                    fi
                                elif [[ "$name_lower" == "$fl" || "$name" == *"$filter"* ]]; then
                                    should_add=true
                                fi
                            done
                        fi
                        if [[ "$should_add" == "true" ]]; then
                            AGENTS["$target"]="$name"
                            echo "[$(date '+%H:%M:%S')] + ${name} detected (${target})"
                        fi
                    fi
                done <<< "$new_discovery"

                # Check for removed agents
                for target in "${!AGENTS[@]}"; do
                    if ! echo "$new_discovery" | grep -q "^${target} "; then
                        echo "[$(date '+%H:%M:%S')] - ${AGENTS[$target]} removed (pane gone)"
                        unset "AGENTS[$target]"
                    fi
                done
            fi
        fi

        for TARGET in "${!AGENTS[@]}"; do
            local PANE_NAME="${AGENTS[$TARGET]}"

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
                # Strategy: check last 20 lines for ● OR known safe prompt language.
                # If none found, skip (likely AskUserQuestion).
                local prompt_header
                prompt_header=$(echo "$output" | tail -20 | tr '\n' ' ' | tr -s ' ')
                if ! echo "$prompt_header" | grep -qE '●'; then
                    # No ● bullet — check for trust/safety prompt language
                    if ! echo "$prompt_header" | grep -qE 'Do you want to allow|Claude wants to|Do you want to proceed'; then
                        continue
                    fi
                fi

                # Find the best option: prefer "don't ask again" > numbered Yes > Enter
                if echo "$prompt_area" | grep -qiE "don.t ask again"; then
                    # Extract the option number for "don't ask again"
                    # Use single-digit [1-9] only — multi-digit numbers (183, etc.)
                    # are line numbers from Read tool output, not option numbers.
                    local option
                    option=$(echo "$prompt_area" | grep -oiE '[1-9]\.[^.]{0,80}don.t ask again' | head -1 | grep -oE '^[1-9]')
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
            echo "[$(date '+%H:%M:%S')] ... scanning (${confirm_count} confirmed so far, ${#AGENTS[@]} agents)"
        fi

        sleep 6
    done
}

# --- Main ---

MODE="${1:-all}"
shift 2>/dev/null || true
EXTRA_ARGS=("$@")

# Handle --run flag (internal: called inside the tmux session)
if [[ "$MODE" == "--run-"* ]]; then
    # Extract the actual mode from --run-<mode>
    run_mode="${MODE#--run-}"
    # Split remaining args — "agents" and "liaison" are backward compat filters
    if [[ "$run_mode" == "all" ]]; then
        run_monitor "all"
    else
        run_monitor "$run_mode" "${EXTRA_ARGS[@]}"
    fi
    exit 0
fi

# Show help for -h/--help
if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
    cat <<'EOF'
Usage: claude-unblock [target...]

  claude-unblock                          Unblock ALL detected Claude agents
  claude-unblock liaison                  Filter to LIAISON agent only
  claude-unblock dev qa                   Filter to DEV and QA agents
  claude-unblock agents                   Backward compat: PDSA, DEV, QA
  claude-unblock HomeAssistantDevOpsAgent Filter to named session agent

The monitor auto-discovers all Claude agents via tmux list-panes -a.
Re-discovers every 60s. Runs in a tmux session that persists across disconnects.
  Detach: Ctrl+B D    Reattach: claude-unblock
  Stop:   Ctrl+C (inside session) or: tmux kill-session -t claude-unblock
EOF
    exit 0
fi

if is_on_hetzner; then
    CURRENT_USER="$(whoami)"

    # Runtime users run the monitor locally in their own tmux server.
    # Orchestrator user (typically thomas) spawns a maria-context monitor in
    # the background AND then re-execs as developer for the foreground monitor.
    # Each runtime user has its own tmux server, so 'claude-unblock' session
    # names don't collide — each monitor only sees its own user's Claude panes.
    if [[ "$CURRENT_USER" != "developer" && "$CURRENT_USER" != "maria" ]]; then
        # Background-spawn maria monitor (idempotent via tmux has-session check below)
        if getent passwd maria >/dev/null 2>&1; then
            sudo -n -iu maria bash "$SELF_PATH" "$MODE" "${EXTRA_ARGS[@]}" \
                </dev/null >/tmp/claude-unblock-maria-launch.log 2>&1 &
            disown
            echo "Spawned maria-context unblock monitor in background (log: /tmp/claude-unblock-maria-launch.log)."
            echo "  To attach manually: sudo -n -iu maria tmux attach -t claude-unblock"
        fi
        exec sudo -i -u developer bash "$SELF_PATH" "$MODE" "${EXTRA_ARGS[@]}"
    fi

    # Unset TMUX to allow running from inside an existing tmux session
    unset TMUX

    # Unified session name — auto-discovery replaces per-mode sessions
    SESSION_NAME="claude-unblock"
    RUN_FLAG="--run-${MODE}"

    # If session exists, just attach (or exit quietly when no tty, e.g. background spawn)
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        if [[ -t 1 ]]; then
            echo "Monitor already running. Attaching..."
            exec tmux attach -t "$SESSION_NAME"
        else
            echo "Monitor already running (no tty — staying detached)."
            exit 0
        fi
    fi

    # Create new session running the monitor
    echo "Starting unblock monitor in tmux session '$SESSION_NAME' (user: $CURRENT_USER)..."
    tmux new-session -d -s "$SESSION_NAME" "bash $SELF_PATH $RUN_FLAG ${EXTRA_ARGS[*]:-}"

    # Attach only when invoked interactively; background spawns stay detached
    if [[ -t 1 ]]; then
        exec tmux attach -t "$SESSION_NAME"
    else
        echo "Monitor started in background tmux session '$SESSION_NAME' (no tty)."
        exit 0
    fi
else
    # Not on Hetzner — SSH in
    run_remote "$MODE"
fi
