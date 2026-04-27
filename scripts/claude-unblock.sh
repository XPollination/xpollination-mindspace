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
readonly EXCLUDE_FILE="${HOME}/.config/claude-unblock/exclude-sessions"

# Global: loaded by load_excludes(), read by is_excluded_session()
declare -a EXCLUDES=()

load_excludes() {
    EXCLUDES=()
    if [[ -n "${CLAUDE_UNBLOCK_EXCLUDE_SESSIONS:-}" ]]; then
        local env_val="${CLAUDE_UNBLOCK_EXCLUDE_SESSIONS//[[:space:]]/}"
        IFS=',' read -ra env_excl <<< "$env_val"
        for e in "${env_excl[@]}"; do [[ -n "$e" ]] && EXCLUDES+=("$e"); done
    fi
    if [[ -f "$EXCLUDE_FILE" ]]; then
        while IFS= read -r line; do
            line="${line#"${line%%[![:space:]]*}"}"  # ltrim
            line="${line%"${line##*[![:space:]]}"}"  # rtrim
            [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
            EXCLUDES+=("$line")
        done < "$EXCLUDE_FILE"
    fi
}

is_excluded_session() {
    local session="$1"
    local excl
    for excl in "${EXCLUDES[@]}"; do
        [[ "$session" == "$excl" ]] && return 0
    done
    return 1
}

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
    # Checks BOTH pane_current_command AND child process tree.
    # Claude Code often runs as bash→bash→claude, so pane_current_command shows "bash".
    local pane_list
    pane_list=$(tmux list-panes -a -F '#{session_name} #{window_index} #{pane_index} #{pane_current_command} #{pane_pid}' 2>/dev/null) || return

    while IFS=' ' read -r session win_idx pane_idx cmd pane_pid; do
        # Skip excluded sessions entirely (e.g. human-interactive panes)
        if is_excluded_session "$session"; then
            continue
        fi

        local target="${session}:${win_idx}.${pane_idx}"
        local found=false

        # Direct match: pane command is claude
        if [[ "$cmd" == *"claude"* ]]; then
            found=true
        fi

        # Child process match: claude runs as child of bash
        if [[ "$found" == "false" && -n "$pane_pid" ]]; then
            if pstree -p "$pane_pid" 2>/dev/null | grep -q "claude"; then
                found=true
            fi
        fi

        if [[ "$found" == "true" ]]; then
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

    load_excludes
    if [[ ${#EXCLUDES[@]} -gt 0 ]]; then
        echo "Excluded sessions: ${EXCLUDES[*]}"
    fi

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

    # Dedup: remember the hash of the last prompt we fired on per target.
    # Without this we re-fire on the same prompt every 6s until Claude's UI
    # clears, and the stray keystrokes land as typed input in the next turn.
    declare -A LAST_FIRED_HASH

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
            # Use tail -20 for narrow panes where footer wraps across many lines
            local bottom
            bottom=$(echo "$output" | tail -20)

            # Active prompt detection: two prompt formats exist:
            # 1. Tool execution prompts: show "Esc to cancel" footer
            # 2. Trust/domain prompts: show "Do you want to allow Claude to..."
            # NEVER use generic patterns like "❯ [0-9]+" — they match displayed
            # tool output (line numbers, numbered lists) and cause false positives.
            local bottom_collapsed
            bottom_collapsed=$(echo "$bottom" | tr '\n' ' ' | tr -s ' ')
            if ! echo "$bottom_collapsed" | grep -qE 'Esc to cancel|Do you want to allow'; then
                # Prompt is gone — reset dedup so the next fresh prompt fires.
                unset "LAST_FIRED_HASH[$TARGET]"
                continue
            fi

            # Use FULL scrollback for prompt area — narrow panes (68 chars) wrap
            # long commands across 100+ lines, pushing "❯ 1. Yes" far from "3. No".
            # Safety: the "Esc to cancel" gate above ensures we're in a real prompt.
            # The ● bullet check below prevents AskUserQuestion false positives.
            local prompt_area
            prompt_area=$(echo "$output" | tr '\n' ' ' | tr -s ' ')

            # Dedup: hash the prompt text. If we've already fired on THIS exact
            # prompt, skip until it changes (i.e., Claude dismisses it).
            local prompt_hash
            prompt_hash=$(echo "$prompt_area" | md5sum | cut -d' ' -f1)
            if [[ "${LAST_FIRED_HASH[$TARGET]:-}" == "$prompt_hash" ]]; then
                continue
            fi


            # SAFETY: Only auto-confirm tool PERMISSION, TRUST, and SAFETY prompts.
            # Never auto-confirm AskUserQuestion (human decision prompts).
            # Four prompt types exist:
            # 1. Tool execution: "● Bash(...)" — have ● bullet near options
            # 2. Trust/domain:   "Do you want to allow Claude to fetch..." — no ●
            # 3. Safety warning: "Do you want to proceed?" — no ●, command safety check
            # 4. AskUserQuestion: "? Approve to send?" — no ● AND no trust/safety language
            #
            # Strategy: check full scrollback for ● OR known safe prompt language.
            # If none found, skip (likely AskUserQuestion).
            if ! echo "$prompt_area" | grep -qE '●'; then
                if ! echo "$prompt_area" | grep -qE 'Do you want to allow|Claude wants to|Do you want to proceed'; then
                    continue
                fi
            fi

            # Find the best option: prefer "don't ask again" > numbered Yes > Enter
            if echo "$prompt_area" | grep -qiE "don.t ask again"; then
                local option
                option=$(echo "$prompt_area" | grep -oiE '[1-9]\.[^.]{0,80}don.t ask again' | head -1 | grep -oE '^[1-9]')
                if [[ -n "$option" ]]; then
                    LAST_FIRED_HASH[$TARGET]="$prompt_hash"
                    tmux send-keys -t "$TARGET" "$option"
                    confirm_count=$((confirm_count + 1))
                    echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option $option (don't ask again) [#$confirm_count]"
                    sleep 10
                    continue
                fi
            fi

            if echo "$prompt_area" | grep -qE '❯.*[0-9]+\. Yes'; then
                # Pick the highest-numbered "Yes" option (allow all > allow once)
                if echo "$prompt_area" | grep -qE '3\.[^0-9]*Yes'; then
                    LAST_FIRED_HASH[$TARGET]="$prompt_hash"
                    tmux send-keys -t "$TARGET" 3
                    confirm_count=$((confirm_count + 1))
                    echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 3 (yes/allow all) [#$confirm_count]"
                elif echo "$prompt_area" | grep -qE '2\.[^0-9]*Yes'; then
                    LAST_FIRED_HASH[$TARGET]="$prompt_hash"
                    tmux send-keys -t "$TARGET" 2
                    confirm_count=$((confirm_count + 1))
                    echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 2 (yes/allow all) [#$confirm_count]"
                else
                    LAST_FIRED_HASH[$TARGET]="$prompt_hash"
                    tmux send-keys -t "$TARGET" 1
                    confirm_count=$((confirm_count + 1))
                    echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Option 1 (yes) [#$confirm_count]"
                fi
                sleep 10
                continue
            fi

            # Fallback: "Do you want to proceed" with numbered options
            if echo "$prompt_area" | grep -qE 'Do you want'; then
                LAST_FIRED_HASH[$TARGET]="$prompt_hash"
                if echo "$prompt_area" | grep -qE '[0-9]+\. Yes'; then
                    tmux send-keys -t "$TARGET" 1
                    confirm_count=$((confirm_count + 1))
                    echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Confirmed prompt (option 1) [#$confirm_count]"
                else
                    tmux send-keys -t "$TARGET" Enter
                    confirm_count=$((confirm_count + 1))
                    echo "[$(date '+%H:%M:%S')] $PANE_NAME: ✓ Confirmed 'Do you want' (Enter) [#$confirm_count]"
                fi
                sleep 10
                continue
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
    # If running as thomas, re-exec as developer
    if [[ "$(whoami)" != "developer" ]]; then
        exec sudo -i -u developer bash "$SELF_PATH" "$MODE" "${EXTRA_ARGS[@]}"
    fi

    # Unset TMUX to allow running from inside an existing tmux session
    unset TMUX

    # Unified session name — auto-discovery replaces per-mode sessions
    SESSION_NAME="claude-unblock"
    RUN_FLAG="--run-${MODE}"

    # If session exists, just attach
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo "Monitor already running. Attaching..."
        exec tmux attach -t "$SESSION_NAME"
    fi

    # Create new session running the monitor
    echo "Starting unblock monitor in tmux session '$SESSION_NAME'..."
    tmux new-session -d -s "$SESSION_NAME" "bash $SELF_PATH $RUN_FLAG ${EXTRA_ARGS[*]:-}"

    # Attach
    exec tmux attach -t "$SESSION_NAME"
else
    # Not on Hetzner — SSH in
    run_remote "$MODE"
fi
