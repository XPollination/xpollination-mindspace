#!/bin/bash
# ============================================================================
# MINDSPACE STARTUP
# ============================================================================
#
# This script starts the Mindspace project management system.
# It narrates each step so you understand what's happening and why.
#
# Mindspace organizes work in a hierarchy:
#   Mission > Capability > Requirement > Task
#
# Each level serves a purpose:
#   - Missions define the big goal (e.g., "Build XPollination Platform")
#   - Capabilities group related work (e.g., "API Foundation", "Visualization")
#   - Requirements specify what each capability needs
#   - Tasks are the actual work items assigned to agents
#
# ============================================================================

set -e

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  MINDSPACE STARTUP"
echo "  Project management for AI agent teams"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Database migrations
# ---------------------------------------------------------------------------
echo "▸ Step 1: Running database migrations..."
echo "  Creating tables for the Mission > Capability > Requirement > Task hierarchy."
echo "  Each migration is checksummed — safe to run multiple times."
echo ""

npx tsx api/db/migrate.ts

echo ""
echo "  ✓ Migrations complete."
echo ""

# ---------------------------------------------------------------------------
# Step 2: Seed initial data
# ---------------------------------------------------------------------------
echo "▸ Step 2: Seeding initial data..."
echo "  Creating admin users, projects, and API keys."
echo "  Agent API keys (pdsa, dev, qa, liaison) enable the 4-agent workflow."
echo ""

npx tsx -e "import { seed } from './api/db/seed.js'; seed();"

echo ""
echo "  ✓ Seed complete."
echo ""

# ---------------------------------------------------------------------------
# Step 3: Legacy data migration (if available)
# ---------------------------------------------------------------------------
if [ -f "/app/data/xpollination.db" ]; then
  echo "▸ Step 3: Migrating legacy data..."
  echo "  Found legacy xpollination.db — migrating tasks to new schema."
  echo "  Groups (A0, VIZ, WF...) become capabilities under a default mission."
  echo ""

  npx tsx -e "import { seedFromLegacy } from './api/db/seed-from-legacy.js'; seedFromLegacy('/app/data/xpollination.db');"

  echo ""
  echo "  ✓ Legacy migration complete."
  echo ""
else
  echo "▸ Step 3: No legacy database found — skipping migration."
  echo ""
fi

# ---------------------------------------------------------------------------
# Step 4: Start servers
# ---------------------------------------------------------------------------
echo "▸ Step 4: Starting Mindspace servers..."
echo ""
echo "  API server  → http://localhost:3100  (REST API with auth)"
echo "  Viz server  → http://localhost:4200  (Dashboard UI)"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  Mindspace is ready."
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Start viz in background, API in foreground
node viz/server.js ${VIZ_PORT:-4200} &
VIZ_PID=$!

# Start API server (foreground — container stays alive)
npx tsx api/server.ts

# If API exits, clean up viz
kill $VIZ_PID 2>/dev/null
