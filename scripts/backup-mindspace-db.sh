#!/bin/bash
# backup-mindspace-db.sh — Backup mindspace SQLite DBs to Synology NAS
# Usage: bash scripts/backup-mindspace-db.sh
# Runs as: developer user (no sudo needed)
# Schedule: Add to cron: 0 */6 * * * /path/to/backup-mindspace-db.sh
#
# Backs up production and test DBs using sqlite3 .backup (safe for WAL mode).
# Transfers to Synology via tar-over-SSH with GFS rotation.

set -euo pipefail

# Configuration
WORKING_DIR="/home/developer/workspaces/github/PichlerThomas"
PROD_DB="$WORKING_DIR/xpollination-mcp-server/data/xpollination.db"
TEST_DB="$WORKING_DIR/xpollination-mcp-server/test/data/xpollination-test.db"
BACKUP_BASE="/volume1/backups/hetzner/mindspace-db"
DATE=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)
DAY_OF_MONTH=$(date +%d)
SSH_CMD="ssh synology-backup"
TEMP_DIR="/tmp/mindspace-backup-$$"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=========================================="
log "Starting mindspace DB backup"
log "=========================================="

mkdir -p "$TEMP_DIR"

# 1. Safe SQLite backup via better-sqlite3 (handles WAL mode correctly)
log "Step 1: Creating safe SQLite backups..."

backup_db() {
  local src="$1"
  local dst="$2"
  local label="$3"
  if [ -f "$src" ]; then
    node -e "require('better-sqlite3')('$src').backup('$dst').then(() => console.log('ok')).catch(e => { console.error(e); process.exit(1); })"
    log "$label backed up: $(du -h "$dst" | cut -f1)"
  else
    log "INFO: $label not found at $src"
  fi
}

backup_db "$PROD_DB" "$TEMP_DIR/xpollination-prod.db" "Production DB"
backup_db "$TEST_DB" "$TEMP_DIR/xpollination-test.db" "Test DB"

# 2. Create manifest
log "Step 2: Creating backup manifest..."
PROD_TASKS=$(node -e "try{console.log(require('better-sqlite3')('$PROD_DB').prepare('SELECT COUNT(*) as c FROM mindspace_nodes').get().c)}catch(e){console.log('unknown')}" 2>/dev/null)
cat > "$TEMP_DIR/RESTORE.md" << EOF
# Mindspace DB Backup
Date: $DATE
Production tasks: $PROD_TASKS

## Restore
1. Download from NAS:
   ssh synology-backup "cat $BACKUP_BASE/daily/$DATE/xpollination-prod.db" > /tmp/restore.db
   (Note: scp fails on Synology — use cat over SSH)

2. Stop viz server and any active agents

3. Replace production DB:
   cp /tmp/restore.db $PROD_DB

4. Restart viz server:
   node xpollination-mcp-server/viz/versions/v0.0.9/server.js 8080

5. Verify:
   node -e "console.log(require('better-sqlite3')('$PROD_DB').prepare('SELECT COUNT(*) FROM mindspace_nodes').get())"
EOF

# 3. Ensure NAS directories exist
log "Step 3: Ensuring NAS directories..."
$SSH_CMD "mkdir -p $BACKUP_BASE/latest $BACKUP_BASE/daily $BACKUP_BASE/weekly $BACKUP_BASE/monthly"

# 4. Transfer to NAS via tar-over-SSH
log "Step 4: Transferring to NAS..."
$SSH_CMD "rm -rf $BACKUP_BASE/latest/* 2>/dev/null || true"
tar czf - -C "$TEMP_DIR" . | $SSH_CMD "tar xzf - -C $BACKUP_BASE/latest/"
log "Transfer complete"

# 5. Create daily snapshot (hardlinks)
log "Step 5: Creating daily snapshot: $DATE"
$SSH_CMD "rm -rf $BACKUP_BASE/daily/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/latest $BACKUP_BASE/daily/$DATE"

# 6. Weekly (Sunday)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  log "Step 6: Sunday — creating weekly snapshot"
  $SSH_CMD "rm -rf $BACKUP_BASE/weekly/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/daily/$DATE $BACKUP_BASE/weekly/$DATE"
else
  log "Step 6: Not Sunday — skipping weekly"
fi

# 7. Monthly (1st)
if [ "$DAY_OF_MONTH" = "01" ]; then
  log "Step 7: 1st — creating monthly snapshot"
  $SSH_CMD "rm -rf $BACKUP_BASE/monthly/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/daily/$DATE $BACKUP_BASE/monthly/$DATE"
else
  log "Step 7: Not 1st — skipping monthly"
fi

# 8. GFS cleanup (7 daily, 4 weekly, 12 monthly)
log "Step 8: GFS cleanup..."
$SSH_CMD "
  cd $BACKUP_BASE/daily 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -7 | xargs -r rm -rf || true
  cd $BACKUP_BASE/weekly 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -4 | xargs -r rm -rf || true
  cd $BACKUP_BASE/monthly 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -12 | xargs -r rm -rf || true
"

# 9. Cleanup
rm -rf "$TEMP_DIR"

# 10. Report
log "Step 10: Backup statistics"
$SSH_CMD "
  echo 'Mindspace DB backup counts:'
  echo '  Daily: '$(ls $BACKUP_BASE/daily 2>/dev/null | wc -l)
  echo '  Weekly: '$(ls $BACKUP_BASE/weekly 2>/dev/null | wc -l)
  echo '  Monthly: '$(ls $BACKUP_BASE/monthly 2>/dev/null | wc -l)
" 2>/dev/null || log "Could not query NAS statistics"

log "=========================================="
log "Mindspace DB backup completed!"
log "=========================================="
