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
  claude-agents    4-pane layout (Liaison + PDSA + Dev + QA) [WORKFLOW.md v12]
  claude-dual      3-pane layout (Orchestrator + PDSA+QA + Dev) [legacy]
  agent-<role>     A2A agent body — connects to A2A, launches Claude with role
                   Roles: agent-liaison, agent-pdsa, agent-dev, agent-qa
  <any-name>       Single-pane Claude session

The session is created if it doesn't exist, or attached if it does.
Can be run as thomas — auto-switches to developer via sudo.

A2A server:
  Default: http://localhost:3101 (BETA / mindspace-test container)
  To use PROD: export MINDSPACE_API_URL=http://10.33.33.1:3100
  Set this BEFORE running claude-session.
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
        # Match "claude" (direct) or "bash" (via launch script wrapper)
        if [ "$cmd" = "claude" ] || [ "$cmd" = "bash" ]; then
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

    local api_url="${MINDSPACE_API_URL:-http://localhost:3101}"
    local workspace="${WORKING_DIR}/xpollination-mindspace"
    local agent_script="${PROJECT_ROOT}/src/a2a/xpo-agent.js"
    local deliver_script="${PROJECT_ROOT}/scripts/a2a-deliver.js"
    local node_bin="${NVM_NODE:+${NVM_NODE}/node}"
    node_bin="${node_bin:-node}"

    # Resolve BRAIN_API_KEY
    local brain_key="${BRAIN_API_KEY:-}"
    if [[ -z "$brain_key" && -f "${HETZNER_HOME}/.brain-api-key" ]]; then
        brain_key="$(cat "${HETZNER_HOME}/.brain-api-key" 2>/dev/null || echo "")"
    fi
    if [[ -z "$brain_key" && -f "${PROJECT_ROOT}/.env" ]]; then
        brain_key="$(grep '^BRAIN_API_KEY=' "${PROJECT_ROOT}/.env" 2>/dev/null | cut -d= -f2 || echo "")"
    fi

    # Write A2A-aware role prompts — no API key exposed to the soul
    local roles=("liaison" "pdsa" "dev" "qa")
    for role in "${roles[@]}"; do
        cat > "/tmp/claude-role-${role}.txt" << ROLE
You are the ${role^^} agent connected to A2A in a 4-agent tmux session (claude-agents).
Panes: 0=LIAISON, 1=PDSA, 2=DEV, 3=QA.
Project: xpollination-mindspace

The A2A body runs in background and delivers [TASK] messages via SSE.
To deliver results:
  node ${deliver_script} --slug <SLUG> --transition <STATUS> --role ${role}

Do NOT use curl to call A2A endpoints directly. All A2A communication goes through a2a-deliver.js.
ROLE
    done

    # Determine terminal dimensions
    local cols="${TMUX_COLS:-$(tput cols 2>/dev/null || echo 200)}"
    local rows="${TMUX_ROWS:-$(tput lines 2>/dev/null || echo 50)}"

    # Create session with explicit size (pane 0: LIAISON)
    tmux new-session -d -s "$session" -x "$cols" -y "$rows" -c "$workspace"

    # Pre-configure PATH
    if [[ -n "$NVM_NODE" ]]; then
        tmux set-environment -t "$session" PATH "${NVM_NODE}:/usr/local/bin:/usr/bin:/bin"
    fi
    if [ -n "$brain_key" ]; then
        tmux set-environment -t "$session" BRAIN_API_KEY "$brain_key"
    fi

    # Split into 4 panes: LIAISON | PDSA | DEV / QA
    tmux split-window -t "${session}:0.0" -h -l 66% -c "$workspace"
    tmux split-window -t "${session}:0.1" -h -l 50% -c "$workspace"
    tmux split-window -t "${session}:0.2" -v -c "$workspace"

    tmux rename-window -t "${session}:0" 'LIAISON | PDSA | DEV | QA'

    # Enable mouse support (scroll, click, resize)
    tmux set-option -t "$session" mouse on

    # Pane border labels
    tmux set-option -t "$session" pane-border-status top
    tmux set-option -t "$session" pane-border-format \
        ' #{?#{==:#{pane_index},0},LIAISON,#{?#{==:#{pane_index},1},PDSA,#{?#{==:#{pane_index},2},DEV,QA}}} │ #{pane_title} '

    echo "Starting 4 A2A agents (body in background, Claude in foreground)..."

    # For each pane: start A2A body in background, then launch Claude
    for i in 0 1 2 3; do
        local role="${roles[$i]}"
        local pane="${session}:0.${i}"

        # Start xpo-agent body in background — delivers SSE events to this pane
        # Body waits for LLM ready before sending brain recovery prompts
        local body_cmd="BRAIN_API_KEY=${brain_key} nohup ${node_bin} ${agent_script} --role ${role} --project xpollination-mindspace --api ${api_url} --workspace ${workspace} --interactive --session ${pane} > /tmp/xpo-agent-${role}.log 2>&1 &"
        tmux send-keys -t "${pane}" "$body_cmd" Enter

        # Write Claude launch script (--allowedTools list too long for send-keys)
        local launch_script="/tmp/claude-launch-${role}.sh"
        {
            echo "#!/bin/bash"
            echo "cd \"${workspace}\""
            echo "export AGENT_ROLE=${role}"
            printf '%s --allowedTools' "${CLAUDE_BIN}"
            for tool in "${ALLOWED_TOOLS[@]}"; do
                printf ' %q' "$tool"
            done
            printf ' --append-system-prompt "$(cat /tmp/claude-role-%s.txt)"\n' "$role"
        } > "$launch_script"
        chmod +x "$launch_script"

        # Launch Claude — body detects it via pane_current_command and starts brain recovery
        tmux send-keys -t "${pane}" "bash ${launch_script}" Enter
    done

    # Wait for Claude to be ready in each pane, handle trust prompts
    for i in 0 1 2 3; do
        echo "  Waiting for pane ${i} (${roles[$i]})..."
        wait_for_claude "${session}:0.${i}"
        handle_trust_prompt "${session}:0.${i}"
    done

    # Focus LIAISON pane
    tmux select-pane -t "${session}:0.0"

    echo "All 4 agents started. A2A bodies running in background."
    echo "Body logs: /tmp/xpo-agent-{liaison,pdsa,dev,qa}.log"
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

create_agent_body_session() {
    local session="$1"
    local role="$2"

    # Auto-deploy skills + hooks
    sync_skills
    sync_settings

    local api_url="${MINDSPACE_API_URL:-http://localhost:3101}"
    local workspace="${WORKING_DIR}/xpollination-mindspace"
    local agent_script="${PROJECT_ROOT}/src/a2a/xpo-agent.js"

    if [[ ! -f "$agent_script" ]]; then
        echo "ERROR: xpo-agent.js not found at ${agent_script}"
        exit 1
    fi

    # Resolve BRAIN_API_KEY
    local brain_key="${BRAIN_API_KEY:-}"
    if [[ -z "$brain_key" && -f "${HETZNER_HOME}/.brain-api-key" ]]; then
        brain_key="$(cat "${HETZNER_HOME}/.brain-api-key" 2>/dev/null || echo "")"
    fi
    if [[ -z "$brain_key" && -f "${PROJECT_ROOT}/.env" ]]; then
        brain_key="$(grep '^BRAIN_API_KEY=' "${PROJECT_ROOT}/.env" 2>/dev/null | cut -d= -f2 || echo "")"
    fi

    echo "Starting A2A agent body: ${role}"
    echo "  API:       ${api_url}"
    echo "  Workspace: ${workspace}"
    echo "  Script:    ${agent_script}"

    local node_bin="${NVM_NODE:+${NVM_NODE}/node}"
    node_bin="${node_bin:-node}"

    if [[ "$role" == "liaison" ]]; then
        # LIAISON mode: Claude runs in the pane (interactive), body runs in background.
        # Thomas types directly to Claude. SSE events arrive as [TASK] messages.
        tmux new-session -d -s "$session" -c "$workspace"

        if [[ -n "$NVM_NODE" ]]; then
            tmux set-environment -t "$session" PATH "${NVM_NODE}:/usr/local/bin:/usr/bin:/bin"
        fi

        # Start body in background — delivers events to this session
        local body_cmd="BRAIN_API_KEY=${brain_key} nohup ${node_bin} ${agent_script} --role ${role} --project xpollination-mindspace --api ${api_url} --workspace ${workspace} --interactive --session ${session} > /tmp/xpo-agent-${role}.log 2>&1 &"
        tmux send-keys -t "${session}:0.0" "$body_cmd" Enter

        # Small delay for body to connect, then launch Claude
        tmux send-keys -t "${session}:0.0" "sleep 2" Enter

        # Launch Claude with A2A system prompt
        local launch_script="/tmp/claude-launch-${role}-a2a.sh"
        {
            echo "#!/bin/bash"
            echo "cd \"${workspace}\""
            echo "export AGENT_ROLE=${role}"
            printf '%s --allowedTools' "${CLAUDE_BIN}"
            for tool in "${ALLOWED_TOOLS[@]}"; do
                printf ' %q' "$tool"
            done
            printf ' --append-system-prompt "$(cat /tmp/claude-role-%s-a2a.txt)"\n' "$role"
        } > "$launch_script"
        chmod +x "$launch_script"

        # Write A2A-aware role prompt — no API key exposed to the soul
        cat > "/tmp/claude-role-${role}-a2a.txt" << ROLE
You are the LIAISON agent connected to A2A.
Session: ${session} | Project: xpollination-mindspace

The A2A body runs in background and delivers [TASK] messages to you via SSE events.
You are also Thomas's interactive interface — respond to his direct questions.

When you receive a [TASK], process it. To deliver results:
  node ${agent_script%/src/a2a/xpo-agent.js}/scripts/a2a-deliver.js --slug <SLUG> --transition <STATUS> --role liaison

Do NOT use curl to call A2A endpoints directly. All A2A communication goes through a2a-deliver.js.
ROLE

        tmux send-keys -t "${session}:0.0" "bash ${launch_script}" Enter
    else
        # Standard mode: xpo-agent runs as foreground, creates nested tmux for LLM.
        local launch_cmd="BRAIN_API_KEY=${brain_key} ${node_bin} ${agent_script} --role ${role} --project xpollination-mindspace --api ${api_url} --workspace ${workspace}"

        tmux new-session -d -s "$session" -c "$workspace"

        if [[ -n "$NVM_NODE" ]]; then
            tmux set-environment -t "$session" PATH "${NVM_NODE}:/usr/local/bin:/usr/bin:/bin"
        fi

        tmux send-keys -t "${session}:0.0" "$launch_cmd" Enter
    fi

    # Enable mouse (scroll support)
    tmux set-option -t "$session" mouse on

    echo "Agent body started. Attaching to session..."
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
        claude-agents|a2a-team) create_agents_session "$session" ;;
        claude-dual)   create_dual_session "$session" ;;
        agent-*)
            # A2A Agent Body — single role agent connected to A2A
            # Usage: claude-session agent-pdsa | agent-dev | agent-qa | agent-liaison
            local role="${session#agent-}"
            if [[ ! "$role" =~ ^(liaison|pdsa|dev|qa)$ ]]; then
                echo "ERROR: Invalid agent role '${role}'"
                echo "Use: agent-liaison, agent-pdsa, agent-dev, agent-qa"
                exit 1
            fi
            create_agent_body_session "$session" "$role"
            ;;
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
