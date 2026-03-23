# PM Status — Examples Reference

Referenced from SKILL.md. Load only if presentation quality degrades.

## Good Example

```
=== Task 1 of 3: Fix monitor missing review+liaison tasks ===
DESIGN QUEUE > DESIGNING > APPROVAL > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > >>>HUMAN REVIEW<<< > COMPLETE

BRANCH COMPLIANCE: OK (commit abc1234 on develop)
VERSIONING: OK (v0.0.1, PDSA.md + changelog.md present)
REF VALIDATION: OK (pdsa_ref → xpollination-mcp-server/develop, matches project)

Type: bug | Priority: high | Project: xpollination-mcp-server
Status: review+liaison → Action: Complete or Rework?

MANAGEMENT ABSTRACT
The agent monitor was not detecting tasks in review+liaison state, causing
Thomas to miss decisions. Root cause: SQL query filtered on role=liaison
but review+liaison tasks have role=liaison already set. Fix: adjusted
query to also match status LIKE 'review%' when role=liaison.

WHAT WAS DONE
- Fixed SQL query in agent-monitor.cjs line 142
- Added test case for review+liaison detection
- Commit: abc1234 "fix: monitor query for review+liaison tasks"

REVIEW CHAIN
| Reviewer | Result | Key Finding |
|----------|--------|-------------|
| QA       | PASS   | Test confirms review+liaison tasks now detected |
| PDSA     | PASS   | Fix matches design, no scope creep |

SCOPE & RISK
- Scope: On-scope — single query fix as designed
- Risk: Low — isolated change, backward compatible
- Impact: Thomas will now see all pending decisions in pm.status

RECOMMENDATION
APPROVE — Clean fix, both reviewers passed, addresses the reported gap.
```

## Bad Example (do NOT do this)

```
Title: Fix monitor missing review+liaison tasks
Findings: {"root_cause": "SQL query...", "fix": "adjusted query..."}
QA Review: passed
PDSA Review: passed
Approve or Rework?
```

This dumps raw DNA without evaluation — Thomas must parse it himself.
