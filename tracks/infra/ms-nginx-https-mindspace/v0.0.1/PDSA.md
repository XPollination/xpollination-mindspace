# PDSA: nginx Reverse Proxy + HTTPS for mindspace.xpollination.earth

**Task:** ms-nginx-https-mindspace
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.12 Phase 2

## Problem

Mindspace needs HTTPS for Google OAuth (callback URL requires HTTPS). Need DNS, nginx reverse proxy, and Let's Encrypt TLS — same pattern as hive.xpollination.earth.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | DNS A-record: mindspace.xpollination.earth → Hetzner public IP | Domain resolution |
| D2 | nginx reverse proxy: mindspace.xpollination.earth → localhost:4200 (PROD Viz) | PROD serves on 4200, nginx terminates TLS |
| D3 | Let's Encrypt TLS via certbot | Free, automated TLS — same as hive |
| D4 | HTTP→HTTPS redirect | Security best practice |
| D5 | Replicate hive.xpollination.earth nginx config pattern | Proven, working template |
| D6 | API proxied at /api/* → localhost:3100 | API accessible through same domain |

### Acceptance Criteria

- AC1: DNS resolves mindspace.xpollination.earth to Hetzner IP
- AC2: https://mindspace.xpollination.earth loads login page
- AC3: http:// redirects to https://
- AC4: TLS certificate valid (Let's Encrypt)
- AC5: API accessible at https://mindspace.xpollination.earth/api/*
- AC6: No direct port access needed (4200/3100 behind nginx)

### Files to Change

- `/etc/nginx/sites-available/mindspace.xpollination.earth` — New nginx config
- DNS provider — A-record (manual or API)

### Test Plan

1. Verify DNS: `dig mindspace.xpollination.earth`
2. Verify HTTPS: `curl -I https://mindspace.xpollination.earth`
3. Verify redirect: `curl -I http://mindspace.xpollination.earth`
4. Verify API: `curl https://mindspace.xpollination.earth/api/v1/health`

## Do / Study / Act

(To be completed)
