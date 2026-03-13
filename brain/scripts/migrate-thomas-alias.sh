#!/bin/bash
# Migration: Create thought_space_thomas alias pointing to thought_space (physical collection)
# Zero downtime, zero data movement — Qdrant does not support rename, alias is the official workaround.
#
# Usage: bash api/scripts/migrate-thomas-alias.sh
#
# Prerequisites: Qdrant running on localhost:6333, brain API stopped or running

set -euo pipefail

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
BRAIN_DB="${BRAIN_DB_PATH:-/home/developer/workspaces/github/PichlerThomas/best-practices/data/thought-tracing.db}"

echo "=== Multi-User Migration: Thomas Alias ==="

# Step 1: Verify thought_space exists and count points
echo "Step 1: Verifying existing thought_space collection..."
COLLECTION_INFO=$(curl -s "${QDRANT_URL}/collections/thought_space")
POINTS_COUNT=$(echo "$COLLECTION_INFO" | grep -o '"points_count":[0-9]*' | grep -o '[0-9]*' || echo "0")
echo "  Found ${POINTS_COUNT} points in thought_space"

if [ "$POINTS_COUNT" = "0" ]; then
  echo "  WARNING: No points found — check Qdrant status"
fi

# Step 2: Create alias thought_space_thomas -> thought_space
echo "Step 2: Creating alias thought_space_thomas -> thought_space..."
curl -s -X POST "${QDRANT_URL}/collections/aliases" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {
        "create_alias": {
          "collection_name": "thought_space",
          "alias_name": "thought_space_thomas"
        }
      }
    ]
  }' | cat
echo ""

# Step 3: Create thought_space_shared collection (if not exists)
echo "Step 3: Creating thought_space_shared collection..."
SHARED_EXISTS=$(curl -s "${QDRANT_URL}/collections/thought_space_shared" | grep -c '"status":"ok"' || true)
if [ "$SHARED_EXISTS" = "0" ]; then
  curl -s -X PUT "${QDRANT_URL}/collections/thought_space_shared" \
    -H "Content-Type: application/json" \
    -d '{
      "vectors": { "size": 384, "distance": "Cosine" },
      "optimizers_config": { "default_segment_number": 2 },
      "replication_factor": 1
    }' | cat
  echo ""

  # Create payload indexes matching thought_space
  for FIELD in contributor_id thought_type tags knowledge_space_id thought_category topic quality_flags; do
    curl -s -X PUT "${QDRANT_URL}/collections/thought_space_shared/index" \
      -H "Content-Type: application/json" \
      -d "{\"field_name\": \"${FIELD}\", \"field_schema\": \"keyword\"}" > /dev/null
  done
  curl -s -X PUT "${QDRANT_URL}/collections/thought_space_shared/index" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "access_count", "field_schema": "integer"}' > /dev/null
  curl -s -X PUT "${QDRANT_URL}/collections/thought_space_shared/index" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "pheromone_weight", "field_schema": "float"}' > /dev/null
  for FIELD in created_at last_accessed; do
    curl -s -X PUT "${QDRANT_URL}/collections/thought_space_shared/index" \
      -H "Content-Type: application/json" \
      -d "{\"field_name\": \"${FIELD}\", \"field_schema\": \"datetime\"}" > /dev/null
  done
  echo "  Created thought_space_shared with indexes"
else
  echo "  thought_space_shared already exists — skipping"
fi

# Step 4: UPDATE Thomas user record in SQLite
echo "Step 4: Updating Thomas user record..."
sqlite3 "$BRAIN_DB" "UPDATE users SET qdrant_collection = 'thought_space_thomas' WHERE user_id = 'thomas';"
echo "  Updated Thomas qdrant_collection to thought_space_thomas"

# Step 5: Verify thoughts are accessible via alias
echo "Step 5: Verifying thoughts via alias..."
ALIAS_INFO=$(curl -s "${QDRANT_URL}/collections/thought_space_thomas")
ALIAS_COUNT=$(echo "$ALIAS_INFO" | grep -o '"points_count":[0-9]*' | grep -o '[0-9]*' || echo "0")
echo "  Alias thought_space_thomas shows ${ALIAS_COUNT} points"

if [ "$POINTS_COUNT" = "$ALIAS_COUNT" ]; then
  echo "  VERIFIED: Point count matches (${POINTS_COUNT})"
else
  echo "  WARNING: Point count mismatch — original=${POINTS_COUNT}, alias=${ALIAS_COUNT}"
fi

echo ""
echo "=== Migration Complete ==="
echo "  Thomas collection: thought_space_thomas (alias -> thought_space)"
echo "  Shared collection: thought_space_shared"
echo "  Existing ${POINTS_COUNT} thoughts intact"
