#!/bin/bash
#===============================================================================
# claude-bible.sh — Launcher for Claude Code as user `thomas` on office-xp0
#
# SSHes into office-xp0 regardless of invoker, then sudo-wraps to thomas and
# starts a tmux session running `claude` with the Bible-Reflection skill
# preloaded. The skill reads one chapter of Schlachter-1951 per loop and
# contributes a 5-section reflection to brain (space=public, topic=
# bible-reflection).
#
# Usage:
#   claude-bible             Attach (or create) tmux session on office-xp0
#   claude-bible --kill      Kill the remote tmux session
#   claude-bible --status    Show whether the remote session exists
#
# Permission model:
#   - Launches claude with --dangerously-skip-permissions. Safe because thomas
#     is a sandboxed agent-user on office-xp0 (passwd-locked, no sudo, bridge-
#     only access via `xpo-agent ALL=(thomas) NOPASSWD: ALL`). Flag replaces
#     the legacy claude-unblock sidecar monitor — see brain lesson 2026-04-23.
#
# Autostart:
#   - The tmux session starts claude with /xpo.bible.reflect as the initial
#     prompt, so the Bible-Reflection loop begins on first attach.
#===============================================================================
set -euo pipefail

export TERM="${TERM:-xterm-256color}"

SESSION=sini-bible
REMOTE_HOST=178.104.208.66
REMOTE_USER=xpo-agent
REMOTE_KEY=/home/developer/.ssh/id_ed25519_xp0_newserver
SKILL=/xpo.bible.reflect

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
