# Changelog: ms-a0-4-dns-ssl v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Follow existing pattern from other xpollination.earth subdomains
- GoDaddy A record + certbot + nginx HTTPS — proven approach
- HTTP→HTTPS redirect with ACME challenge passthrough for renewal
- Steps 1-3 (DNS, certbot) are manual/human — only nginx config is agent work
- Preserve all ms-a0-3 features (rate limiting, SSE, WebSocket) in HTTPS block
- 1 file changed: deploy/nginx/mindspace.xpollination.earth
