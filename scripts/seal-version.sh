#!/bin/bash
#===============================================================================
# seal-version.sh — Seal a work package version with git tag
#
# Tags the current commit with a work-package-scoped version tag.
# Follows ProfileAssistant tracks/work-packages pattern.
#
# Usage: ./scripts/seal-version.sh <track/work-package> <version>
#   Example: ./scripts/seal-version.sh brain-infrastructure/contribution-quality v0.0.1
#===============================================================================

set -euo pipefail

REPO=$(git rev-parse --show-toplevel)
WP_PATH="${1:-}"
VER="${2:-}"

if [[ -z "$WP_PATH" ]] || [[ -z "$VER" ]]; then
    echo "Usage: ./scripts/seal-version.sh <track/work-package> <version>"
    echo "  e.g.: ./scripts/seal-version.sh brain-infrastructure/contribution-quality v0.0.1"
    exit 1
fi

WP_DIR="$REPO/tracks/$WP_PATH"

if [[ ! -d "$WP_DIR/$VER" ]]; then
    echo "ERROR: Version directory not found: $WP_DIR/$VER"
    exit 1
fi

# Gate: no uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "ERROR: Uncommitted changes detected. Commit everything before sealing."
    exit 1
fi

# Create scoped tag: track-workpackage-version
TAG="${WP_PATH//\//-}-$VER"
git tag -a "$TAG" -m "Sealed $WP_PATH $VER"
git push origin "$TAG"

echo "Sealed $WP_PATH $VER (tag: $TAG)"
echo ""
echo "To verify: git tag -l | grep $TAG"
