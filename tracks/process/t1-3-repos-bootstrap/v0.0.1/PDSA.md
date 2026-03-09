# PDSA: Bootstrap Traceability Convention Across All Repos

**Task:** t1-3-repos-bootstrap
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

T1.2 created AGENTS.md and CONTRIBUTING.md in xpollination-mcp-server only. The traceability convention must be present in all three project repos (xpollination-mcp-server, xpollination-best-practices, HomePage) so that any agent cloning any repo finds the convention automatically. Additionally, the D2.3 branching docs in xpollination-mcp-server's CLAUDE.md should reference the traceability convention for cross-awareness.

## Analysis

### Current state

| Repo | AGENTS.md | CONTRIBUTING.md |
|------|-----------|-----------------|
| xpollination-mcp-server | EXISTS (T1.2) | EXISTS (T1.2) |
| xpollination-best-practices | MISSING | MISSING |
| HomePage | MISSING | MISSING |

### Project differences

Each project needs adapted files:

- **xpollination-best-practices**: Process/methodology repo. No TypeScript code — primarily markdown, PDSA docs, skills, scripts. Traceability convention still applies to any code (bash scripts, Node.js utilities) and commit messages. Git protocol same as global CLAUDE.md.
- **HomePage**: Static website repo. HTML/CSS/JS. Uses version-based workflow (versions/vX.Y.Z/site/). Traceability convention applies to JS files and commit messages. Git protocol follows the version workflow in its CLAUDE.md.

### Adaptation approach

The Code Traceability Convention section is IDENTICAL across all repos — it defines a universal standard. The framing text (header, project name) and Git Protocol section adapt per project.

### D2.3 branching docs reference

xpollination-mcp-server's CLAUDE.md already has a "Branching Rules (Interim)" section from D2.3. T1.3 adds a cross-reference from that section to the traceability convention in AGENTS.md/CONTRIBUTING.md, connecting the two standards.

## Design

### Change A: Create AGENTS.md in xpollination-best-practices

```markdown
# AGENTS.md

Cross-agent standard for the xpollination-best-practices project.
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

### Change B: Create CONTRIBUTING.md in xpollination-best-practices

```markdown
# Contributing to xpollination-best-practices

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

### Change C: Create AGENTS.md in HomePage

```markdown
# AGENTS.md

Cross-agent standard for the HomePage project.
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

### Change D: Create CONTRIBUTING.md in HomePage

```markdown
# Contributing to HomePage

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
- Follow version workflow in CLAUDE.md for deployments
```

### Change E: Add traceability cross-reference to D2.3 branching section in xpollination-mcp-server CLAUDE.md

Add one line at the end of the existing "Branching Rules (Interim)" section in xpollination-mcp-server/CLAUDE.md:

```markdown
**Traceability:** See `AGENTS.md` and `CONTRIBUTING.md` for code annotation and commit message conventions.
```

This connects the branching rules (D2.3) with the traceability convention (T1.2/T1.3) so agents following one set of rules discover the other.

### Files Changed

1. `xpollination-best-practices/AGENTS.md` — new file, project root
2. `xpollination-best-practices/CONTRIBUTING.md` — new file, project root
3. `HomePage/AGENTS.md` — new file, project root
4. `HomePage/CONTRIBUTING.md` — new file, project root
5. `xpollination-mcp-server/CLAUDE.md` — add traceability reference to branching section

### Testing

1. AGENTS.md exists at root of xpollination-best-practices
2. CONTRIBUTING.md exists at root of xpollination-best-practices
3. AGENTS.md exists at root of HomePage
4. CONTRIBUTING.md exists at root of HomePage
5. All four new files contain "Code Traceability Convention" section
6. All four files document the same 4 TSDoc tags (@capability, @requirement, @satisfies, @decision)
7. All tags described as SHOULD (not MUST)
8. Commit message format documented in all files
9. Code example with all 4 tags in all files
10. SHOULD→MUST A2A note in all files
11. Test tagging convention in all files
12. AGENTS.md headers identify correct project name
13. CONTRIBUTING.md files include git protocol
14. No tool-specific references in any file
15. xpollination-mcp-server CLAUDE.md branching section references AGENTS.md/CONTRIBUTING.md
16. Traceability convention text is identical across all repos (verbatim from T1.2)
17. xpollination-mcp-server AGENTS.md and CONTRIBUTING.md unchanged (already exist from T1.2)
