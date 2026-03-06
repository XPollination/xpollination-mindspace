# Changelog: d3-1-backup-mindspace-db v0.0.1

## Summary
Added mindspace SQLite databases to Synology NAS backup with GFS rotation.

## Changes
- Created `scripts/backup-mindspace-db.sh`
- WAL-safe backup via better-sqlite3 .backup() (sqlite3 CLI not available)
- Backs up prod (data/xpollination.db) + test DB if present
- Tar-over-SSH to Synology at /volume1/backups/hetzner/mindspace-db/
- GFS rotation: 7 daily, 4 weekly, 12 monthly
- Includes RESTORE.md manifest

## Commit
- 2b54a37

## Branch Compliance
VIOLATION (main) — task in-flight before branching rules deployed.

## Verification
- End-to-end verified: 884K prod DB on NAS
- QA: PASS (verified on NAS)
- PDSA: PASS
