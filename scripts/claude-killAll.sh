#!/bin/bash
#===============================================================================
# claude-killAll.sh — Kill every tmux session that runs a Claude Code agent
# across all xp0 hosts and users. After this, Thomas can manually restart
# sessions via claude-session / claude-maria / claude-bible.
#
# Usage:
#   claude-killAll              Kill all claude tmux sessions on all hosts
#   claude-killAll --list       List sessions only, do not kill
#
# Heuristic:
#   A tmux session is considered a claude session if any of its panes has
#   `claude` in pane_current_command.
#===============================================================================
set -euo pipefail

LIST_ONLY=0
if [[ "${1:-}" == "--list" ]]; then
    LIST_ONLY=1
fi

OFFICE_HOST=178.104.208.66
OFFICE_USER=xpo-agent
OFFICE_KEY=/home/developer/.ssh/id_ed25519_xp0_newserver

# Key belongs to developer; wrap SSH via sudo when invoker is not developer.
if [[ "$(id -un)" == "developer" ]]; then
    SSH_WRAP=(ssh)
else
    SSH_WRAP=(sudo -u developer env "TERM=${TERM:-xterm-256color}" ssh)
fi

DEV_USERS=(developer)
OFFICE_USERS=(xpo-agent maria thomas sina)

# Remote-safe: prints tmux sessions running claude for a single user, and
# optionally kills them. Designed to be embedded into a remote SSH command.
_user_session_handler='
user="$1"
list_only="$2"
# If we already are "user", skip sudo — saves sudoers hassle.
if [[ "$(id -un)" == "$user" ]]; then
    RUN=""
else
    RUN="sudo -iu $user"
fi
sessions=$($RUN tmux list-sessions -F "#S" 2>/dev/null || true)
if [[ -z "$sessions" ]]; then
    echo "  [$user] no tmux sessions"
    exit 0
fi
for s in $sessions; do
    panes=$($RUN tmux list-panes -t "$s" -F "#{pane_current_command}" 2>/dev/null || true)
    if echo "$panes" | grep -q claude; then
        if [[ "$list_only" == "1" ]]; then
            echo "  [$user] claude session: $s (panes: $panes)"
        else
            echo "  [$user] killing claude session: $s"
            $RUN tmux kill-session -t "$s" 2>&1
        fi
    fi
done
'

run_local_user() {
    local user="$1"
    bash -c "$_user_session_handler" _ "$user" "$LIST_ONLY"
}

run_remote_user() {
    local user="$1"
    "${SSH_WRAP[@]}" -i "$OFFICE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
        "${OFFICE_USER}@${OFFICE_HOST}" \
        "bash -c \$'$_user_session_handler' _ '$user' '$LIST_ONLY'"
}

echo "========================================"
echo "HOST: hetzner-cx22 (local)"
echo "========================================"
for user in "${DEV_USERS[@]}"; do
    run_local_user "$user"
done

echo ""
echo "========================================"
echo "HOST: office-xp0"
echo "========================================"
for user in "${OFFICE_USERS[@]}"; do
    run_remote_user "$user"
done

echo ""
if [[ "$LIST_ONLY" -eq 1 ]]; then
    echo "Listed only. Run without --list to kill."
else
    echo "Done. Restart sessions manually via claude-session / claude-maria / claude-bible."
fi
