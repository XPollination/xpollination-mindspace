# PDSA: Structured Brain-Write Template + Hook Validation

**Task:** p0-1-brain-write-quality
**Priority:** Critical
**Date:** 2026-03-06

## Plan

Quality audit found brain contributions lack substance. Agents echo search queries into brain as "contributions" and write minimal transition markers that serve as breadcrumbs but contain no useful knowledge.

### Problem

1. Brain SKILL.md has no structured templates for task boundary contributions
2. interface-cli.js `contributeToBrain()` has no validation — query-shaped text gets stored
3. Monitor SKILL.md TASK START markers are minimal single-line strings

### Proposed Changes

**Change A — Brain SKILL.md (xpollination-best-practices)**
Add "Brain-Write Quality Rules" section after existing "Do NOT contribute" section:

- RULE 1: Task boundary writes MUST use structured templates
  - TASK START requires: Context, Prior_work, Plan
  - TASK END requires: Outcome, What_I_did, Key_findings, Open_items, Next
- RULE 2: Never contribute search queries. Questions are READs, not WRITEs. Only conclusions, decisions, and findings are valid.
- RULE 3: Transition markers supplement DNA, not replace it. Keep concise (1-3 sentences) but substantive.

**Change B — interface-cli.js (xpollination-mcp-server)**
Add `validateBrainWrite(prompt)` function before `contributeToBrain()`:

Validation rules:
- Reject if prompt ends with `?` (interrogative)
- Reject if length < 50 chars
- Reject if matches known query patterns: "Recovery protocol", "Current task state", "TASK START or TASK BLOCKED markers", "What are my responsibilities"
- Reject if prompt is near-duplicate of slug

Behavior: Non-blocking. Validation failure logs to stderr, returns false. Transitions still succeed.

**Change C — Monitor SKILL.md (xpollination-best-practices)**
Update step 4b and 7b templates:

TASK START template:
```
TASK START: {ROLE} claiming {slug} ({project}) - {title}. Context: {why this task exists}. Prior work: {what brain/DNA says}. Plan: {1-3 sentence approach}.
```

TASK END template:
```
TASK {from}->{to}: {ROLE} {slug} ({project}). Outcome: {pass/fail/partial}. What I did: {1-3 sentences}. Key findings: {substantive learning}. Open items: {if any}. Next: {what happens next}.
```

## Do

- DEV implements Change B (interface-cli.js validation hook)
- PDSA implements Changes A and C (SKILL.md process documents) after approval

## Study

- Verify validateBrainWrite() correctly rejects query-shaped text
- Verify it does NOT block legitimate transition markers
- Verify SKILL.md templates are followed by agents in subsequent tasks

## Act

- If validation is too aggressive (blocking legit contributions), relax patterns
- If agents ignore templates, consider enforcing via brain API server-side
