#!/bin/bash
# Install brain CLI for the current user.
# Run once: ./install.sh
# After install: brain setup <API_KEY>
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${HOME}/bin"

mkdir -p "$TARGET"
cp "$SCRIPT_DIR/brain" "$TARGET/brain"
cp "$SCRIPT_DIR/brain-parse.py" "$TARGET/brain-parse.py"
chmod +x "$TARGET/brain" "$TARGET/brain-parse.py"

# Add ~/bin to PATH if not already there
if ! echo "$PATH" | grep -q "$TARGET"; then
  SHELL_RC=""
  [ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"
  [ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"
  if [ -n "$SHELL_RC" ]; then
    echo 'export PATH="$HOME/bin:$PATH"' >> "$SHELL_RC"
    echo "Added ~/bin to PATH in $SHELL_RC"
  fi
fi

echo "Installed: $TARGET/brain"
echo ""
echo "Next: brain setup <API_KEY>"
echo "Get your key at: https://mindspace.xpollination.earth/settings"
