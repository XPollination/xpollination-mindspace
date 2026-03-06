# Changelog: d1-2-systemd-test-service v0.0.1

## Summary
Created systemd service for test mindspace instance, running on port 4200 with VPN-only binding.

## Changes
- Created `systemd/mindspace-test.service` unit file (User=developer, .env.test, NODE_ENV=test, port 4200)
- Added VIZ_BIND env var support to server.js (rework)
- Service installed, enabled, and running
- UFW rule added for ports 4200-4210 (VPN-only: 10.33.33.0/24)

## Commits
- f6c9b3c — unit file
- 6d1cf15 — VIZ_BIND fix

## Branch Compliance
VIOLATION (main) — task in-flight before branching rules deployed.

## Verification
- Service active+running (PID 2650241)
- curl http://10.33.33.1:4200/ → HTTP 200
- QA: PASS (post-rework)
- PDSA: PASS (post-rework)
