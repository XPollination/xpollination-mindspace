#!/bin/bash
#===============================================================================
# claude-maria.sh — Launcher for Claude Code as user `maria` on office-xp0
#
# SSHes into office-xp0 regardless of invoker, then sudo-wraps to maria and
# starts a tmux session running `claude` with the Sina↔Maria skill preloaded.
#
# Usage:
#   claude-maria              Attach (or create) tmux session on office-xp0
#   claude-maria --kill       Kill the remote tmux session
#   claude-maria --status     Show whether the remote session exists
#
# Permission model:
#   - Launches claude with --dangerously-skip-permissions. This is safe because
#     maria is a sandboxed agent-user (passwd-locked, no sudo, bridge-only
#     access via `xpo-agent ALL=(maria) NOPASSWD: ALL`). The flag replaces the
#     legacy claude-unblock sidecar monitor (overengineering — see brain
#     lesson 2026-04-23).
#
# Autostart:
#   - The tmux session starts claude with /xpo.sina.maria as the initial
#     prompt, so maria's Sina-loop begins on first attach.
#===============================================================================
set -euo pipefail

export TERM="${TERM:-xterm-256color}"

SESSION=sini-maria
REMOTE_HOST=178.104.208.66
REMOTE_USER=xpo-agent
REMOTE_KEY=/home/developer/.ssh/id_ed25519_xp0_newserver
SKILL=/xpo.sina.maria

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
        exec "${SSH[@]}" "sudo -iu maria tmux kill-session -t $SESSION"
        ;;
    --status)
        exec "${SSH[@]}" "sudo -iu maria tmux has-session -t $SESSION"
        ;;
esac

ENSURE_CONF='grep -q "set -g mouse on" ~/.tmux.conf 2>/dev/null || echo "set -g mouse on" >> ~/.tmux.conf'
REMOTE_CMD="sudo -iu maria bash -c '$ENSURE_CONF; tmux new-session -A -s $SESSION claude --dangerously-skip-permissions $SKILL'"

if [[ "$(id -un)" == "developer" ]]; then
    exec ssh -t -i "$REMOTE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
        -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
else
    exec sudo -u developer env "TERM=$TERM" ssh -t -i "$REMOTE_KEY" \
        -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
        -o SendEnv=TERM "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
fi
