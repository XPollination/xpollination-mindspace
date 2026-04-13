#!/bin/bash
#===============================================================================
# claude-session.sh — Claude tmux session launcher
#
# Single source of truth for creating/attaching Claude tmux sessions.
# Works from any working directory. Auto-detects environment:
#   - Hetzner (any user)    → runs tmux directly (auto-switches to developer)
#   - Remote (e.g. Synology)→ SSHes to Hetzner via VPN
#
# Zero-knowledge: the command name determines the environment.
# No flags needed. Symlink names:
#   claude-session-beta  → connects to Beta Hive (:3101)
#   claude-session-prod  → connects to Prod Hive (:3100)
#   claude-session       → defaults to beta
#
# Usage:
#   claude-session-beta a2a-team      # 4-pane team on Beta
#   claude-session-prod a2a-team      # 4-pane team on Prod
#   claude-session-beta liaison       # Single-pane liaison on Beta
#   claude-session-prod dev           # Single-pane dev on Prod
#
# Install (creates symlinks):
#   npm run install:sessions
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

# --- Environment from script name (zero-knowledge) ---
# claude-session-beta → beta, claude-session-prod → prod, claude-session → beta
# XPO_ENV may already be set from sudo re-exec (preserves through user switch)
if [[ -z "${XPO_ENV:-}" ]]; then
    _SCRIPT_NAME="$(basename "$0")"
    case "$_SCRIPT_NAME" in
        claude-session-prod|claude-session-prod.sh) XPO_ENV="prod" ;;
        *)                                          XPO_ENV="beta" ;;
    esac
fi
readonly XPO_ENV

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
  Environment determined by command name:
    claude-session-beta → Beta Hive (:3101)
    claude-session-prod → Prod Hive (:3100)
  Set this BEFORE running claude-session.
EOF
    exit 1
}

is_on_hetzner() {
    [[ "$RUN_MODE" == "hetzner" ]]
}

# --- Device Key Authentication ---
# Ed25519 persistent device keys. Register once, connect forever.
# See: docs/missions/mission-agent-oauth-sessions.md v2.1

# --- Bootstrap URL mapping (only used for first-time registration) ---
# Once a key is registered, the URL lives in the key file. This mapping
# is the ONLY place environment-specific URLs appear.
env_to_bootstrap_url() {
    case "$1" in
        prod) echo "http://localhost:3100" ;;
        *)    echo "http://localhost:3101" ;;
    esac
}

check_device_key() {
    # Uses XPO_ENV (from script name) for key filename
    local node_cmd="${NVM_NODE:+${NVM_NODE}/node}"
    node_cmd="${node_cmd:-node}"
    local key_file="${HETZNER_HOME}/.xp0/keys/${XPO_ENV}.json"

    if [[ -f "$key_file" ]]; then
        local key_id api_base
        key_id=$($node_cmd -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf-8')).key_id)}catch{}" "$key_file" 2>/dev/null)
        api_base=$($node_cmd -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf-8')).server)}catch{}" "$key_file" 2>/dev/null)
        if [[ -n "$key_id" && -n "$api_base" ]]; then
            # Validate key is not revoked — send key_id to server, expect CHALLENGE
            local check_res
            check_res=$(curl -s -X POST "${api_base}/a2a/connect" \
                -H "Content-Type: application/json" \
                -d "{\"identity\":{\"agent_name\":\"key-check\",\"key_id\":\"${key_id}\"},\"role\":{\"current\":\"liaison\"},\"project\":{\"slug\":\"xpollination-mindspace\"},\"state\":{\"status\":\"active\"},\"metadata\":{\"client\":\"key-check\"}}" 2>/dev/null)
            local check_type
            check_type=$($node_cmd -e "try{console.log(JSON.parse(process.argv[1]).type||'')}catch{console.log('')}" "$check_res" 2>/dev/null)

            if [[ "$check_type" == "CHALLENGE" ]]; then
                XPO_KEY_FILE="$key_file"
                echo "  Device key: ${key_id} (${XPO_ENV}, valid)"
                return 0
            else
                echo "  Device key ${key_id} revoked or invalid. Re-registering..."
                mv "$key_file" "${key_file}.revoked" 2>/dev/null
                return 1
            fi
        fi
    fi
    return 1
}

register_device_key() {
    local api_base="$1"
    local jwt_token="$2"
    local node_cmd="${NVM_NODE:+${NVM_NODE}/node}"
    node_cmd="${node_cmd:-node}"
    local register_script="${PROJECT_ROOT}/scripts/device-key-register.js"

    $node_cmd "$register_script" --api "$api_base" --token "$jwt_token" --env "$XPO_ENV"
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        XPO_KEY_FILE="${HETZNER_HOME}/.xp0/keys/${XPO_ENV}.json"
        return 0
    fi
    return 1
}

authenticate_or_load_key() {
    local session_name="$1"
    local api_base
    api_base="$(env_to_bootstrap_url "$XPO_ENV")"

    # 1. Check for existing device key
    if check_device_key; then
        return 0
    fi

    # 2. No key — run device flow to get bootstrap JWT
    if authenticate_device_flow "$api_base" "$session_name"; then
        # 3. Register device key using the JWT
        if register_device_key "$api_base" "$XPO_SESSION_TOKEN"; then
            echo "  Device key registered (${XPO_ENV})."
            return 0
        fi
        echo "  WARNING: Key registration failed."
        return 1
    fi
    return 1
}

# --- Device Flow (bootstrap for first-time registration) ---

authenticate_device_flow() {
    local api_base="$1"
    local session_name="$2"
    local node_cmd="${NVM_NODE:+${NVM_NODE}/node}"
    node_cmd="${node_cmd:-node}"

    echo ""
    echo "Authenticating with Mindspace..."

    # Request device code
    local response
    response=$(curl -s -X POST "${api_base}/api/auth/device/code" \
        -H "Content-Type: application/json" \
        -d "{\"client_name\":\"claude-session ${session_name}\"}" 2>/dev/null)

    local device_code user_code verification_uri_complete
    device_code=$($node_cmd -e "try{console.log(JSON.parse(process.argv[1]).device_code)}catch{}" "$response" 2>/dev/null)
    user_code=$($node_cmd -e "try{console.log(JSON.parse(process.argv[1]).user_code)}catch{}" "$response" 2>/dev/null)
    verification_uri_complete=$($node_cmd -e "try{console.log(JSON.parse(process.argv[1]).verification_uri_complete)}catch{}" "$response" 2>/dev/null)

    if [[ -z "$device_code" || -z "$user_code" ]]; then
        echo "ERROR: Could not get device code from ${api_base}"
        echo "Response: ${response}"
        echo ""
        echo "Falling back to API key from .env..."
        return 1
    fi

    echo ""
    echo "  Approve: ${verification_uri_complete}"
    echo ""
    echo "Waiting for approval..."

    # Poll for approval (5s interval, 15min timeout)
    local attempts=0
    local max_attempts=180  # 15 min / 5s
    while [ $attempts -lt $max_attempts ]; do
        sleep 5
        local token_response
        token_response=$(curl -s -X POST "${api_base}/api/auth/device/token" \
            -H "Content-Type: application/json" \
            -d "{\"device_code\":\"${device_code}\"}" 2>/dev/null)

        local token error
        token=$($node_cmd -e "try{const d=JSON.parse(process.argv[1]);if(d.access_token)console.log(d.access_token)}catch{}" "$token_response" 2>/dev/null)
        error=$($node_cmd -e "try{console.log(JSON.parse(process.argv[1]).error||'')}catch{}" "$token_response" 2>/dev/null)

        if [[ -n "$token" ]]; then
            echo "✓ Authenticated"
            XPO_SESSION_TOKEN="$token"
            return 0
        fi

        if [[ "$error" == "expired_token" ]]; then
            echo "✗ Code expired. Run claude-session again."
            return 1
        fi

        # authorization_pending → keep polling
        attempts=$((attempts + 1))
    done

    echo "✗ Timed out waiting for approval"
    return 1
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

    local workspace="${WORKING_DIR}/xpollination-mindspace"
    local agent_script="${PROJECT_ROOT}/src/a2a/xpo-agent.js"
    local node_bin="${NVM_NODE:+${NVM_NODE}/node}"
    node_bin="${node_bin:-node}"

    # Authenticate: load existing key or bootstrap via device flow
    local XPO_KEY_FILE=""
    local XPO_SESSION_TOKEN=""
    if ! authenticate_or_load_key "$session"; then
        echo "ERROR: Authentication failed for ${XPO_ENV}. Cannot start agents."
        exit 1
    fi
    local key_file="$XPO_KEY_FILE"
    echo "Environment: ${XPO_ENV} (key: ${key_file})"

    # Write self-describing role prompts — no URLs, no scripts, no protocol details
    # The body sends [AVAILABLE] and [SUMMARY] messages with response options embedded.
    # The LLM learns the protocol from the messages themselves.
    local roles=("liaison" "pdsa" "dev" "qa")
    for role in "${roles[@]}"; do
        cat > "/tmp/claude-role-${role}.txt" << ROLE
You are the ${role^^} agent in a 4-agent tmux session (a2a-team).
Panes: 0=LIAISON, 1=PDSA, 2=DEV, 3=QA.
Project: xpollination-mindspace

ARCHITECTURE:
- A2A body runs in background (xpo-agent.js) — handles auth, events, brain, delivery
- You receive [AVAILABLE] task offers and [SUMMARY] requests with response options
- The body handles ALL server communication — you just do the work and respond to markers
- Body status: cat /tmp/xpo-agent-${role}.status

RULES:
- Do NOT run a2a-deliver.cjs or interface-cli.js — the body handles delivery
- Do NOT use curl to call API endpoints — the body handles all A2A
- Do NOT query brain directly — the body provides brain context and captures your learnings
- Your role definition is in CLAUDE.md (auto-loaded)
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

        # Start xpo-agent body in background — device key determines which Hive to connect to
        # Body reads server URL from key file (no --api needed), handles all A2A protocol
        local body_cmd="nohup ${node_bin} ${agent_script} --role ${role} --project xpollination-mindspace --workspace ${workspace} --interactive --session ${pane} --key ${key_file} > /tmp/xpo-agent-${role}.log 2>&1 &"
        tmux send-keys -t "${pane}" "$body_cmd" Enter

        # Write Claude launch script (--allowedTools list too long for send-keys)
        # Use exec so bash is replaced by claude — tmux pane_current_command will show 'claude'
        local launch_script="/tmp/claude-launch-${role}.sh"
        {
            echo "#!/bin/bash"
            echo "cd \"${workspace}\""
            echo "export AGENT_ROLE=${role}"
            printf 'exec %s --allowedTools' "${CLAUDE_BIN}"
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

    local workspace="${WORKING_DIR}/xpollination-mindspace"
    local agent_script="${PROJECT_ROOT}/src/a2a/xpo-agent.js"

    if [[ ! -f "$agent_script" ]]; then
        echo "ERROR: xpo-agent.js not found at ${agent_script}"
        exit 1
    fi

    # Authenticate: load existing key or bootstrap via device flow
    local XPO_KEY_FILE=""
    local XPO_SESSION_TOKEN=""
    if ! authenticate_or_load_key "$session"; then
        echo "ERROR: Authentication failed for ${XPO_ENV}. Cannot start agent."
        exit 1
    fi
    local key_file="$XPO_KEY_FILE"

    echo "Starting A2A agent body: ${role} (env: ${XPO_ENV})"
    echo "  Key:       ${key_file}"
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

        # Start body in background — device key determines which Hive
        local body_cmd="nohup ${node_bin} ${agent_script} --role ${role} --project xpollination-mindspace --workspace ${workspace} --interactive --session ${session} --key ${key_file} > /tmp/xpo-agent-${role}.log 2>&1 &"
        tmux send-keys -t "${session}:0.0" "$body_cmd" Enter

        # Small delay for body to connect, then launch Claude
        tmux send-keys -t "${session}:0.0" "sleep 2" Enter

        # Launch Claude with self-describing role prompt
        local launch_script="/tmp/claude-launch-${role}-a2a.sh"
        {
            echo "#!/bin/bash"
            echo "cd \"${workspace}\""
            echo "export AGENT_ROLE=${role}"
            printf 'exec %s --allowedTools' "${CLAUDE_BIN}"
            for tool in "${ALLOWED_TOOLS[@]}"; do
                printf ' %q' "$tool"
            done
            printf ' --append-system-prompt "$(cat /tmp/claude-role-%s.txt)"\n' "$role"
        } > "$launch_script"
        chmod +x "$launch_script"

        tmux send-keys -t "${session}:0.0" "bash ${launch_script}" Enter
    else
        # Standard mode: xpo-agent runs as foreground, creates nested tmux for LLM.
        local launch_cmd="${node_bin} ${agent_script} --role ${role} --project xpollination-mindspace --workspace ${workspace} --key ${key_file}"

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
        exec sudo -i -u developer env TMUX_COLS="$COLS" TMUX_ROWS="$ROWS" XPO_ENV="$XPO_ENV" bash "$SELF_PATH" "$session"
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
