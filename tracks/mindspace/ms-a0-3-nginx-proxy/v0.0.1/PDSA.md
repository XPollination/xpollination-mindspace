# PDSA: Nginx reverse proxy configuration

**Task:** ms-a0-3-nginx-proxy
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10
**Requirement:** REQ-API-001

## Problem

The mindspace API (Express on port 3100) needs a reverse proxy for:
1. Serving `mindspace.xpollination.earth` → Express backend
2. WebSocket/SSE upgrade headers for future real-time features (A2A protocol)
3. Rate limiting baseline to protect the API
4. SSL termination (deferred to ms-a0-4-dns-ssl, but config must be SSL-ready)

### Existing Infrastructure

- **Hetzner CX22** — nginx already running with 3 server blocks:
  - `xpollination.earth` — static site + paperless-ngx (port 8000)
  - `bestpractice.xpollination.earth` — brain API (port 3200) + MCP (port 3201)
  - `internal-tools` — VPN-only dev dashboard (port 80 default_server)
- **Pattern:** SSL via Let's Encrypt certbot, proxy_pass to localhost ports
- **No sudo for developer** — nginx config changes need `thomas` user via sshpass

### Mindspace API Port

Express listens on port 3100 (configurable via `API_PORT` env var, set in ms-a0-1-express-setup).

## Design

### Change A: Nginx config file — `deploy/nginx/mindspace.xpollination.earth`

Git-tracked config that gets deployed to `/etc/nginx/sites-available/mindspace`:

```nginx
# Mindspace API — mindspace.xpollination.earth
# Deployed from: xpollination-mcp-server/deploy/nginx/mindspace.xpollination.earth
# Express backend on port 3100

# HTTP → HTTPS redirect (enabled after ms-a0-4-dns-ssl)
# server {
#     listen 80;
#     server_name mindspace.xpollination.earth;
#     return 301 https://$host$request_uri;
# }

# Temporary: HTTP-only until SSL is configured
server {
    listen 80;
    server_name mindspace.xpollination.earth;

    # Rate limiting zone (10 req/s per IP, burst 20)
    limit_req zone=mindspace_api burst=20 nodelay;

    # API proxy
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;

        # WebSocket/SSE upgrade headers (for future A2A protocol)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # SSE: disable buffering for streaming responses
        proxy_buffering off;
        proxy_cache off;

        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;  # Long for SSE connections

        # Request size limit
        client_max_body_size 10M;
    }

    # Health check — no rate limiting
    location = /health {
        limit_req off;
        proxy_pass http://127.0.0.1:3100/health;
        proxy_set_header Host $host;
    }
}

# HTTPS version (enabled after ms-a0-4-dns-ssl sets up certificates)
# server {
#     listen 443 ssl;
#     server_name mindspace.xpollination.earth;
#
#     ssl_certificate /etc/letsencrypt/live/mindspace.xpollination.earth/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/mindspace.xpollination.earth/privkey.pem;
#     include /etc/letsencrypt/options-ssl-nginx.conf;
#     ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
#
#     # ... same location blocks as above ...
# }
```

### Change B: Rate limiting zone in nginx.conf

Add to `/etc/nginx/nginx.conf` (in the `http` block):

```nginx
# Rate limiting for mindspace API
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
limit_req_zone $binary_remote_addr zone=mindspace_api:10m rate=10r/s;
```

**Note:** The `map` directive for WebSocket upgrade may already exist. Check before adding. The `limit_req_zone` must be in the `http` block, not inside a `server` block.

### Change C: Deployment script — `deploy/nginx/deploy.sh`

```bash
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
```

### Design Decisions

- **HTTP-only initially** — SSL setup is ms-a0-4-dns-ssl (depends on this task). Config has commented HTTPS blocks ready to uncomment.
- **`X-Request-Id` header** — nginx's `$request_id` provides a unique ID per request. This aligns with ms-a0-6-logging's `x-request-id` passthrough.
- **Rate limit: 10r/s, burst 20** — reasonable baseline for API. Health check exempt.
- **`proxy_read_timeout: 300s`** — SSE connections stay open for long periods. Short timeouts would kill streams.
- **`proxy_buffering off`** — required for SSE to work (nginx must not buffer streaming responses).
- **Git-tracked config** — lives in repo, deployed via script. No manual editing on server.

### Files Changed

1. `deploy/nginx/mindspace.xpollination.earth` — **new** — nginx server block config
2. `deploy/nginx/deploy.sh` — **new** — deployment script (sshpass via thomas user)
3. `/etc/nginx/nginx.conf` — **modified** (manual/deploy) — rate limiting zone + map directive

### Testing

1. `curl http://mindspace.xpollination.earth/health` returns 200 from Express
2. `curl http://mindspace.xpollination.earth/nonexistent` returns 404 from Express (not nginx default)
3. Health check is not rate-limited (rapid requests succeed)
4. API endpoints are rate-limited (>10 req/s from same IP returns 503)
5. `nginx -t` passes (config syntax valid)
6. Response headers include `X-Request-Id` (or response from Express includes request ID from pino-http)
7. WebSocket upgrade works (test with simple WebSocket client when SSE is implemented)
8. Config file in repo matches what's deployed to server
