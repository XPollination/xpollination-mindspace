# Changelog: d1-3-ufw-test-ports v0.0.1

## Summary

Added UFW firewall rules restricting test ports 4200-4210 to VPN subnet only.

## Changes

- Added UFW rule #10: ports 4200-4210/tcp ALLOW IN from 10.33.33.0/24
- No public access to test system — VPN-only
- Verified: rule in ufw status, HTTP 200 at 10.33.33.1:4200
