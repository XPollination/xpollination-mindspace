#!/usr/bin/env bash
#
# Version Bump Script
# Usage: scripts/version-bump.sh <component>
#
# Reads the current version for a component from version-components.json,
# creates a new version directory (copy from current), updates symlink,
# and commits the change. No external dependencies — uses node for JSON parsing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$SCRIPT_DIR/version-components.json"

component="${1:-}"

# Helper: read JSON field using node
json_keys() { node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$REGISTRY','utf-8'))).join('\n'))"; }
json_field() { node -e "const r=JSON.parse(require('fs').readFileSync('$REGISTRY','utf-8'));const v=r['$1']?.['$2'];console.log(v===null||v===undefined?'':v)"; }
json_has() { node -e "const r=JSON.parse(require('fs').readFileSync('$REGISTRY','utf-8'));process.exit(r['$1']?0:1)"; }

if [ -z "$component" ]; then
  echo "Usage: scripts/version-bump.sh <component>"
  echo "Available components:"
  json_keys
  exit 1
fi

# Read component config from registry
if ! json_has "$component"; then
  echo "Error: Unknown component '$component'"
  echo "Available components:"
  json_keys
  exit 1
fi

VERSIONS_DIR=$(json_field "$component" "versions")
ACTIVE_SYMLINK=$(json_field "$component" "active")

VERSIONS_PATH="$REPO_ROOT/$VERSIONS_DIR"

# Find current version (highest semver minor)
CURRENT_VERSION=$(ls -d "$VERSIONS_PATH"/v*.*.* 2>/dev/null | sort -V | tail -1 | xargs basename)

if [ -z "$CURRENT_VERSION" ]; then
  echo "Error: No existing version found in $VERSIONS_PATH"
  exit 1
fi

# Parse version number and bump patch
MAJOR=$(echo "$CURRENT_VERSION" | sed 's/v\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\)/\1/')
MINOR=$(echo "$CURRENT_VERSION" | sed 's/v\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\)/\2/')
PATCH=$(echo "$CURRENT_VERSION" | sed 's/v\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\)/\3/')

NEW_PATCH=$((PATCH + 1))
NEW_VERSION="v${MAJOR}.${MINOR}.${NEW_PATCH}"

NEW_VERSION_PATH="$VERSIONS_PATH/$NEW_VERSION"

echo "Bumping $component: $CURRENT_VERSION -> $NEW_VERSION"

# Create new version directory (copy from current)
cp -r "$VERSIONS_PATH/$CURRENT_VERSION" "$NEW_VERSION_PATH"

# Update active symlink if configured
if [ -n "$ACTIVE_SYMLINK" ]; then
  SYMLINK_PATH="$REPO_ROOT/$ACTIVE_SYMLINK"
  rm -f "$SYMLINK_PATH"
  ln -s "versions/$NEW_VERSION" "$SYMLINK_PATH"
  echo "Updated symlink: $ACTIVE_SYMLINK -> versions/$NEW_VERSION"
fi

# Git add and commit
cd "$REPO_ROOT"
git add "$VERSIONS_DIR$NEW_VERSION"
if [ -n "$ACTIVE_SYMLINK" ]; then
  git add "$ACTIVE_SYMLINK"
fi
git commit -m "version: bump $component $CURRENT_VERSION -> $NEW_VERSION"

echo "Version bump complete: $NEW_VERSION"
printf '%s\n' "$NEW_VERSION"
