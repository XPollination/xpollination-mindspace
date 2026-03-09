# PDSA: AGENTS.md + CONTRIBUTING.md with Traceability Convention

**Task:** t1-2-traceability-convention
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

The xpollination-mcp-server project has no documented traceability convention. 113+ tasks will produce code over the coming weeks. Without a convention documented in agent-agnostic files, that code will lack TSDoc traceability tags (`@capability`, `@requirement`, `@satisfies`, `@decision`) and structured commit messages. Retroactive annotation is expensive.

T1.1 (tsdoc.json) defined the tags at the TypeScript tooling level. T1.2 documents the CONVENTION for using those tags — in files that survive any agent swap, IDE change, or tooling migration.

## Analysis

The traceability implementation plan (v0.0.7 addendum) specifies:

- **AGENTS.md** — Cross-agent standard file. Read by Claude Code, Cursor, Copilot, Windsurf, and any future AI coding agent. Part of the Linux Foundation Agentic AI Foundation standard.
- **CONTRIBUTING.md** — Git-universal file. Read by every developer and every tool that works with Git.

Both files carry the same traceability convention section. The content is verbatim from the implementation plan (lines 66-103).

NOT in SKILL.md (Claude-specific), NOT in .cursorrules (Cursor-specific), NOT in CLAUDE.md (tool-bound). These are agent-agnostic, platform-agnostic files.

The task DNA says "Projekt: xpollination-mcp-server, xpollination-best-practices". T1.3 will bootstrap all repos — T1.2 creates the canonical files in xpollination-mcp-server first (the primary project), then optionally in xpollination-best-practices.

Key decisions:
1. Both files share the same traceability convention section — verbatim from the implementation plan
2. AGENTS.md is new — it only contains the traceability convention for now
3. CONTRIBUTING.md is new — it contains the traceability convention plus basic contribution guidelines
4. Compliance level is SHOULD (becomes MUST with A2A enforcement in Phase 2)

## Design

### Change A: Create AGENTS.md in xpollination-mcp-server project root

```markdown
# AGENTS.md

Cross-agent standard for the xpollination-mcp-server project.
This file is read by Claude Code, Cursor, Copilot, Windsurf, and any AI coding agent.

## Code Traceability Convention

This project uses TSDoc tags for end-to-end requirement traceability.
These tags are the data foundation for automated validation (enforced
via A2A protocol when available, convention-based until then).

Every exported function, class, and interface SHOULD include:

  @capability  CAP-ID    (which capability: CAP-FOUNDATION, CAP-AUTH, etc.)
  @requirement REQ-ID    (which requirement: REQ-LEASE-001, etc.)
  @satisfies   TASK-ID   (which task: A3.4, A11.5, etc.)
  @decision    ADR-NNN   (optional: which architecture decision)

Example:
  /**
   * Creates a time-bonded lease for a claimed task.
   *
   * @capability CAP-TASK-ENGINE
   * @requirement REQ-LEASE-001
   * @satisfies A3.4
   * @decision ADR-007
   *
   * Lease duration configurable per role.
   */
  export async function createLease(...): Promise<Lease> {

Every commit SHOULD follow:
  type(scope): [CAP-ID] [REQ-ID] [TASK-ID] description

Example:
  feat(lease): [CAP-TASK-ENGINE] [REQ-LEASE-001] [A3.4] create time-bonded lease

Every test SHOULD include @requirement and @satisfies tags.

Note: "SHOULD" becomes "MUST" once A2A attestation enforcement is active.
Until then, compliance is convention-based. Missing tags will require
retroactive annotation when enforcement activates.
```

### Change B: Create CONTRIBUTING.md in xpollination-mcp-server project root

```markdown
# Contributing to xpollination-mcp-server

## Code Traceability Convention

This project uses TSDoc tags for end-to-end requirement traceability.
These tags are the data foundation for automated validation (enforced
via A2A protocol when available, convention-based until then).

Every exported function, class, and interface SHOULD include:

  @capability  CAP-ID    (which capability: CAP-FOUNDATION, CAP-AUTH, etc.)
  @requirement REQ-ID    (which requirement: REQ-LEASE-001, etc.)
  @satisfies   TASK-ID   (which task: A3.4, A11.5, etc.)
  @decision    ADR-NNN   (optional: which architecture decision)

Example:
  /**
   * Creates a time-bonded lease for a claimed task.
   *
   * @capability CAP-TASK-ENGINE
   * @requirement REQ-LEASE-001
   * @satisfies A3.4
   * @decision ADR-007
   *
   * Lease duration configurable per role.
   */
  export async function createLease(...): Promise<Lease> {

Every commit SHOULD follow:
  type(scope): [CAP-ID] [REQ-ID] [TASK-ID] description

Example:
  feat(lease): [CAP-TASK-ENGINE] [REQ-LEASE-001] [A3.4] create time-bonded lease

Every test SHOULD include @requirement and @satisfies tags.

Note: "SHOULD" becomes "MUST" once A2A attestation enforcement is active.
Until then, compliance is convention-based. Missing tags will require
retroactive annotation when enforcement activates.

## Git Protocol

- Specific file staging only — never `git add .` or `git add -A`
- Atomic commands — no `&&` chaining
- One-liner commits — `git commit -m "type: description"`
- Immediate push after commit
```

### Files Changed

1. `xpollination-mcp-server/AGENTS.md` — new file, project root
2. `xpollination-mcp-server/CONTRIBUTING.md` — new file, project root

### Testing

1. `AGENTS.md` exists at project root
2. `CONTRIBUTING.md` exists at project root
3. Both contain "Code Traceability Convention" section
4. Four TSDoc tags documented: `@capability`, `@requirement`, `@satisfies`, `@decision`
5. All tags described as `SHOULD` (not `MUST`)
6. Commit message format documented: `type(scope): [CAP-ID] [REQ-ID] [TASK-ID] description`
7. Example code block with all 4 tags present
8. Example commit message present
9. Note about SHOULD→MUST transition with A2A present
10. Test tagging convention documented (@requirement, @satisfies)
11. AGENTS.md header identifies it as cross-agent standard
12. CONTRIBUTING.md includes basic git protocol
13. Neither file references Claude-specific or Cursor-specific tooling
