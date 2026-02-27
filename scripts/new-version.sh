#!/bin/bash
#===============================================================================
# new-version.sh — Create a new version for code+docs projects
#
# Adapted from HomePage pattern. Versions knowledge artifacts (docs, pdsa, spec)
# while source code stays at root.
#
# Usage: ./scripts/new-version.sh <new-version>
#   Example: ./scripts/new-version.sh v0.0.2
#===============================================================================

set -euo pipefail

REPO=$(git rev-parse --show-toplevel)
NEW_VER="${1:-}"

if [[ -z "$NEW_VER" ]]; then
    echo "Usage: ./scripts/new-version.sh <new-version>"
    echo "  e.g.: ./scripts/new-version.sh v0.0.2"
    exit 1
fi

NEW_DIR="$REPO/versions/$NEW_VER"

if [[ -d "$NEW_DIR" ]]; then
    echo "ERROR: $NEW_DIR already exists"
    exit 1
fi

# Determine current version from docs symlink
if [[ ! -L "$REPO/docs" ]]; then
    echo "ERROR: $REPO/docs is not a symlink — cannot determine current version"
    exit 1
fi

CURRENT_TARGET=$(readlink "$REPO/docs")
CURRENT_VER=$(echo "$CURRENT_TARGET" | sed 's|versions/||; s|/docs||')

if [[ ! -d "$REPO/versions/$CURRENT_VER" ]]; then
    echo "ERROR: Current version directory not found: $REPO/versions/$CURRENT_VER"
    exit 1
fi

echo "Creating $NEW_VER from $CURRENT_VER..."

# Create new version with knowledge artifact structure
mkdir -p "$NEW_DIR/docs"
mkdir -p "$NEW_DIR/pdsa"
mkdir -p "$NEW_DIR/spec"

# Copy docs and spec from current version (carry forward knowledge)
if [ -d "$REPO/versions/$CURRENT_VER/docs" ]; then
    cp -r "$REPO/versions/$CURRENT_VER/docs/"* "$NEW_DIR/docs/" 2>/dev/null || true
fi
if [ -d "$REPO/versions/$CURRENT_VER/spec" ]; then
    cp -r "$REPO/versions/$CURRENT_VER/spec/"* "$NEW_DIR/spec/" 2>/dev/null || true
fi
# pdsa/ starts empty (new version, new work)

# Update symlinks
ln -sfn "versions/$NEW_VER/docs" "$REPO/docs"
if [ -L "$REPO/spec" ]; then
    ln -sfn "versions/$NEW_VER/spec" "$REPO/spec"
fi

echo "Created $NEW_VER from $CURRENT_VER"
echo "Symlinks updated -> $NEW_VER"
echo ""
echo "Next steps:"
echo "  1. git add versions/$NEW_VER/ docs spec"
echo "  2. git commit -m 'infra: create $NEW_VER from $CURRENT_VER'"
echo "  3. git push"
