#!/bin/bash
#===============================================================================
# new-version.sh — Create a new version in a specific work package
#
# Follows ProfileAssistant tracks/work-packages pattern.
# Each work package iterates independently.
#
# Usage: ./scripts/new-version.sh <track/work-package> <version>
#   Example: ./scripts/new-version.sh brain-infrastructure/contribution-quality v0.0.2
#===============================================================================

set -euo pipefail

REPO=$(git rev-parse --show-toplevel)
WP_PATH="${1:-}"
NEW_VER="${2:-}"

if [[ -z "$WP_PATH" ]] || [[ -z "$NEW_VER" ]]; then
    echo "Usage: ./scripts/new-version.sh <track/work-package> <version>"
    echo "  e.g.: ./scripts/new-version.sh brain-infrastructure/contribution-quality v0.0.2"
    exit 1
fi

WP_DIR="$REPO/tracks/$WP_PATH"

if [[ ! -d "$WP_DIR" ]]; then
    echo "ERROR: Work package not found: $WP_DIR"
    exit 1
fi

if [[ -d "$WP_DIR/$NEW_VER" ]]; then
    echo "ERROR: $WP_DIR/$NEW_VER already exists"
    exit 1
fi

# Create new version structure
mkdir -p "$WP_DIR/$NEW_VER/pdsa"
mkdir -p "$WP_DIR/$NEW_VER/deliverables"

# Copy deliverables from previous version as starting point
PREV_VER=$(ls -d "$WP_DIR"/v0.0.* 2>/dev/null | sort -V | tail -1 | xargs basename 2>/dev/null || true)
if [ -n "$PREV_VER" ] && [ "$PREV_VER" != "$NEW_VER" ] && [ -d "$WP_DIR/$PREV_VER/deliverables" ]; then
    cp -r "$WP_DIR/$PREV_VER/deliverables/"* "$WP_DIR/$NEW_VER/deliverables/" 2>/dev/null || true
fi
# pdsa/ starts empty (new iteration, new design work)

echo "Created $WP_PATH/$NEW_VER"
echo ""
echo "Next steps:"
echo "  1. git add tracks/$WP_PATH/$NEW_VER/"
echo "  2. git commit -m 'infra: create $WP_PATH $NEW_VER'"
echo "  3. git push"
