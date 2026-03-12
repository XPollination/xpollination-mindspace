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
