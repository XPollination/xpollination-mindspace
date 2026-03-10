#!/bin/bash
# Setup Let's Encrypt SSL for mindspace.xpollination.earth
# Prerequisites: DNS A record pointing to this server, nginx installed
# Run as root or with sudo

set -euo pipefail

DOMAIN="mindspace.xpollination.earth"

echo "Setting up SSL for $DOMAIN..."

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Obtain certificate using nginx plugin
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email herr.thomas.pichler@gmail.com

# Verify auto-renewal is configured
certbot renew --dry-run

echo "SSL setup complete for $DOMAIN"
