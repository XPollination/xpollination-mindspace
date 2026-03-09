# Changelog: viz-prod-port-migration v0.0.1

## Initial Design

- **systemd service**: Create mindspace.service for prod on port 4100, VPN-only (10.33.33.1)
- **Symlink deployment**: Uses `viz/active/server.js` — deploy by updating symlink + restart
- **VIZ_BIND support**: server.js already supports `VIZ_BIND` env var — no code changes needed
- **TEST service fix**: Change hardcoded v0.0.9 path to symlink, add VIZ_BIND
- **Firewall**: Allow 4100, remove 8080
- **Reference updates**: pm.status SKILL.md (7 refs) and monitor SKILL.md (1 ref) — 8080→4100
- **8 changes**: service file, test service fix, .env.production, kill ad-hoc, firewall, 2 skill updates, verification
