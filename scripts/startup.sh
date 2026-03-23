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
# Step 0: Wait for dependencies
# ---------------------------------------------------------------------------
# Brain API must be reachable before we run migrations or start servers.
# Docker Compose health checks handle startup ordering, but startup.sh
# also validates independently — belt and suspenders.
if [ -n "$BRAIN_API_URL" ] && [ "$BRAIN_API_URL" != "disabled" ]; then
  echo "▸ Step 0: Waiting for Brain API at $BRAIN_API_URL..."
  BRAIN_READY=0
  for i in $(seq 1 30); do
    if node -e "fetch('${BRAIN_API_URL}/api/v1/health').then(r=>{if(!r.ok)throw 1;process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; then
      echo "  ✓ Brain API ready"
      BRAIN_READY=1
      break
    fi
    echo "  Attempt $i/30 — waiting 2s..."
    sleep 2
  done
  if [ "$BRAIN_READY" -eq 0 ]; then
    echo "  ⚠ Brain API not reachable after 60s — continuing without brain"
    echo "    Agent memory features will be unavailable until brain is up."
  fi
  echo ""
else
  echo "▸ Step 0: BRAIN_API_URL not set — skipping brain dependency check."
  echo ""
fi

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

npx tsx -e "import { seed } from './api/db/seed.ts'; seed();"

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

  npx tsx -e "import { seedFromLegacy } from './api/db/seed-from-legacy.ts'; seedFromLegacy('/app/data/xpollination.db');"

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

# Start viz in background
node viz/server.js ${VIZ_PORT:-4200} &
VIZ_PID=$!

echo "  Viz server  → http://localhost:${VIZ_PORT:-4200}  (Dashboard UI)"
echo "  API server  → http://localhost:${API_PORT:-3100}  (REST API with auth)"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  Mindspace is ready."
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Start API server (foreground — container stays alive)
npx tsx api/server.ts

# If API exits, clean up viz
kill $VIZ_PID 2>/dev/null
