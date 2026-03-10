#!/bin/bash
# Deploy mindspace nginx config
# Usage: SSH_ADMIN_PASSWORD=... bash deploy/nginx/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/mindspace.xpollination.earth"

if [ ! -f "$CONFIG" ]; then
    echo "Error: config file not found: $CONFIG"
    exit 1
fi

# Copy config to nginx sites-available
sshpass -p "$SSH_ADMIN_PASSWORD" ssh thomas@localhost \
    "cat > /etc/nginx/sites-available/mindspace" < "$CONFIG"

# Enable site (symlink to sites-enabled)
sshpass -p "$SSH_ADMIN_PASSWORD" ssh thomas@localhost \
    "ln -sfn /etc/nginx/sites-available/mindspace /etc/nginx/sites-enabled/mindspace"

# Test config
sshpass -p "$SSH_ADMIN_PASSWORD" ssh thomas@localhost "nginx -t"

# Reload nginx
sshpass -p "$SSH_ADMIN_PASSWORD" ssh thomas@localhost "systemctl reload nginx"

echo "Deployed: mindspace.xpollination.earth → 127.0.0.1:3100"
