---
name: xpo.claude.mindspace.pm.status
description: Programme Management status overview across all projects
user-invocable: true
allowed-tools: Bash, Read
version: 0.0.3
---

# PM Status — Cross-Project Overview

Single command to scan all project databases, present a categorized summary, then drill down into each actionable task one-by-one for human decisions.

```
/xpo.claude.mindspace.pm.status
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `layer1_enabled` | `true` | Enable Brain Health gardening phase. Set to `false` to skip brain health diagnostic entirely. |

When `layer1_enabled` is `false`, skip Step 1.5 (Brain Health) and proceed directly from Step 1 to Step 2.

---

## Rendering Style Guide

Consistent markdown rendering rules for all LIAISON output in this skill:

1. **Bold headers** — ALL CAPS section names: `MANAGEMENT ABSTRACT`, `WHAT WAS DONE`, `REVIEW CHAIN`, `SCOPE & RISK`, `RECOMMENDATION`
2. **Bold status indicators** — `**PASS**`, `**FAIL**`, `**APPROVE**`, `**REWORK**`
3. **Backtick technical identifiers** — task slugs (`task-slug`), branch names (`develop`), commit hashes (`abc1234`), file paths (`SKILL.md`), port numbers (`4100`)
4. **Evaluative RECOMMENDATION tone** — LIAISON recommends with conviction, not hedging. "APPROVE — clean implementation, all tests pass" not "This could potentially be approved if..."
5. **ALL CAPS section headers** — MANAGEMENT ABSTRACT, WHAT WAS DONE, REVIEW CHAIN, SCOPE & RISK, RECOMMENDATION

---

## Step 1: Scan Projects + Brain Health

Run the pm-status script to scan all project databases AND get brain health in one command:

```bash
node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/pm-status.cjs
```

This returns JSON with:
- `projects`: all tasks from xpollination-best-practices, xpollination-mcp-server, and HomePage
- `brain_health`: status, recent thought count, highway count, top domains

Parse and present. Brain health section is always included — no separate step needed.

Collect all non-terminal tasks (exclude `complete`, `cancelled`) from the projects output.

Present brain health as a **BRAIN HEALTH** section:

```
=== BRAIN HEALTH ===
Status: healthy | empty | unavailable
Recent thoughts: N
Highways: N
Top domains: domain1, domain2, ...
===
```

If brain health shows issues, Thomas may choose to run a deeper gardening pass (`/xpo.claude.mindspace.garden full deep`).

## Step 2: Phase 1 — Summary Table

Present a compact overview grouped by action type:

```
=== PM STATUS (YYYY-MM-DD HH:MM) ===

DECISIONS NEEDED (approval — approve or rework):
  [1] task-slug (project) — approval+role

REVIEWS PENDING (review+liaison — complete or rework):
  [2] task-slug (project) — review+liaison

IN PIPELINE (no action needed now):
  [3] task-slug (project) — status+role
  [4] task-slug (project) — status+role

--- Summary: N tasks | X approvals | Y reviews | Z in-pipeline ---
```

**Categorization rules:**
- Status `approval` → **DECISIONS NEEDED** (human approves or sends to rework)
- Status `review` AND role `liaison` → **REVIEWS PENDING** (human completes or reworks)
- All other non-terminal → **IN PIPELINE** (informational, no action needed)

**Auto-proceed:** After presenting the summary, proceed immediately to Phase 2 sequential task review. Do not pause or ask any questions — Thomas always wants the detailed walkthrough. Skip straight to the first actionable task.

## Step 3: Phase 2 — Hybrid Review (Individual + Themed Batches)

Before presenting tasks one-by-one, analyze all actionable tasks and group them for efficient review. This hybrid pattern reduces confirmation stops while keeping Thomas fully informed.

### Step 3a: Analyze and Group Actionable Tasks

Collect all tasks from DECISIONS NEEDED + REVIEWS PENDING. Group them by theme or capability area:

**Grouping criteria:**
- Same project AND same capability/feature area (e.g., "viz improvements", "API endpoints", "infrastructure")
- Same review outcome pattern (e.g., all PASS from QA+PDSA)
- Related task slugs (shared prefix like `ms-a3-*`, `h1-*`)

**Individual drill-down** (always presented one-by-one with full detail):
- Tasks with **FAIL** in any review — always get individual treatment
- Tasks with VIOLATION or WARN in verification checks
- High-impact or unique tasks that don't fit a group

**Themed Batch review** (presented as a group with full abstracts, minimum 1 task per batch, typical 1-4):
- 1-4 related tasks with PASS outcomes from all reviewers
- Same theme/capability area
- Similar scope and risk profile

### Step 3b: Prepare Batches (with Progress Feedback)

**The batch preparation IS the value** — consolidating all facts from DNA, review chains, branch compliance, and verification checks so Thomas can make rapid decisions. Frame this explicitly:

Before fetching DNA and running checks, output a progress header:
```
Consolidating task details for efficient review...
```

During batch preparation (DNA fetching, verification checks), output human-digestible progress updates:
```
Preparing batch 1 of 4... fetching DNA (3/18)... running branch compliance...
Preparing batch 1 of 4... fetching DNA (8/18)... checking versioning...
Preparing batch 2 of 4... fetching DNA (12/18)...
Batch preparation complete. Presenting 4 groups for review.
```

Update progress after each significant step (DNA fetch per task, each verification check). Show counts and percentages where possible. The goal: Thomas always sees work is happening during the 1-3 minute preparation phase.

### Step 3c: Present Groups

**For individual tasks:** Use the full drill-down format below (same as v0.0.2).

**For Themed Batch groups:** Present each task with a full management abstract (NOT just a table row). Each task within the batch gets its own mini-abstract so Thomas has complete context for every decision:

```
=== Themed Batch: <Theme Name> (N tasks) ===
Consolidating N related tasks — all QA **PASS**, PDSA **PASS**

**Task 1: <title>**
Slug: `task-slug-1` | Priority: high
MANAGEMENT ABSTRACT
<2-3 sentence summary — WHAT happened, WHY it matters, WHAT was done.>
REVIEW CHAIN: QA **PASS** (<one-line>), PDSA **PASS** (<one-line>)
RECOMMENDATION: **APPROVE** — <1 sentence rationale>

**Task 2: <title>**
Slug: `task-slug-2` | Priority: medium
MANAGEMENT ABSTRACT
<2-3 sentence summary>
REVIEW CHAIN: QA **PASS** (<one-line>), PDSA **PASS** (<one-line>)
RECOMMENDATION: **APPROVE** — <1 sentence rationale>

BATCH SCOPE & RISK
- Scope: <On-scope / Expanded / Reduced> — <what these tasks share as a group>
- Risk: <Low / Medium / High> — <brief rationale covering the batch>
- Impact: <What this group of changes means for the system>
- Common theme: <what ties these tasks together>

Options:
1. **Approve All** (Recommended) — All N tasks pass review chain, on-scope, low risk
2. **Review Individually** — Expand each task for full Step 3d drill-down before deciding
===
```

Confirmation stops happen at **group boundaries** — not per task. This means:
- Each individual task = 1 confirmation stop
- Each themed batch = 1 confirmation stop (for the whole group)
- Thomas can choose "Review Individually" to fall back to per-task review within a batch

### Step 3d: Individual Task Drill-Down

For each individual task (or when Thomas selects "Review Individually" for a batch):

1. **Check current LIAISON approval mode BEFORE each task:**
   ```bash
   curl -s http://localhost:4100/api/settings/liaison-approval-mode
   ```
   Thomas can change the mode at any time via the viz. NEVER cache or assume the mode — always check fresh before each decision.

2. **Get full DNA:**
   ```bash
   DATABASE_PATH=$DB node $CLI get <slug>
   ```

3. **Run automated verification checks** (between DNA retrieval and presentation):

   **BRANCH COMPLIANCE** — For tasks with commit hashes in DNA (implementation, changelog_ref fields):
   - Extract commit hashes (7+ char hex like `abc1234` or full 40-char SHA)
   - Run `git branch --contains <commit>` for each hash
   - If commit exists ONLY on `main` → **VIOLATION** (work was committed to main, not develop/feature branch)
   - If commit exists on `develop` or `feature/*` → **OK**
   - If no commits in DNA → **N/A**

   **VERSIONING** — For tasks with `tracks/` artifacts:
   - Check if `tracks/process/<slug>/v[0-9].*` directories exist
   - Verify semver pattern (v0.0.X)
   - Check for PDSA.md and changelog.md presence in version directories
   - Found with proper structure → **OK** (e.g., "v0.0.2, PDSA.md present")
   - Missing changelog.md → **WARN** ("no changelog.md")
   - No tracks/ dir → **N/A**

   **REF VALIDATION** — For tasks with `pdsa_ref`, `changelog_ref`, or `abstract_ref` URLs:
   - Verify GitHub URLs point to the correct project repo
   - Extract repo name from URL (e.g., `github.com/PichlerThomas/<repo>/...`)
   - If repo name doesn't match the task's project → **WARN** ("repo mismatch: pdsa_ref points to wrong repo")
   - If URLs are valid and match → **OK**
   - If no ref URLs → **N/A**

   **DEPLOYMENT VERIFICATION** — For tasks in xpollination-mcp-server that involve viz versions:
   - Read current active symlink: `readlink viz/active`
   - Find latest version directory: `ls -d viz/versions/v*/ | sort -V | tail -1`
   - If active symlink points to an older version than the latest directory → **WARN** ("active=v0.0.9, latest=v0.0.10 — deployment gap")
   - If active matches latest → **OK**
   - If no viz/active symlink or no viz/versions/ → **N/A**

   Add these results as headers after the breadcrumb in the presentation:
   ```
   BRANCH COMPLIANCE: OK | VIOLATION (commit abc1234 only on main) | N/A
   VERSIONING: OK (v0.0.2, PDSA.md present) | WARN (no changelog.md) | N/A
   REF VALIDATION: OK | WARN (pdsa_ref points to wrong repo) | N/A
   DEPLOYMENT: OK | WARN (active=v0.0.9, latest=v0.0.10) | N/A
   ```

   If any check shows VIOLATION or WARN, include it in the RECOMMENDATION section with suggested remediation.

4. **Present to Thomas using the structured format with workflow breadcrumb:**

   LIAISON evaluates the DNA and **thinks** — do not dump raw fields. Synthesize the information into this structure.

   **Workflow breadcrumb:** Add a pipeline phase breadcrumb above each task showing where it currently sits. Current phase is marked with `>>>` and `<<<` arrows. Use `>` separators between phases.

   **Status-to-phase mapping:**

   | Status + Role | Pipeline Phase |
   |--------------|----------------|
   | pending, ready (role=pdsa) | DESIGN QUEUE |
   | active (role=pdsa) | DESIGNING |
   | approval | HUMAN APPROVAL |
   | approved, active (role=qa) | TESTING |
   | ready, active (role=dev) | IMPLEMENTING |
   | review (role=qa) | QA REVIEW |
   | review (role=pdsa) | PDSA REVIEW |
   | review (role=liaison) | HUMAN REVIEW |
   | complete | COMPLETE |

   Breadcrumb line: `DESIGN QUEUE > DESIGNING > HUMAN APPROVAL > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > HUMAN REVIEW > COMPLETE` — with the current phase **bolded** and marked with `>>>PHASE<<<`.

   ```
   === Task N of M: <title> ===
   **Slug:** `task-slug`
   **Phase:** HUMAN REVIEW ← YOU ARE HERE
   DESIGN QUEUE > DESIGNING > HUMAN APPROVAL > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > >>>**HUMAN REVIEW**<<< > COMPLETE
   BRANCH COMPLIANCE: OK | VIOLATION (commit abc1234 only on main) | N/A
   VERSIONING: OK (v0.0.2, PDSA.md present) | WARN (no changelog.md) | N/A
   REF VALIDATION: OK | WARN (pdsa_ref points to wrong repo) | N/A
   DEPLOYMENT: OK | WARN (active=v0.0.9, latest=v0.0.10) | N/A
   Type: <task type> | Priority: <priority> | Project: <project>
   Status: <status+role> → Action: Approve/Complete or Rework?

   MANAGEMENT ABSTRACT
   <2-3 sentence executive summary for the decision-maker.
   WHAT happened, WHY it matters, WHAT was done.
   Written in plain language, not technical jargon.>

   WHAT WAS DONE
   - <Key implementation/design points>
   - <Commits or deliverables if available>
   - <changelog_ref link if present in DNA>

   REVIEW CHAIN
   | Reviewer | Result | Key Finding |
   |----------|--------|-------------|
   | QA       | **PASS**/FAIL | <one-line summary> |
   | PDSA     | **PASS**/FAIL | <one-line summary> |

   SCOPE & RISK
   - Scope: <On-scope / Expanded / Reduced>
   - Risk: <Low / Medium / High> — <brief rationale>
   - Impact: <What this changes for the system>

   RECOMMENDATION
   **APPROVE** or **REWORK** — <1-2 sentence rationale from LIAISON's evaluation>
   ===
   ```

   **Rules:**
   - LIAISON **evaluates and recommends** — Thomas decides, LIAISON thinks.
   - Management Abstract FIRST — decision context before technical data.
   - Review Chain: "—" / "Pending" if reviewer hasn't reviewed yet.
   - Omit empty sections. `approval` tasks: WHAT WAS DONE = design. `review+liaison` tasks: WHAT WAS DONE = implementation.

   **Examples:** See `EXAMPLES.md` in this skill directory if presentation quality needs recalibration.

5. **Behave according to current mode:**

   **AUTO mode:** Execute the transition immediately after presenting. Add `liaison_reasoning` to DNA documenting the decision rationale. No human interaction needed.

   **SEMI mode:** Present the task details, then use AskUserQuestion to capture Thomas's decision with selectable options.

   **Recommendation options pattern (CRITICAL):**
   - The FIRST option is LIAISON's recommendation, labeled with `(Recommended)` suffix
   - Its description explains WHY LIAISON recommends this — concrete reasoning (test counts, review results, scope assessment)
   - The SECOND option is the alternative path, with a description explaining WHEN/WHY someone might choose it — argue whether it makes sense
   - Thomas sees both options and understands the trade-off without needing to ask follow-up questions

   Example:
   ```
   Option 1: "Complete (Recommended)" — "LIAISON recommends: 18/18 tests pass, QA+PDSA pass, clean implementation. Unblocks 15+ downstream tasks."
   Option 2: "Rework" — "Only if you want auto-run on server start instead of explicit migration step. No issues identified by review chain."
   ```

   - Wait for Thomas's selection. Do NOT proceed until a response is received. Do NOT assume any answer.

   **MANUAL mode:** Present the task details. Tell Thomas to click Confirm in the mindspace viz. STOP and wait for Thomas to confirm he has clicked. Then execute the transition.

6. **Execute the transition** based on decision:
   - Approve: `DATABASE_PATH=$DB node $CLI transition <slug> approved liaison`
   - Complete: `DATABASE_PATH=$DB node $CLI transition <slug> complete liaison`
   - Rework: `DATABASE_PATH=$DB node $CLI transition <slug> rework liaison`

7. **Only then** present the next task.

**CRITICAL: Never present all task details at once.** The summary is the map. Phase 2 is the decision flow — one task at a time.

## Step 4: Wrap Up

After all actionable tasks are presented and decided:
- Show remaining IN PIPELINE tasks (brief, no drill-down)
- End with: "All actionable items addressed. N tasks remain in pipeline."

---

## Deployment Action Guidance

When a task involves a new viz version (v0.0.X) that needs deployment, LIAISON guides the deployment:

**Current infrastructure:**
- TEST: mindspace-test.service, port 4200, develop branch worktree
- PROD: mindspace.service, port 4100, main branch (VPN-only)

**Options to present to Thomas:**
- "Deploy to TEST (4200)" — updates symlink in develop worktree, restarts mindspace-test.service
- "Deploy to PROD (4100)" — updates symlink in main worktree, restarts mindspace.service
- "Skip deployment" — leave as-is

**Execution (PROD deployment):**
```bash
# 1. Update symlink in main worktree
ln -sfn versions/v0.0.X <main-repo-path>/viz/active

# 2. Restart service (requires thomas user)
sshpass -p '<password>' ssh thomas@localhost "systemctl restart mindspace.service"

# 3. Verify
curl -s http://localhost:4100/api/version
```

---

## Good Example

Good example of a complete Phase 2 drill-down presentation:

```
=== Task 1 of 2: Badge Color Contrast Fix ===
**Slug:** `badge-color-contrast-fix`
**Phase:** HUMAN REVIEW ← YOU ARE HERE
DESIGN QUEUE > DESIGNING > HUMAN APPROVAL > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > >>>**HUMAN REVIEW**<<< > COMPLETE
BRANCH COMPLIANCE: OK (commit `2d7a130` on `develop`)
VERSIONING: OK (v0.0.10, changelog.json present)
REF VALIDATION: OK
DEPLOYMENT: **WARN** (active=v0.0.9, latest=v0.0.10 — deployment gap)
Type: task | Priority: high | Project: xpollination-mcp-server
Status: review+liaison → Action: Complete or Rework?

MANAGEMENT ABSTRACT
Badge colors in the dependency detail panel were unreadable — light backgrounds
with white text failed WCAG AA contrast. v0.0.10 darkens all 13 badge backgrounds
and adds explicit color: #fff for reliable contrast.

WHAT WAS DONE
- Created v0.0.10 from v0.0.9 copy
- Darkened backgrounds: active (#166534), testing (#065f46), etc.
- Added explicit color: #fff to all 13 status badge classes
- Commit `2d7a130` on `develop`

REVIEW CHAIN
| Reviewer | Result | Key Finding |
|----------|--------|-------------|
| QA       | **PASS**   | 32/32 tests pass |
| PDSA     | **PASS**   | Implementation matches design |

SCOPE & RISK
- Scope: On-scope
- Risk: Low — CSS-only change, no logic impact
- Impact: Badge text readable in dependency panels

RECOMMENDATION
**APPROVE** — Clean CSS fix, all tests pass, both reviewers approved. Deploy to TEST recommended (deployment gap detected).
===
```

---

## Reference

- **CLI:** `xpollination-mcp-server/src/db/interface-cli.js`
- **Project DBs:**
  - `xpollination-best-practices/data/xpollination.db`
  - `xpollination-mcp-server/data/xpollination.db`
  - `HomePage/data/xpollination.db`
- **Brain API:** `POST http://localhost:3200/api/v1/memory`
- **Workflow:** `xpollination-mcp-server/docs/WORKFLOW.md`
