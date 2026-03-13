# PDSA: AGPL-3.0 Licensing — Public Readiness (v0.0.1)

**Task:** `licensing-public-readiness`
**Version:** v0.0.1
**Date:** 2026-03-13
**Author:** PDSA agent

---

## PLAN

### Problem Statement

xpollination-mindspace is now PUBLIC on GitHub. The licensing posture is incomplete:

- LICENSE file has no copyright header (just standard AGPL text)
- README.md says "MIT" (line 78) while package.json says AGPL-3.0 — **inconsistency**
- No dual-license notice for commercial users
- No NOTICE file with third-party attributions
- No automated file header injection
- XPollinationGovernance has no LICENSE file at all

### Current State

| Item | xpollination-mindspace | XPollinationGovernance |
|------|----------------------|----------------------|
| LICENSE file | AGPL-3.0 (no copyright header) | Missing |
| package.json license | `AGPL-3.0-or-later` | N/A |
| README license section | "MIT" (WRONG) | None |
| File headers | None | None |
| NOTICE file | None | None |

### Design Decisions

**D1: Add copyright header to LICENSE file.**

Standard AGPL practice: add copyright line before the license text.

```
Copyright (C) 2026 Thomas Pichler <herr.thomas.pichler@gmail.com>

This file is part of XPollination Mindspace.

XPollination Mindspace is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

XPollination Mindspace is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with XPollination Mindspace. If not, see <https://www.gnu.org/licenses/>.
```

This preamble goes above the standard AGPL-3.0 text in the LICENSE file.

**D2: Fix README.md license section.**

Replace the "MIT" line with proper AGPL-3.0 notice and dual-license text:

```markdown
## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

### Commercial License

For proprietary or commercial use without AGPL obligations, a commercial license is available.
Contact: licensing@xpollination.earth
```

**D3: Automated file header injection — recommendation.**

**Research findings:**

Three main approaches in the JS/TS ecosystem:

| Approach | Tool | Pros | Cons |
|----------|------|------|------|
| Pre-commit hook | `addlicense` (Google) | Fast, multi-language, well-maintained, Go binary | External dependency (Go binary) |
| Pre-commit hook | `license-header-checker` (npm) | Pure Node.js, npm native | Less maintained, slower |
| Lint rule | Custom ESLint rule | Part of existing lint setup | Complex to write, limited to .ts/.js |

**Recommendation: `addlicense` via pre-commit hook.**

- Google's [`addlicense`](https://github.com/google/addlicense) is the industry standard
- Install: `go install github.com/google/addlicense@latest` (requires Go, which is available on Hetzner)
- Usage: `addlicense -f header.txt -check .` (check mode) or `addlicense -f header.txt .` (apply)
- Hook: add to `.husky/pre-commit` or a simple git hook

**Alternative (if Go is not desired): shell script hook.**

A simpler approach that doesn't require Go:

```bash
#!/bin/bash
# .git/hooks/pre-commit — AGPL header check for staged .ts/.js files
HEADER="// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Thomas Pichler"

for file in $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js)$'); do
    if ! head -1 "$file" | grep -q "SPDX-License-Identifier"; then
        echo "Missing license header: $file"
        exit 1
    fi
done
```

**PDSA recommendation:** Start with SPDX headers (2 lines) + shell pre-commit hook. No external dependency. SPDX is machine-readable and sufficient for compliance.

File header format:
```
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Thomas Pichler <herr.thomas.pichler@gmail.com>
```

For shell scripts:
```
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Thomas Pichler <herr.thomas.pichler@gmail.com>
```

**D4: NOTICE file.**

All runtime dependencies are MIT-licensed:

| Package | License | Copyright |
|---------|---------|-----------|
| @modelcontextprotocol/sdk | MIT | Anthropic, PBC |
| better-sqlite3 | MIT | Joshua Wise |
| rss-parser | MIT | Bobby Brennan |
| simple-git | MIT | Steve King |
| uuid | MIT | Robert Kieffer |
| zod | MIT | Colin McDonnell |

Create `NOTICE` file:

```
XPollination Mindspace
Copyright (C) 2026 Thomas Pichler

This product includes software developed by third parties.
See below for individual copyright notices and license terms.

---

@modelcontextprotocol/sdk - MIT License
Copyright (c) Anthropic, PBC

better-sqlite3 - MIT License
Copyright (c) 2017 Joshua Wise

rss-parser - MIT License
Copyright (c) Bobby Brennan

simple-git - MIT License
Copyright (c) 2015 Steve King

uuid - MIT License
Copyright (c) 2010-2020 Robert Kieffer and other contributors

zod - MIT License
Copyright (c) 2020 Colin McDonnell
```

**D5: XPollinationGovernance LICENSE.**

Add AGPL-3.0 LICENSE file to governance repo via GitHub API (`gh api`).

**D6: Pre-commit hook installation.**

Create `.githooks/pre-commit` (not `.git/hooks/` which is gitignored) and configure:

```bash
git config core.hooksPath .githooks
```

This makes the hook portable — anyone cloning the repo gets it automatically.

**D7: No retroactive file headers.**

Do NOT add headers to all existing files in this task. The pre-commit hook enforces headers going forward. Retroactive bulk addition would create a massive diff that pollutes git blame. Instead:
- Install the hook
- Add headers to a few example files to demonstrate
- Document that new/modified files will get headers on commit

### Execution Steps

1. **Add copyright preamble to LICENSE** — insert before AGPL text
2. **Fix README.md** — replace "MIT" with AGPL-3.0 + dual-license notice
3. **Create NOTICE file** — third-party attributions
4. **Create `.githooks/pre-commit`** — SPDX header check for staged .ts/.js/.sh files
5. **Configure git hooks path** — `git config core.hooksPath .githooks`
6. **Add headers to example files** — `src/index.ts`, `src/db/interface-cli.js`, one .sh script
7. **Add LICENSE to XPollinationGovernance** — via `gh api`
8. **Update package.json** if needed (already correct: `AGPL-3.0-or-later`)

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `LICENSE` | **MODIFY** | Add copyright preamble |
| `README.md` | **MODIFY** | Fix license section, add dual-license |
| `NOTICE` | **CREATE** | Third-party attributions |
| `.githooks/pre-commit` | **CREATE** | SPDX header enforcement |
| `src/index.ts` | **MODIFY** | Add SPDX header (example) |
| `src/db/interface-cli.js` | **MODIFY** | Add SPDX header (example) |
| XPollinationGovernance LICENSE | **CREATE** (via gh API) | AGPL-3.0 for governance repo |

### Verification Plan

1. `head -3 LICENSE` — shows copyright preamble
2. `grep -c "AGPL-3.0" README.md` — > 0
3. `grep -c "MIT" README.md` — 0 (removed)
4. `grep "licensing@xpollination.earth" README.md` — dual-license contact present
5. `test -f NOTICE` — exists
6. `grep "@modelcontextprotocol/sdk" NOTICE` — attribution present
7. `test -x .githooks/pre-commit` — hook exists and is executable
8. `git config core.hooksPath` — returns `.githooks`
9. `head -2 src/index.ts` — shows SPDX header
10. `gh api repos/XPollination/XPollinationGovernance/contents/LICENSE --jq '.name'` — LICENSE exists

### Risks

**R1: Pre-commit hook blocks agent commits.** Agents create new files without headers. Mitigation: hook only checks staged files matching `.ts/.js/.sh`, and agents can bypass with `--no-verify` if needed. But this conflicts with CLAUDE.md rule "never skip hooks." Resolution: add header to agent-created files in the same commit.

**R2: Existing file header conflicts.** Some files may already have banners/shebangs. Mitigation: SPDX goes after shebang line for .sh files, first line for .ts/.js.

**R3: GitHub Pages / README rendering.** Dual-license section must render correctly on GitHub. Mitigation: standard markdown, tested with existing GitHub rendering.

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
