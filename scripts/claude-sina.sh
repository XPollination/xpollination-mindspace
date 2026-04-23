#!/bin/bash
#===============================================================================
# claude-sina.sh — Launcher for Claude Code as user `sina` on office-xp0.
#
# Starts a tmux session on office-xp0 under the sandboxed `sina` user with
# the /xpo.sina skill preloaded. The skill watches only the 3 channels that
# make sense for a liaison-agent living on the office-xp0 box:
#   - Sina↔Thomas (private, 1:1)
#   - xp0.ai group (protected)
#   - Maria & Thomas group (private, topic=familie_pichler)
#
# Robin-1:1 and Maria-1:1 are intentionally NOT in sina's state.json; those
# run in dedicated agents (liaison-on-dev for Robin, /xpo.sina.maria under
# the maria user). xp0-travel is also excluded — small channel, not worth
# polling from this instance.
#
# Usage:
#   claude-sina              Attach (or create) tmux session on office-xp0
#   claude-sina --kill       Kill the remote tmux session
#   claude-sina --status     Show whether the remote session exists
#===============================================================================
set -euo pipefail

export TERM="${TERM:-xterm-256color}"

SESSION=sini-sina
REMOTE_HOST=178.104.208.66
REMOTE_USER=xpo-agent
REMOTE_KEY=/home/developer/.ssh/id_ed25519_xp0_newserver
SKILL=/xpo.sina

if [[ "$(id -un)" == "developer" ]]; then
    SSH=(ssh -i "$REMOTE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes
         -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}")
else
    SSH=(sudo -u developer env "TERM=$TERM" ssh -i "$REMOTE_KEY"
         -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes
         -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}")
fi

case "${1:-}" in
    --kill)
        exec "${SSH[@]}" "sudo -iu sina tmux kill-session -t $SESSION"
        ;;
    --status)
        exec "${SSH[@]}" "sudo -iu sina tmux has-session -t $SESSION"
        ;;
esac

ENSURE_CONF='grep -q "set -g mouse on" ~/.tmux.conf 2>/dev/null || echo "set -g mouse on" >> ~/.tmux.conf'
REMOTE_CMD="sudo -iu sina bash -c '$ENSURE_CONF; tmux new-session -A -s $SESSION claude --dangerously-skip-permissions $SKILL'"

if [[ "$(id -un)" == "developer" ]]; then
    exec ssh -t -i "$REMOTE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
        -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
else
    exec sudo -u developer env "TERM=$TERM" ssh -t -i "$REMOTE_KEY" \
        -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
        -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
fi
