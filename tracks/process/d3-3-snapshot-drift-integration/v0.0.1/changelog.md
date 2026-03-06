# Changelog: d3-3-snapshot-drift-integration v0.0.1

## Summary
Rewrote drift-check.sh to dynamically parse production snapshot JSON via python3, replacing hardcoded baselines. Coverage increased from 37 to 44 checks.

## Changes
- Replaced hardcoded port/service/repo lists with python3 `json_query()` helper parsing snapshot JSON
- All 7 sections (ports, git repos, docker, systemd, VPN, non-systemd, Qdrant) extract baselines from snapshot
- Handles dict-format systemd services, multi-port services, port deduplication
- Discovered previously invisible: containerd, brain-api:3201, ports 53/3000/3001/3210/8901

## Commit
- 169dd54 — drift-check.sh snapshot integration

## Verification
- 44/44 checks pass live, no drift detected
- QA: PASS (live verification)
- PDSA: PASS (design compliance)
