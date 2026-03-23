# PDSA: beta-mindspace.xpollination.earth Dev Server

**Task:** beta-mindspace-dev-server | **Version:** v0.0.1

## Problem

No dev/staging environment. All work deploys to production. Need isolated beta server on develop branch for testing before main merge.

## Design

### Architecture

```
beta-mindspace.xpollination.earth (port 4201)
  ├── Nginx reverse proxy (existing server block pattern)
  ├── Systemd service: mindspace-viz-beta.service
  ├── Working dir: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-beta/
  ├── Branch: develop (auto-pull on restart)
  └── DB: separate data/xpollination-beta.db
```

### Nginx Config

```nginx
server {
    server_name beta-mindspace.xpollination.earth;
    location / { proxy_pass http://127.0.0.1:4201; }
    # SSL via certbot (same wildcard or separate cert)
}
```

### Systemd Service

```ini
[Unit]
Description=Mindspace Viz Beta (develop)
After=network.target

[Service]
Type=simple
User=developer
WorkingDirectory=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-beta
ExecStartPre=/usr/bin/git pull origin develop
ExecStart=/home/developer/.nvm/versions/node/v22.22.0/bin/node viz/server.js 4201
Environment=DATABASE_PATH=data/xpollination-beta.db
Environment=API_PORT=3101
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Setup Steps

1. Clone repo to -beta directory (or git worktree)
2. Checkout develop branch
3. Create nginx server block
4. Certbot SSL certificate
5. Create systemd service
6. Start and verify

### Acceptance Criteria

- AC1: beta-mindspace.xpollination.earth serves viz on develop branch
- AC2: Separate DB from production
- AC3: HTTPS with valid cert
- AC4: Auto-pulls develop on service restart
- AC5: Port 4201 (not conflicting with prod 4200)
