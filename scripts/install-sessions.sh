#!/bin/bash
# Install claude-session-beta and claude-session-prod symlinks into /usr/local/bin
# Requires root (run via: sudo bash scripts/install-sessions.sh)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${SCRIPT_DIR}/claude-session.sh"

for env in beta prod; do
    ln -sf "$TARGET" "/usr/local/bin/claude-session-${env}"
    echo "Installed: claude-session-${env} → ${TARGET}"
done

# Keep legacy claude-session pointing to the same script
ln -sf "$TARGET" "/usr/local/bin/claude-session"
echo "Installed: claude-session → ${TARGET} (default: beta)"
