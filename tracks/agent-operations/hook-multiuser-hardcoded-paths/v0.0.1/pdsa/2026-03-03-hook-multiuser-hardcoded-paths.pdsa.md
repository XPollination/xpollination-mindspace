# PDSA: hook-multiuser-hardcoded-paths v0.0.1

**Date:** 2026-03-03
**Author:** PDSA Agent
**Task:** Refactor hooks and scripts: replace hardcoded /home/developer paths for multi-user support
**Status:** Design

---

## PLAN

### Problem Statement

All XPO hook scripts and `claude-session.sh` hardcode `/home/developer` paths. Robin (second user) cannot use the brain system on his own setup until these paths are replaced with portable alternatives. The parent task `userpromptsubmit-hook-broken` is complete but single-user only.

### Inventory: 30+ Hardcoded Paths Across 10 Files

**Category 1: Brain API key (3 hook scripts)**
| File | Line | Current |
|------|------|---------|
| `brain-first-hook.sh` | 20 | `/home/developer/.brain-api-key` |
| `precompact-save.sh` | 28 | `/home/developer/.brain-api-key` |
| `compact-recover.sh` | 23 | `/home/developer/.brain-api-key` |

**Category 2: Project workspace base path (2 files)**
| File | Line | Current |
|------|------|---------|
| `precompact-save.sh` | 31 | `/home/developer/workspaces/github/PichlerThomas` |
| `claude-session.sh` | 65 | `/home/developer/workspaces/github/PichlerThomas` |

**Category 3: Claude session infrastructure (claude-session.sh)**
| Line | Variable | Current |
|------|----------|---------|
| 64 | `CLAUDE_BIN` | `/home/developer/.local/bin/claude` |
| 66 | `SELF_PATH` | `/home/developer/workspaces/.../claude-session.sh` |
| 194 | `SKILLS_SRC` | `/home/developer/workspaces/.../xpollination-best-practices/.claude/skills` |
| 195 | `SKILLS_DST` | `/home/developer/.claude/skills` |
| 196 | `SETTINGS_TEMPLATE` | `/home/developer/workspaces/.../xpo.claude.settings.json` |
| 197 | `SYNC_SETTINGS_SCRIPT` | `/home/developer/workspaces/.../xpo.claude.sync-settings.js` |
| 198 | `NVM_NODE` | `/home/developer/.nvm/versions/node/v22.22.0/bin` |
| 340 | (inline) | `/home/developer/.brain-api-key` |

**Category 4: Settings template (xpo.claude.settings.json)**
| Line | Current |
|------|---------|
| 9 | `/home/developer/workspaces/.../xpo.claude.compact-recover.sh` |

**Category 5: Deploy/provision scripts (best-practices)**
| File | Line | Current |
|------|------|---------|
| `provision-user.sh` | 15 | `/home/developer/.../best-practices/data/thought-tracing.db` (path also incorrect — missing `xpollination-` prefix) |
| `deploy-brain-api.sh` | 13 | `/home/developer/.../xpollination-best-practices` |
| `migrate-thomas-alias.sh` | 12 | `/home/developer/.../best-practices/data/thought-tracing.db` (same incorrect path) |
| `test-reflection-skill.sh` | 27 | `/home/developer/.../xpollination-best-practices/.claude/skills/...` |

---

## DO — Design

### Principle: `$HOME` for home-relative, env vars for workspace

All paths fall into two categories:
1. **Home-relative**: `~/.brain-api-key`, `~/.claude/skills`, `~/.local/bin/claude` → use `$HOME`
2. **Workspace-relative**: project repos, scripts → use `$XPO_WORKSPACE` env var with auto-detection fallback

### Sub-Problem 1: Hook Scripts (3 files in best-practices/scripts/)

**Fix:** Replace `/home/developer/.brain-api-key` with `$HOME/.brain-api-key`.

All 3 hook scripts already use the pattern `${BRAIN_API_KEY:-$(cat ... 2>/dev/null || echo "")}`. Change the cat path:

```bash
# brain-first-hook.sh line 20, precompact-save.sh line 28, compact-recover.sh line 23
BRAIN_API_KEY="${BRAIN_API_KEY:-$(cat "$HOME/.brain-api-key" 2>/dev/null || echo "")}"
```

### Sub-Problem 2: precompact-save.sh Workspace Base Path

**Current (line 31):**
```bash
BASE="/home/developer/workspaces/github/PichlerThomas"
```

**Fix:**
```bash
BASE="${XPO_WORKSPACE:-$HOME/workspaces/github/PichlerThomas}"
```

Uses `XPO_WORKSPACE` env var if set, falls back to `$HOME`-relative path. The fallback preserves the `workspaces/github/PichlerThomas` convention — Robin would set `XPO_WORKSPACE` to his own path.

### Sub-Problem 3: claude-session.sh (10 hardcoded paths)

**Fix all variables to use `$HOME` and env var overrides:**

```bash
# Line 64: Claude binary
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"

# Line 65: Working directory (repo workspace root)
WORKING_DIR="${XPO_WORKSPACE:-$HOME/workspaces/github/PichlerThomas}"

# Line 66: Self path — auto-detect via $0 or BASH_SOURCE
SELF_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

# Line 194-197: Skills and settings paths — derive from WORKING_DIR
SKILLS_SRC="$WORKING_DIR/xpollination-best-practices/.claude/skills"
SKILLS_DST="$HOME/.claude/skills"
SETTINGS_TEMPLATE="$WORKING_DIR/xpollination-best-practices/scripts/xpo.claude.settings.json"
SYNC_SETTINGS_SCRIPT="$WORKING_DIR/xpollination-best-practices/scripts/xpo.claude.sync-settings.js"

# Line 198: NVM node — auto-detect instead of hardcoding version
NVM_NODE="$(dirname "$(which node)")"

# Line 340: Brain API key
cat "$HOME/.brain-api-key"
```

### Sub-Problem 4: Settings Template (xpo.claude.settings.json)

**Current (line 9):** Full hardcoded path to `compact-recover.sh`.

**Fix:** The `sync-settings.js` script already copies the template to `~/.claude/settings.json`. Modify `sync-settings.js` to perform path substitution at sync time:

```javascript
// In sync-settings.js, after reading template:
const home = process.env.HOME || '/home/developer';
const workspace = process.env.XPO_WORKSPACE || `${home}/workspaces/github/PichlerThomas`;
let content = JSON.stringify(template);
content = content.replace(/\/home\/developer/g, home);
// Parse back and merge with existing settings
```

The template itself should use a placeholder like `__HOME__` or keep `/home/developer` and let `sync-settings.js` substitute. Using `__HOME__` is cleaner:

```json
"command": "__XPO_WORKSPACE__/xpollination-best-practices/scripts/xpo.claude.compact-recover.sh"
```

And `sync-settings.js` replaces `__XPO_WORKSPACE__` with the actual path at sync time.

### Sub-Problem 5: Deploy/Provision Scripts (best-practices)

**provision-user.sh line 15:**
```bash
# Fix path (currently incorrect: "best-practices" → should be "xpollination-best-practices")
BRAIN_DB="${BRAIN_DB_PATH:-$HOME/workspaces/github/PichlerThomas/xpollination-best-practices/data/thought-tracing.db}"
# Better: derive from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_DB="${BRAIN_DB_PATH:-$SCRIPT_DIR/../../data/thought-tracing.db}"
```

**deploy-brain-api.sh line 13:** Same pattern — derive from `$BASH_SOURCE` or `$XPO_WORKSPACE`.

**migrate-thomas-alias.sh line 12:** Same fix as provision-user.sh (also has the incorrect `best-practices` path).

**test-reflection-skill.sh line 27:** Derive from `$XPO_WORKSPACE` or `$BASH_SOURCE`.

### Sub-Problem 6: Environment Variable Convention

| Variable | Purpose | Default |
|----------|---------|---------|
| `$HOME` | User home directory | (set by OS) |
| `$XPO_WORKSPACE` | Project workspace root containing all repos | `$HOME/workspaces/github/PichlerThomas` |
| `$CLAUDE_BIN` | Claude binary path | `$HOME/.local/bin/claude` |
| `$BRAIN_API_KEY` | Brain API authentication key | contents of `$HOME/.brain-api-key` |
| `$BRAIN_DB_PATH` | Brain database file path | auto-detected from script location |
| `$NVM_NODE` | Node.js binary directory | `$(dirname "$(which node)")` |

Robin onboarding: set `XPO_WORKSPACE=/home/robin/workspaces/github/Robin` in his shell profile. Everything else auto-detects from `$HOME`.

---

## Files to Modify

| File | Repo | Changes |
|------|------|---------|
| `scripts/xpo.claude.brain-first-hook.sh` | best-practices | `$HOME/.brain-api-key` |
| `scripts/xpo.claude.precompact-save.sh` | best-practices | `$HOME/.brain-api-key`, `$XPO_WORKSPACE` base |
| `scripts/xpo.claude.compact-recover.sh` | best-practices | `$HOME/.brain-api-key` |
| `scripts/xpo.claude.settings.json` | best-practices | `__XPO_WORKSPACE__` placeholder |
| `scripts/xpo.claude.sync-settings.js` | best-practices | Path substitution at sync time |
| `api/scripts/provision-user.sh` | best-practices | Fix path bug + `$BASH_SOURCE` derivation |
| `api/scripts/migrate-thomas-alias.sh` | best-practices | Fix path bug + `$BASH_SOURCE` derivation |
| `scripts/deploy-brain-api.sh` | best-practices | `$XPO_WORKSPACE` |
| `scripts/test-reflection-skill.sh` | best-practices | `$XPO_WORKSPACE` |
| `claude-session.sh` | HomeAssistant | All 10 hardcoded paths |

**Cross-repo note:** Most files are in `xpollination-best-practices`. `claude-session.sh` is in `HomeAssistant`. Changes span 2 repos.

---

## STUDY — Verification Plan

| AC | How to verify |
|----|---------------|
| 1. Hook scripts use `$HOME/.brain-api-key` | `grep -r '/home/developer' scripts/xpo.claude.*.sh` returns 0 hits |
| 2. precompact-save.sh base path configurable | `XPO_WORKSPACE=/tmp/test bash precompact-save.sh` uses `/tmp/test` |
| 3. claude-session.sh no hardcoded paths | `grep -c '/home/developer' claude-session.sh` returns 0 (excluding comments) |
| 4. sync-settings.js substitutes paths | Generated `~/.claude/settings.json` contains `$HOME`-resolved paths |
| 5. provision-user.sh fallback uses `$HOME` | Script works without hardcoded path |
| 6. Robin can run the toolchain | End-to-end: provision → claude-session → brain hooks fire |
| 7. Zero grep hits | `grep -rn '/home/developer' scripts/ claude-session.sh` returns only comments |

---

## ACT — Decisions

- **`$XPO_WORKSPACE` is the key new env var.** Simple, descriptive, consistent with existing `XPO_` prefix (e.g., `XPO_WORKSPACE_PATH` already used by viz server).
- **`$HOME` for all home-relative paths.** Standard, portable, always set.
- **`$BASH_SOURCE` for script-relative paths.** Deploy scripts should find their own DB/config relative to their location, not from absolute paths.
- **Template placeholders (`__XPO_WORKSPACE__`) for settings.json.** The sync script substitutes at install time. This keeps the template generic.
- **No breaking changes for Thomas.** All env vars have defaults matching current `/home/developer` paths. Thomas's setup continues to work without setting any new env vars.
- **Cross-repo changes:** Most in best-practices, one in HomeAssistant. Both repos need commits.
