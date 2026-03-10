# Changelog: ms-a0-3-nginx-proxy v0.0.1

## v0.0.1 — 2026-03-10

Initial design for nginx reverse proxy.

### Changes

1. **New:** `deploy/nginx/mindspace.xpollination.earth` — server block with proxy_pass to Express:3100, WebSocket/SSE headers, rate limiting
2. **New:** `deploy/nginx/deploy.sh` — deployment script via sshpass + thomas user
3. **Modified:** `/etc/nginx/nginx.conf` — rate limiting zone (10r/s) + connection_upgrade map

### Design decisions

- HTTP-only initially — SSL deferred to ms-a0-4-dns-ssl (HTTPS blocks commented, ready to uncomment)
- X-Request-Id passthrough from nginx to Express (aligns with ms-a0-6 logging)
- Rate limit: 10r/s burst 20, health check exempt
- proxy_buffering off + 300s read timeout for SSE support
