#!/bin/bash
# Onboard a new project to the XPollination PM system
# Usage: ./scripts/onboard-project.sh /path/to/project
#
# This script:
# 1. Creates data/xpollination.db in target project
# 2. Applies schema from xpollination-mcp-server
# 3. Initializes default stations
# 4. Verifies setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER_DIR="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$MCP_SERVER_DIR/src/db/schema.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: $0 /path/to/project"
    echo ""
    echo "Onboards a project to the XPollination PM system by:"
    echo "  1. Creating data/xpollination.db"
    echo "  2. Applying PM schema"
    echo "  3. Initializing default stations"
    exit 1
fi

TARGET_PROJECT="$1"
PROJECT_NAME="$(basename "$TARGET_PROJECT")"

# Validate target project exists
if [ ! -d "$TARGET_PROJECT" ]; then
    log_error "Project directory does not exist: $TARGET_PROJECT"
    exit 1
fi

# Create data directory
DATA_DIR="$TARGET_PROJECT/data"
DB_PATH="$DATA_DIR/xpollination.db"

if [ -f "$DB_PATH" ]; then
    log_warn "Database already exists: $DB_PATH"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Aborted."
        exit 0
    fi
    rm "$DB_PATH"
fi

log_info "Creating data directory: $DATA_DIR"
mkdir -p "$DATA_DIR"

# Apply schema using Node.js (better-sqlite3)
log_info "Applying schema to: $DB_PATH"

node -e "
const Database = require('better-sqlite3');
const fs = require('fs');

// Read schema from mcp-server source database
const srcDbPath = '$MCP_SERVER_DIR/data/xpollination.db';
const srcDb = new Database(srcDbPath, { readonly: true });

// Get all CREATE TABLE statements
const tables = srcDb.prepare(\"SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL\").all();
const indexes = srcDb.prepare(\"SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL\").all();
srcDb.close();

// Create new database
const targetDb = new Database('$DB_PATH');

// Apply tables
tables.forEach(t => {
  try {
    targetDb.exec(t.sql);
  } catch (e) {
    console.error('Error creating table:', e.message);
  }
});

// Apply indexes
indexes.forEach(i => {
  try {
    targetDb.exec(i.sql);
  } catch (e) {
    // Ignore duplicate index errors
  }
});

// Initialize default stations
const projectSlug = '$PROJECT_NAME'.toLowerCase().replace(/[^a-z0-9]/g, '-');
targetDb.exec(\`
  INSERT INTO stations (id, role, name, status) VALUES
    ('\${projectSlug}-pdsa', 'pdsa', 'PDSA Station', 'idle'),
    ('\${projectSlug}-dev', 'dev', 'Dev Station', 'idle'),
    ('\${projectSlug}-qa', 'qa', 'QA Station', 'idle'),
    ('\${projectSlug}-human', 'human', 'Human Station', 'idle');
\`);

console.log('Tables created:', tables.length);
console.log('Indexes created:', indexes.length);
console.log('Stations initialized: 4');

targetDb.close();
"

# Verify setup
log_info "Verifying setup..."

TABLES=$(node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH', { readonly: true });
const count = db.prepare(\"SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'\").get().c;
console.log(count);
db.close();
")

STATIONS=$(node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH', { readonly: true });
const count = db.prepare('SELECT COUNT(*) as c FROM stations').get().c;
console.log(count);
db.close();
")

log_info "Verification results:"
echo "  - Tables: $TABLES"
echo "  - Stations: $STATIONS"

if [ "$TABLES" -ge 10 ] && [ "$STATIONS" -eq 4 ]; then
    log_info "Project '$PROJECT_NAME' successfully onboarded!"
    echo ""
    echo "Next steps:"
    echo "  1. Start viz server: npm run viz"
    echo "  2. Select '$PROJECT_NAME' from dropdown"
    echo "  3. Create first requirement node"
else
    log_error "Verification failed. Check database manually."
    exit 1
fi
