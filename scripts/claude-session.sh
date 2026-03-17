#!/bin/bash
#===============================================================================
# claude-session.sh — Claude tmux session launcher
#
# Single source of truth for creating/attaching Claude tmux sessions.
# Works from any working directory. Auto-detects environment:
#   - Hetzner (any user)    → runs tmux directly (auto-switches to developer)
#   - Remote (e.g. Synology)→ SSHes to Hetzner via VPN
#
# Usage:
#   claude-session <session-name>
#
# Examples:
#   claude-session claude-agents     # 4-pane: Liaison + PDSA + Dev + QA
#   claude-session claude-dual       # 3-pane: Orchestrator + PDSA+QA + Dev
#   claude-session claude-pdsa       # Single-pane PDSA agent
#   claude-session my-session        # Single-pane Claude session
#
# Behavior:
#   - Session exists   → attaches to it (idempotent)
#   - Session missing  → creates it, then attaches
#   - Wrong user       → auto-switches to developer via sudo
#
# Known layouts:
#   claude-agents → 4 panes (Liaison | PDSA | Dev / QA) per WORKFLOW.md v12
#   claude-dual   → 3 panes (Orchestrator | PDSA+QA | Dev) [legacy]
#   *             → Single pane with Claude
#
# Layout (claude-agents):
#   +------------------+------------------+------------------+
#   |                  |                  |   DEV            |
#   |  LIAISON         |  PDSA            |   (right-top)    |
#   |  (left)          |  (middle)        +------------------+
#   |  Pane 0          |  Pane 1          |   QA             |
#   |                  |                  |   (right-bottom) |
#   +------------------+------------------+------------------+
#     Pane 0             Pane 1             Pane 2 / Pane 3
#
# Layout (claude-dual) [legacy]:
#   +---------------------------+---------------------------+
#   |                           |     PDSA+QA Agent         |
#   |  ORCHESTRATOR Agent       |     (Right-Top) Pane 1    |
#   |  (Left, Full Height)      +---------------------------+
#   |  Pane 0                   |     DEV Agent             |
#   |                           |     (Right-Bottom) Pane 2 |
#   +---------------------------+---------------------------+
#
# Tmux controls (once inside):
#   Ctrl+B Left/Right/Up/Down  Switch panes
#   Ctrl+B O                   Cycle panes
#   Ctrl+B Z                   Zoom current pane (toggle)
#   Ctrl+B D                   Detach (session keeps running)
#
# Prerequisites:
#   - On Hetzner: Claude binary at /home/developer/.local/bin/claude
#   - On Synology: SSH key at ~/.ssh/hetzner-dev, WireGuard VPN connected
#===============================================================================

set -euo pipefail

# --- Environment Detection ---
# Three modes:
#   1. Hetzner server  → Claude at /home/developer/.local/bin/claude
#   2. Local machine   → Claude in PATH (e.g. macOS with homebrew/npm global)
#   3. Remote (no claude) → SSH to Hetzner
readonly HETZNER_VPN_IP="10.33.33.1"
readonly HETZNER_USER="developer"
readonly HETZNER_HOME="/home/${HETZNER_USER}"
readonly SELF_PATH="$(realpath "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -x "${HETZNER_HOME}/.local/bin/claude" ]]; then
    # On Hetzner
    readonly RUN_MODE="hetzner"
    readonly CLAUDE_BIN="${HETZNER_HOME}/.local/bin/claude"
    readonly WORKING_DIR="${XPO_WORKSPACE_PATH:-${HETZNER_HOME}/workspaces/github/PichlerThomas}"
    readonly NVM_NODE="${HETZNER_HOME}/.nvm/versions/node/v22.22.0/bin"
elif command -v claude &>/dev/null; then
    # Local machine with Claude installed
    readonly RUN_MODE="local"
    readonly CLAUDE_BIN="$(command -v claude)"
    readonly WORKING_DIR="${XPO_WORKSPACE_PATH:-${PROJECT_ROOT}}"
    readonly NVM_NODE=""
else
    # Remote — will SSH to Hetzner
    readonly RUN_MODE="remote"
    readonly CLAUDE_BIN=""
    readonly WORKING_DIR=""
    readonly NVM_NODE=""
fi

# Pre-approved tool patterns for agents — eliminates most permission prompts.
# Agents still can't do destructive ops (rm -rf, git reset --hard) without confirmation.
# Why: 368 individual Bash rules accumulated in settings.local.json, one per prompt confirmation.
# This replaces the manual unblock loop with declarative permissions at launch.
readonly ALLOWED_TOOLS=(
    # === Non-Bash tools (agents need ALL of these) ===
    "Read"
    "Edit"
    "Write"
    "Glob"
    "Grep"
    "Task"
    "Skill"
    "WebSearch"
    "WebFetch"
    "AskUserQuestion"
    "TaskCreate"
    "TaskUpdate"
    "TaskList"
    "TaskGet"
    "NotebookEdit"
    "EnterPlanMode"
    "ExitPlanMode"
    "EnterWorktree"

    # === Bash: Core runtime ===
    "Bash(node:*)"
    "Bash(npm:*)"
    "Bash(npx:*)"
    "Bash(source:*)"
    "Bash(bash:*)"
    "Bash(sh:*)"

    # === Bash: Git ===
    "Bash(git:*)"

    # === Bash: Network ===
    "Bash(curl:*)"

    # === Bash: Process management ===
    "Bash(pkill:*)"
    "Bash(pgrep:*)"
    "Bash(kill:*)"
    "Bash(ps:*)"
    "Bash(nohup:*)"

    # === Bash: File operations ===
    "Bash(ls:*)"
    "Bash(cat:*)"
    "Bash(head:*)"
    "Bash(tail:*)"
    "Bash(mkdir:*)"
    "Bash(cp:*)"
    "Bash(mv:*)"
    "Bash(chmod:*)"
    "Bash(touch:*)"
    "Bash(realpath:*)"
    "Bash(stat:*)"
    "Bash(du:*)"
    "Bash(diff:*)"
    "Bash(tee:*)"

    # === Bash: Text processing ===
    "Bash(echo:*)"
    "Bash(printf:*)"
    "Bash(grep:*)"
    "Bash(sed:*)"
    "Bash(awk:*)"
    "Bash(cut:*)"
    "Bash(tr:*)"
    "Bash(sort:*)"
    "Bash(wc:*)"
    "Bash(jq:*)"
    "Bash(find:*)"

    # === Bash: Database ===
    "Bash(sqlite3:*)"

    # === Bash: tmux ===
    "Bash(tmux:*)"

    # === Bash: Shell builtins & control ===
    "Bash(test:*)"
    "Bash([:*)"
    "Bash(set:*)"
    "Bash(unset:*)"
    "Bash(export:*)"
    "Bash(sleep:*)"
    "Bash(timeout:*)"
    "Bash(true:*)"
    "Bash(false:*)"
    "Bash(read:*)"
    "Bash(local:*)"
    "Bash(cd:*)"
    "Bash(which:*)"
    "Bash(command:*)"
    "Bash(date:*)"
    "Bash(env:*)"
    "Bash(python3:*)"
    "Bash(free:*)"
    "Bash(dirname:*)"
    "Bash(basename:*)"

    # === Bash: Shell loops/conditions (used as first word) ===
    "Bash(for:*)"
    "Bash(while:*)"
    "Bash(if:*)"
    "Bash(do:*)"
    "Bash(done:*)"
    "Bash(case:*)"

    # === Bash: Variable assignments as command prefixes ===
    "Bash(DATABASE_PATH:*)"
    "Bash(DB:*)"
    "Bash(CLI:*)"
    "Bash(SESSION_ID:*)"
    "Bash(AGENT_ROLE:*)"
    "Bash(PATH:*)"
    "Bash(NODE_ENV:*)"

    # === Bash: nvm wrapper (fallback for full nvm environment) ===
    "Bash(nvm-exec:*)"
)

# --- Skill & Hook Auto-Deploy ---

# Skills can live in the project itself or in a sibling xpollination-mcp-server repo
if [[ -d "${PROJECT_ROOT}/.claude/skills" ]]; then
    readonly SKILLS_SRC="${PROJECT_ROOT}/.claude/skills"
elif [[ -d "$WORKING_DIR/xpollination-mcp-server/.claude/skills" ]]; then
    readonly SKILLS_SRC="$WORKING_DIR/xpollination-mcp-server/.claude/skills"
else
    readonly SKILLS_SRC=""
fi
readonly SKILLS_DST="${HOME}/.claude/skills"
readonly SETTINGS_TEMPLATE="${WORKING_DIR:+${WORKING_DIR}/xpollination-mcp-server/scripts/xpo.claude.settings.json}"
readonly SYNC_SETTINGS_SCRIPT="${WORKING_DIR:+${WORKING_DIR}/xpollination-mcp-server/scripts/xpo.claude.sync-settings.js}"

sync_skills() {
    if [[ -z "$SKILLS_SRC" || ! -d "$SKILLS_SRC" ]]; then
        echo "  Skills source not found — skipping skill sync"
        return
    fi

    mkdir -p "$SKILLS_DST"

    for skill_dir in "$SKILLS_SRC"/*/; do
        local name
        name=$(basename "$skill_dir")
        local target="$SKILLS_SRC/$name"
        local link="$SKILLS_DST/$name"

        # Skip if already correct symlink
        if [ -L "$link" ] && [ "$(readlink "$link")" = "$target" ]; then
            continue
        fi

        # Remove existing (dir or wrong symlink)
        rm -rf "$link"
        ln -sfn "$target" "$link"
        echo "  Symlinked skill: $name"
    done

    # brain/ backward compat (relative symlink)
    if [ ! -L "$SKILLS_DST/brain" ] || [ "$(readlink "$SKILLS_DST/brain")" != "xpo.claude.mindspace.brain" ]; then
        rm -rf "$SKILLS_DST/brain"
        ln -sfn "xpo.claude.mindspace.brain" "$SKILLS_DST/brain"
        echo "  Symlinked brain/ backward compat"
    fi
}

sync_settings() {
    if [[ -z "$SETTINGS_TEMPLATE" || ! -f "$SETTINGS_TEMPLATE" ]]; then return; fi

    local local_settings="${HOME}/.claude/settings.json"

    # If no local settings, copy template
    if [ ! -f "$local_settings" ]; then
        cp "$SETTINGS_TEMPLATE" "$local_settings"
        echo "  Copied template settings.json"
        return
    fi

    # Merge using Node.js script
    PATH="$NVM_NODE:$PATH" node "$SYNC_SETTINGS_SCRIPT" "$SETTINGS_TEMPLATE" "$local_settings"
}

# --- Functions ---

usage() {
    cat <<'EOF'
Usage: claude-session <session-name>

Sessions:
  claude-agents  4-pane layout (Liaison + PDSA + Dev + QA) [WORKFLOW.md v12]
  claude-dual    3-pane layout (Orchestrator + PDSA+QA + Dev) [legacy]
  <any-name>     Single-pane Claude session

The session is created if it doesn't exist, or attached if it does.
Can be run as thomas — auto-switches to developer via sudo.
EOF
    exit 1
}

is_on_hetzner() {
    [[ "$RUN_MODE" == "hetzner" ]]
}

has_local_claude() {
    [[ "$RUN_MODE" == "local" ]]
}

wait_for_claude() {
    local pane="$1"
    local max_wait=30
    local waited=0
    while [ $waited -lt $max_wait ]; do
        local cmd
        cmd=$(tmux display-message -t "$pane" -p '#{pane_current_command}' 2>/dev/null)
        if [ "$cmd" = "claude" ]; then
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    echo "WARNING: Claude did not start in $pane within ${max_wait}s"
    return 1
}

handle_trust_prompt() {
    local pane="$1"
    sleep 2
    local capture
    capture=$(tmux capture-pane -t "$pane" -p -S -10 2>/dev/null)
    if echo "$capture" | grep -q "trust this folder"; then
        tmux send-keys -t "$pane" Enter
        sleep 2
    fi
}

create_agents_session() {
    local session="$1"

    # Auto-deploy skills + hooks before launching agents
    echo "Syncing skills and hooks..."
    sync_skills
    sync_settings

    # Write role prompts to temp files (avoids quoting issues in tmux send-keys)
    cat > /tmp/claude-role-liaison.txt << 'ROLE'
You are the LIAISON agent in a 4-agent tmux session (claude-agents).
Panes: 0=LIAISON(you), 1=PDSA, 2=DEV, 3=QA.
Start: /xpo.claude.monitor liaison
ROLE

    cat > /tmp/claude-role-pdsa.txt << 'ROLE'
You are the PDSA agent in a 4-agent tmux session (claude-agents).
Panes: 0=LIAISON, 1=PDSA(you), 2=DEV, 3=QA.
Start: /xpo.claude.monitor pdsa
ROLE

    cat > /tmp/claude-role-dev.txt << 'ROLE'
You are the DEVELOPMENT agent in a 4-agent tmux session (claude-agents).
Panes: 0=LIAISON, 1=PDSA, 2=DEV(you), 3=QA.
Start: /xpo.claude.monitor dev
ROLE

    cat > /tmp/claude-role-qa.txt << 'ROLE'
You are the QA agent in a 4-agent tmux session (claude-agents).
Panes: 0=LIAISON, 1=PDSA, 2=DEV, 3=QA(you).
Start: /xpo.claude.monitor qa
ROLE

    # Determine terminal dimensions (passed via env from user-switch, or detect)
    local cols="${TMUX_COLS:-$(tput cols 2>/dev/null || echo 200)}"
    local rows="${TMUX_ROWS:-$(tput lines 2>/dev/null || echo 50)}"

    # Create session with explicit size (pane 0: LIAISON)
    tmux new-session -d -s "$session" -x "$cols" -y "$rows" -c "$WORKING_DIR"

    # Pre-configure PATH — on Hetzner use nvm node, locally use existing PATH
    if [[ -n "$NVM_NODE" ]]; then
        tmux set-environment -t "$session" PATH "${NVM_NODE}:${WORKING_DIR}/xpollination-mcp-server/scripts:/usr/local/bin:/usr/bin:/bin"
    fi

    # Export BRAIN_API_KEY so hooks can authenticate with brain API
    # Check: env var > Hetzner key file > project .env file
    local brain_key="${BRAIN_API_KEY:-}"
    if [[ -z "$brain_key" && -f "${HETZNER_HOME}/.brain-api-key" ]]; then
        brain_key="$(cat "${HETZNER_HOME}/.brain-api-key" 2>/dev/null || echo "")"
    fi
    if [[ -z "$brain_key" && -f "${PROJECT_ROOT}/.env" ]]; then
        brain_key="$(grep '^BRAIN_API_KEY=' "${PROJECT_ROOT}/.env" 2>/dev/null | cut -d= -f2 || echo "")"
    fi
    if [ -n "$brain_key" ]; then
        tmux set-environment -t "$session" BRAIN_API_KEY "$brain_key"
    fi

    # Split pane 0 → pane 1 to the right (PDSA) — left gets 34%, right gets 66%
    # Note: use -l (not -p) — tmux 3.4 "-p" fails with "size missing" in detached sessions
    tmux split-window -t "${session}:0.0" -h -l 66% -c "$WORKING_DIR"

    # Split pane 1 → pane 2 to the right (DEV) — middle gets 50%, right gets 50% of 66%
    tmux split-window -t "${session}:0.1" -h -l 50% -c "$WORKING_DIR"

    # Split pane 2 vertically → pane 3 below (QA)
    tmux split-window -t "${session}:0.2" -v -c "$WORKING_DIR"

    tmux rename-window -t "${session}:0" 'LIAISON | PDSA | DEV | QA'

    # Pane border labels — persistent role names (Claude overrides pane_title with its spinner)
    tmux set-option -t "$session" pane-border-status top
    tmux set-option -t "$session" pane-border-format \
        ' #{?#{==:#{pane_index},0},LIAISON,#{?#{==:#{pane_index},1},PDSA,#{?#{==:#{pane_index},2},DEV,QA}}} │ #{pane_title} '

    # Start Claude in each pane with role via --append-system-prompt
    echo "Starting Claude in 4 panes (this takes ~30s per pane)..."

    # Build --allowedTools string with each tool individually single-quoted
    # to prevent bash in the pane from interpreting parentheses in Bash(node:*) etc.
    local tools_arg=""
    for tool in "${ALLOWED_TOOLS[@]}"; do
        tools_arg+="'${tool}' "
    done

    local roles=("liaison" "pdsa" "dev" "qa")
    for i in 0 1 2 3; do
        local role="${roles[$i]}"
        # AGENT_ROLE env var enables hook-based recovery after auto-compact
        tmux send-keys -t "${session}:0.${i}" \
            "AGENT_ROLE=${role} ${CLAUDE_BIN} --allowedTools ${tools_arg} --append-system-prompt \"\$(cat /tmp/claude-role-${role}.txt)\"" Enter
    done

    # Wait for Claude to be ready in each pane, handle trust prompts
    for i in 0 1 2 3; do
        echo "  Waiting for pane ${i} (${roles[$i]})..."
        wait_for_claude "${session}:0.${i}"
        handle_trust_prompt "${session}:0.${i}"
    done

    # Focus LIAISON pane
    tmux select-pane -t "${session}:0.0"

    echo "All 4 agents started."
}

create_dual_session() {
    local session="$1"

    # Create session with working directory (pane 0: ORCHESTRATOR)
    tmux new-session -d -s "$session" -c "$WORKING_DIR"

    # Split right (pane 1: PDSA+QA)
    tmux split-window -t "${session}:0.0" -h -c "$WORKING_DIR"

    # Split pane 1 vertically (pane 2: DEV — bottom-right)
    tmux split-window -t "${session}:0.1" -v -c "$WORKING_DIR"

    tmux rename-window -t "${session}:0" 'ORCHESTRATOR | PDSA+QA | DEV'

    # Start Claude in all 3 panes
    tmux send-keys -t "${session}:0.0" "$CLAUDE_BIN" Enter
    tmux send-keys -t "${session}:0.1" "$CLAUDE_BIN" Enter
    tmux send-keys -t "${session}:0.2" "$CLAUDE_BIN" Enter

    # Wait for Claude to be ready in each pane, handle trust prompts
    for pane in "${session}:0.0" "${session}:0.1" "${session}:0.2"; do
        wait_for_claude "$pane"
        handle_trust_prompt "$pane"
    done

    # Send role prompts
    tmux send-keys -t "${session}:0.0" \
        'You are the ORCHESTRATOR agent in a 3-agent tmux setup (claude-dual). Read ~/.claude/CLAUDE.md for protocols. Monitor PDSA+QA (pane 1) and DEV (pane 2) agents. Confirm prompts, detect stuck, enforce protocols. Relay tasks between agents.' Enter

    tmux send-keys -t "${session}:0.1" \
        'You are the PDSA+QA agent in a 3-agent tmux setup (claude-dual). Read ~/.claude/CLAUDE.md for protocols. You plan tasks using PDSA methodology, research approaches, write PDSA docs, review results against specifications, AND write/run tests. DEV (pane 2) implements. You NEVER implement code — you plan and verify.' Enter

    tmux send-keys -t "${session}:0.2" \
        'You are the DEVELOPMENT agent in a 3-agent tmux setup (claude-dual). Read ~/.claude/CLAUDE.md for protocols (especially git protocol: specific file staging, atomic commands, immediate push). You implement code assigned by the PDSA agent. The PDSA+QA agent (pane 1) tests your work. The orchestrator (pane 0) relays tasks. Stand by and confirm: Dev agent ready.' Enter

    # Focus orchestrator pane
    tmux select-pane -t "${session}:0.0"
}

create_single_session() {
    local session="$1"

    # Auto-deploy skills + hooks before launching agents
    sync_skills
    sync_settings

    tmux new-session -d -s "$session" -c "$WORKING_DIR"
    tmux send-keys -t "${session}:0.0" "$CLAUDE_BIN" Enter
}

run_remote() {
    local session="$1"
    local ssh_key="${HOME}/.ssh/hetzner-dev"

    # Auto-provision SSH key if found next to script (Synology NAS layout)
    if [[ ! -f "$ssh_key" ]]; then
        local script_dir
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [[ -f "${script_dir}/hetzner-dev" ]]; then
            echo "Setting up SSH key..."
            mkdir -p ~/.ssh
            cp "${script_dir}/hetzner-dev" "$ssh_key"
            chmod 600 "$ssh_key"
        else
            echo "ERROR: SSH key not found at ${ssh_key}"
            echo "Copy the hetzner-dev key to ~/.ssh/hetzner-dev"
            exit 1
        fi
    fi

    exec ssh -t -i "$ssh_key" -o StrictHostKeyChecking=accept-new \
        "${HETZNER_USER}@${HETZNER_VPN_IP}" \
        "$SELF_PATH" "$session"
}

# --- Main ---

[[ $# -lt 1 ]] && usage

session="$1"

# Validate session name (tmux allows alphanumeric, dash, underscore, dot)
if [[ ! "$session" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "ERROR: Invalid session name '${session}'"
    echo "Use only letters, numbers, dashes, underscores, and dots."
    exit 1
fi

run_local_or_hetzner() {
    # On Hetzner: auto-switch to developer user if needed
    if is_on_hetzner && [[ "$(whoami)" != "developer" ]]; then
        COLS=$(tput cols 2>/dev/null || echo 200)
        ROWS=$(tput lines 2>/dev/null || echo 50)
        echo "Switching to developer user (${COLS}x${ROWS})..."
        exec sudo -i -u developer env TMUX_COLS="$COLS" TMUX_ROWS="$ROWS" bash "$SELF_PATH" "$session"
    fi

    # Unset TMUX to allow running from inside an existing tmux session
    unset TMUX

    if tmux has-session -t "$session" 2>/dev/null; then
        exec tmux attach -t "$session"
    fi

    case "$session" in
        claude-agents) create_agents_session "$session" ;;
        claude-dual)   create_dual_session "$session" ;;
        *)             create_single_session "$session" ;;
    esac

    exec tmux attach -t "$session"
}

case "$RUN_MODE" in
    hetzner|local)
        run_local_or_hetzner
        ;;
    remote)
        run_remote "$session"
        ;;
esac
