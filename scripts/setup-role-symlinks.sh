#!/bin/bash
# Setup role symlinks for xpo.agent.connect skill
# Creates connect.as.{role} symlinks that the skill reads to extract the agent role

SKILL_DIR="${1:-$HOME/.claude/skills/xpo.agent.connect}"

# Create symlinks for each role: pdsa, dev, qa, liaison
for role in pdsa dev qa liaison; do
  ln -sf "$SKILL_DIR/SKILL.md" "$SKILL_DIR/connect.as.${role}"
  echo "Created symlink: connect.as.${role} -> SKILL.md"
done

echo "Role symlinks created in $SKILL_DIR"
