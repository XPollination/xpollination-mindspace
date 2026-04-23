#!/bin/bash
#===============================================================================
# claude-sina-thomas.sh — Launcher for the /xpo.sina liaison agent running
# under the `thomas` sandboxed user on office-xp0.
#
# Rationale: thomas user on office-xp0 already has Claude Code authenticated
# (claude-bible runs there). Starting a second tmux session under thomas for
# /xpo.sina reuses the existing auth — no second registration — and gives
# Thomas two logical agents (Bible-reflection + Sina-liaison) in the same
# Linux user.
#
# Channel scope for this instance (via /home/thomas/.config/brain/standby-
# state.json):
#   - Sina↔Thomas (private, 1:1)
#   - xp0.ai (protected)
#   - Maria & Thomas (private, topic=familie_pichler)
# Robin-1:1 / Maria-1:1 / xp0-travel are NOT polled here.
#
# Usage:
#   claude-sina-thomas              Attach (or create) tmux session
#   claude-sina-thomas --kill       Kill the remote session
#   claude-sina-thomas --status     Show whether the session exists
#===============================================================================
set -euo pipefail

export TERM="${TERM:-xterm-256color}"

SESSION=sini-sina-thomas
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
        exec "${SSH[@]}" "sudo -iu thomas tmux kill-session -t $SESSION"
        ;;
    --status)
        exec "${SSH[@]}" "sudo -iu thomas tmux has-session -t $SESSION"
        ;;
esac

ENSURE_CONF='grep -q "set -g mouse on" ~/.tmux.conf 2>/dev/null || echo "set -g mouse on" >> ~/.tmux.conf'
REMOTE_CMD="sudo -iu thomas bash -c '$ENSURE_CONF; tmux new-session -A -s $SESSION claude --dangerously-skip-permissions $SKILL'"

if [[ "$(id -un)" == "developer" ]]; then
    exec ssh -t -i "$REMOTE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
        -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
else
    exec sudo -u developer env "TERM=$TERM" ssh -t -i "$REMOTE_KEY" \
        -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
        -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
fi
