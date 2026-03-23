# Changelog: xpo.claude.mindspace.pm.status

## v0.0.5 — 2026-03-11

- Added `auto-approval` mode documentation (approval→approved=AUTO, review→complete=SEMI)
  - Mode-aware batch behavior table: 4 modes × 2 transition types = clear matrix
  - Auto-approval mode: approvals auto-execute, completions use AskUserQuestion
- Added Completion DNA Gates section — required fields before `review→complete` transition:
  - `abstract_ref`, `changelog_ref`, `test_pass_count`, `test_total_count` (all mandatory)
  - Pattern for batch completions: set gate fields first, then transition
- Batch options now use AskUserQuestion (selectable keyboard options) instead of plain text
  - Wording adapts: "Approve All" for approval batches, "Complete All" for completion batches
  - AskUserQuestion template with 3 options: action (recommended), review individually, rework
- Updated Step 3d.5 with explicit `auto-approval` mode behavior per transition type

## v0.0.4 — 2026-03-11

- Added 5-stage progress feedback protocol to Step 3b (batch preparation)
  - Stage 1: Preparation start with value framing (consolidating for efficient review)
  - Stage 2: DNA fetch progress — per-task for ≤5 tasks, every 3rd for >5 tasks
  - Stage 3: Verification notification (branch compliance, versioning, ref validation)
  - Stage 4: Grouping result with individual vs batch count
  - Stage 5: Preparation complete message before first presentation
- Agents MUST output at each stage (no silent preparation phases)
- Added slow-response hint for DNA fetches taking longer than 5 seconds

## v0.0.3 — 2026-03-11

- Added hybrid review pattern to Phase 2 (Step 3)
  - Analyze all actionable tasks and group by theme/capability area
  - Individual drill-down for FAIL-reviewed, high-impact, or unique tasks
  - Themed Batch review for 3+ related tasks with PASS outcomes
  - Batch includes summary table with Approve All and Review Individually options
  - Confirmation stops at group boundaries, not per task
  - Reduced 12 reviews from 12 confirmation stops to 3 in real-world usage
- Added skill versioning: versions/v0.0.2/ preserves previous, versions/v0.0.3/ is active
- SKILL.md is now a symlink to versions/v0.0.3/SKILL.md

## v0.0.2 — 2026-03-10

- Added recommendation options pattern for SEMI mode AskUserQuestion
  - First option is LIAISON's recommendation with `(Recommended)` suffix and reasoning
  - Second option is the alternative with explanation of when/why it makes sense
  - Thomas sees trade-offs at a glance without follow-up questions
- Added `version: 0.0.2` to frontmatter
- Created this CHANGELOG.md

## v0.0.1 — 2026-03-09

- Initial skill: PM status scan, brain health, Phase 1 summary, Phase 2 sequential drill-down
- SEMI/AUTO/MANUAL mode support
- Automated verification checks (branch compliance, versioning, ref validation, deployment)
- Rendering style guide
- Deployment action guidance
