# PDSA: DNS + SSL setup for mindspace.xpollination.earth

**Task:** ms-a0-4-dns-ssl
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The mindspace API is currently HTTP-only on port 80. It needs HTTPS with a valid Let's Encrypt certificate for production use. The domain `mindspace.xpollination.earth` needs a DNS A record pointing to the Hetzner server.

## Requirements (REQ-API-001 §A0.4)

> Let's Encrypt SSL cert via certbot. DNS A record. Force HTTPS redirect. AC: https://mindspace.xpollination.earth/health returns 200.

## Investigation

### Existing infrastructure

- **Server:** Hetzner CX22, public IP `142.132.190.254`
- **DNS Provider:** GoDaddy (`xpollination.earth` domain)
- **Certbot:** Already installed, auto-renewal configured via systemd timer
- **Existing SSL certs:** `xpollination.earth`, `analytics.xpollination.earth`, `bestpractice.xpollination.earth` — all Let's Encrypt
- **Nginx config:** `deploy/nginx/mindspace.xpollination.earth` — HTTP-only with commented HTTPS template
- **Deploy script:** `deploy/nginx/deploy.sh` — uses sshpass + thomas user (developer has no sudo)

### Existing nginx config has HTTPS template ready

The ms-a0-3 nginx config already includes commented SSL configuration:
```nginx
ssl_certificate /etc/letsencrypt/live/mindspace.xpollination.earth/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mindspace.xpollination.earth/privkey.pem;
include /etc/letsencrypt/options-ssl-nginx.conf;
ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
```

### Established pattern (from other subdomains)

All existing subdomains follow the same pattern:
1. GoDaddy A record → `142.132.190.254`
2. `certbot certonly --nginx -d subdomain.xpollination.earth`
3. Nginx: HTTP server block redirects to HTTPS, HTTPS server block proxies to backend
4. Deploy via `deploy.sh`

## Design

### Step 1: DNS A record (manual — Thomas/GoDaddy)

Add in GoDaddy DNS management:
- **Type:** A
- **Name:** mindspace
- **Value:** 142.132.190.254
- **TTL:** 600 (10 min)

**Note:** This is a manual step — only Thomas can access GoDaddy.

### Step 2: Let's Encrypt certificate (manual — requires sudo)

```bash
sudo certbot certonly --nginx -d mindspace.xpollination.earth
```

This creates certs at `/etc/letsencrypt/live/mindspace.xpollination.earth/`. Auto-renewal is already configured for the server.

**Note:** Requires sudo via thomas user. Agent cannot execute directly.

### Step 3: Update nginx config

Replace the current HTTP-only config with HTTPS + HTTP redirect:

**File:** `deploy/nginx/mindspace.xpollination.earth`

```nginx
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=mindspace_api:10m rate=10r/s;

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name mindspace.xpollination.earth;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl;
    server_name mindspace.xpollination.earth;

    ssl_certificate /etc/letsencrypt/live/mindspace.xpollination.earth/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mindspace.xpollination.earth/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Health check (rate-limit exempt)
    location /health {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # All other routes
    location / {
        limit_req zone=mindspace_api burst=20 nodelay;

        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;

        # WebSocket / SSE support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # SSE: disable buffering
        proxy_buffering off;
        proxy_cache off;

        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

### Step 4: Deploy and verify

```bash
bash deploy/nginx/deploy.sh
curl -I https://mindspace.xpollination.earth/health
```

## Execution order

1. Thomas adds DNS A record in GoDaddy (manual)
2. Wait for DNS propagation (5-30 min, verify with `dig mindspace.xpollination.earth`)
3. Thomas runs certbot (requires sudo)
4. DEV updates nginx config file and deploys
5. Verify HTTPS health check returns 200

**Steps 1-3 require human action.** Only step 4 (nginx config update + deploy) is agent work.

## Files Changed

1. `deploy/nginx/mindspace.xpollination.earth` — HTTPS config with HTTP redirect

## Testing

1. Nginx config file has HTTPS server block (listen 443 ssl)
2. Nginx config has HTTP→HTTPS redirect (return 301)
3. SSL certificate paths reference Let's Encrypt live directory
4. ACME challenge location preserved for cert renewal
5. Health endpoint exempt from rate limiting
6. SSE/WebSocket headers preserved in HTTPS block
7. Proxy buffering disabled (SSE support)
8. Rate limiting zone and burst settings match ms-a0-3 spec
9. `https://mindspace.xpollination.earth/health` returns 200 (integration test, post-deploy)
10. `http://mindspace.xpollination.earth/health` redirects to HTTPS (integration test, post-deploy)
