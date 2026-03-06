#!/bin/bash
# create-test-qdrant-collections.sh — Create isolated test Qdrant collections
# Usage: bash scripts/create-test-qdrant-collections.sh [qdrant-url]
#
# Creates test_brain_* collections mirroring production collection structure.
# Completely isolated from production data. Safe to run multiple times (idempotent).

set -euo pipefail

QDRANT_URL="${1:-http://localhost:6333}"
PREFIX="test_brain_"

# Production collections → test equivalents
COLLECTIONS=(
  "thought_space"
  "thought_space_shared"
  "thought_space_maria"
  "best_practices"
  "queries"
)

# Vector config matching production (384-dim, cosine)
VECTOR_CONFIG='{"size": 384, "distance": "Cosine"}'

echo "=== Creating Test Qdrant Collections ==="
echo "Qdrant: $QDRANT_URL"
echo "Prefix: $PREFIX"
echo ""

CREATED=0
EXISTED=0
FAILED=0

for coll in "${COLLECTIONS[@]}"; do
  test_name="${PREFIX}${coll}"

  # Check if collection exists
  status=$(curl -s -o /dev/null -w "%{http_code}" "$QDRANT_URL/collections/$test_name")

  if [ "$status" = "200" ]; then
    echo "  EXISTS: $test_name"
    EXISTED=$((EXISTED + 1))
  else
    # Create collection
    result=$(curl -s -X PUT "$QDRANT_URL/collections/$test_name" \
      -H "Content-Type: application/json" \
      -d "{\"vectors\": $VECTOR_CONFIG}" 2>&1)

    if echo "$result" | grep -q '"result":true'; then
      echo "  CREATED: $test_name"
      CREATED=$((CREATED + 1))
    else
      echo "  FAILED: $test_name — $result"
      FAILED=$((FAILED + 1))
    fi
  fi
done

echo ""
echo "=== Summary: $CREATED created, $EXISTED already existed, $FAILED failed ==="

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
