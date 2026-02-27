#!/bin/bash
#===============================================================================
# seal-version.sh — Seal a version with changelog gate and git tag
#
# Gates on CHANGELOG.md having an entry for the version before tagging.
# No deploy step for code+docs projects (unlike HomePage).
#
# Usage: ./scripts/seal-version.sh <version>
#   Example: ./scripts/seal-version.sh v0.0.1
#===============================================================================

set -euo pipefail

REPO=$(git rev-parse --show-toplevel)
VER="${1:-}"

if [[ -z "$VER" ]]; then
    echo "Usage: ./scripts/seal-version.sh <version>"
    echo "  e.g.: ./scripts/seal-version.sh v0.0.1"
    exit 1
fi

CHANGELOG="$REPO/CHANGELOG.md"

# Gate: CHANGELOG entry must exist
if [[ ! -f "$CHANGELOG" ]]; then
    echo "ERROR: CHANGELOG.md not found at $CHANGELOG"
    exit 1
fi

if ! grep -q "^\## \[${VER}\]" "$CHANGELOG"; then
    echo "ERROR: No changelog entry for ${VER} in CHANGELOG.md"
    echo "Add a section: ## [${VER}] — YYYY-MM-DD"
    exit 1
fi

# Gate: version directory must exist
if [[ ! -d "$REPO/versions/$VER" ]]; then
    echo "ERROR: Version directory not found: $REPO/versions/$VER"
    exit 1
fi

# Gate: no uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "ERROR: Uncommitted changes detected. Commit everything before sealing."
    exit 1
fi

# Tag and push
git tag -a "$VER" -m "Version $VER sealed"
git push origin "$VER"

echo "Version $VER sealed and tagged."
echo ""
echo "To verify: git tag -l | grep $VER"
