# PDSA: Role Symlinks (connect.as.pdsa, .dev, .qa, .liaison)

**Task:** ms-a11-9-role-symlinks
**Status:** Design
**Version:** v0.0.1

## Plan

Create symlinks that allow role-specific invocation of the central agent connect skill. Each symlink triggers the same skill but with the role extracted from the symlink name.

### Dependencies

- **ms-a11-8-central-skill** (complete): Central /xpo.agent.connect/ skill

### Investigation

**DNA description:** Create symlinks: ln -s /xpo.agent.connect/ /xpo.agent.connect.as.pdsa (etc for dev, qa, liaison). Each symlink triggers central skill with role extracted from name.

**Current central skill location:** `skills/xpo.agent.connect/SKILL.md`

**Design decisions:**
- Symlinks are Claude Code skill directory symlinks, not filesystem command symlinks
- Each role gets a directory: `skills/xpo.agent.connect.as.pdsa/` → symlink to `skills/xpo.agent.connect/`
- The central skill already supports role detection from invocation name suffix
- Create a setup script that creates all 4 symlinks
- Roles: pdsa, dev, qa, liaison
- Installation: script creates symlinks in `~/.claude/skills/`

## Do

### File Changes

#### 1. `scripts/setup-role-symlinks.sh` (NEW)

```bash
#!/bin/bash
# Create role-specific symlinks for the central agent connect skill.
# Usage: bash scripts/setup-role-symlinks.sh

SKILL_DIR="${HOME}/.claude/skills"
SOURCE="xpo.agent.connect"

for role in pdsa dev qa liaison; do
  LINK_NAME="xpo.agent.connect.as.${role}"
  LINK_PATH="${SKILL_DIR}/${LINK_NAME}"

  # Remove existing symlink if present
  if [ -L "${LINK_PATH}" ]; then
    rm "${LINK_PATH}"
  fi

  # Create symlink to source skill directory
  ln -s "${SKILL_DIR}/${SOURCE}" "${LINK_PATH}"
  echo "Created: ${LINK_NAME} → ${SOURCE}"
done

echo "All role symlinks created."
```

#### 2. `skills/xpo.agent.connect/SKILL.md` (UPDATE — verify role extraction)

The existing skill should already handle role extraction from the invocation name. Verify this section exists:

```markdown
## Role Detection

The skill detects its role from the invocation name:
- `/xpo.agent.connect` → prompts for role
- `/xpo.agent.connect.as.pdsa` → role = pdsa
- `/xpo.agent.connect.as.dev` → role = dev
- `/xpo.agent.connect.as.qa` → role = qa
- `/xpo.agent.connect.as.liaison` → role = liaison

Role is extracted by parsing the skill name after "connect.as."
```

## Study

### Test Cases (6 total)

**Symlink creation (3):**
1. Script creates all 4 role symlinks
2. Symlinks point to correct source directory
3. Running script twice is idempotent (replaces existing)

**Role detection (3):**
4. /xpo.agent.connect.as.pdsa invocation sets role=pdsa
5. /xpo.agent.connect.as.dev invocation sets role=dev
6. /xpo.agent.connect without role suffix prompts for role

## Act

### Deployment

- 1 file: scripts/setup-role-symlinks.sh (NEW)
- 1 file: skills/xpo.agent.connect/SKILL.md (UPDATE — verify role extraction)
- Run: `bash scripts/setup-role-symlinks.sh` on target machine
- No migration, no API changes
