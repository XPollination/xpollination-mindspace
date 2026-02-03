# PDSA: PDSA and QA Role Separation

**Date:** 2026-02-03
**Node:** roles-pdsa-qa-separation (ACTIVE)
**Type:** Process Design

## PLAN

### Problem Statement
Current documentation conflates PDSA and QA as a single "PDSA+QA" role. This is imprecise.

**Reality:**
- PDSA and QA are **two distinct roles** with different responsibilities
- Current **3-pane configuration** has one agent handling both roles
- This is a deployment choice, not a role definition

### Role Definitions

#### PDSA Agent Role
**Purpose:** Plan-Do-Study-Act methodology execution

| Responsibility | Actions |
|----------------|---------|
| **PLAN** | Analyze requirements, research approaches, design solutions, document in PDSA |
| **DO** | Hand off to Dev agent (via orchestrator), do NOT implement |
| **STUDY** | Review Dev's implementation against plan, document findings |
| **ACT** | Recommend process improvements, update CLAUDE.md learnings |

**Creates:** Design nodes, PDSA documents
**Does NOT:** Implement code, run tests, create task/requirement nodes

#### QA Agent Role
**Purpose:** Quality assurance and testing

| Responsibility | Actions |
|----------------|---------|
| Test execution | Run test suites, verify acceptance criteria |
| Test creation | Write test cases for new features |
| Verification | Compare implementation to specification |
| Bug reporting | Document defects, create test nodes for tracking |

**Creates:** Test nodes, test reports, bug reports
**Does NOT:** Implement fixes, plan architecture, write production code

### Current Configuration: Combined Agent

In the 3-pane layout, one Claude instance handles both roles:
```
┌──────────────┬────────────────────┐
│              │  PDSA+QA Combined  │
│ Orchestrator ├────────────────────┤
│              │       Dev          │
└──────────────┴────────────────────┘
```

**Why combined:**
- Resource constraint (3.7GB RAM, can run ~3 Claude instances)
- Workflow simplicity (fewer handoffs)
- Context sharing (test planning benefits from design context)

**Trade-offs:**
- Role confusion possible (agent may blur PDSA/QA boundaries)
- No separation of concerns (same agent plans and tests)
- Higher context usage (single context holds both jobs)

### Alternative: Separate Agents (4-pane)

If resources allowed:
```
┌──────────────┬────────────────────┐
│              │       PDSA         │
│ Orchestrator ├────────────────────┤
│              │       QA           │
│              ├────────────────────┤
│              │       Dev          │
└──────────────┴────────────────────┘
```

**Benefits:**
- Clear role separation
- Parallel work (PDSA designs next while QA tests current)
- Lower individual context usage

**Drawbacks:**
- More orchestrator overhead
- More RAM required (~4 Claude instances)
- More handoffs

## DO

### Documentation Update
Update CLAUDE.md to clarify:
1. PDSA and QA are separate **conceptual** roles
2. Current 3-pane config combines them for efficiency
3. Agent should mentally switch modes:
   - "PDSA mode" when planning/designing/reviewing
   - "QA mode" when testing/verifying
4. Future: May split if resources allow

### Handoff Pattern for Combined Agent
```
[PDSA MODE]
1. Receive design request
2. Research, plan, document PDSA
3. Complete design, activate task for Dev

[WAIT FOR DEV]

[QA MODE]
4. Receive test request (or scan for pending tests)
5. Execute tests against implementation
6. Document results in test node
7. Mark test completed
```

## STUDY

### Analysis
The combined agent configuration works well when:
- Agent maintains clear mental model of current mode
- Handoffs are explicit (design complete → wait → test)
- Context doesn't overflow from dual responsibilities

Risk areas:
- Agent doing "mini-fixes" during QA (role violation)
- Blurring plan and test phases
- Over-testing or under-planning due to role confusion

## ACT

### Process Update for CLAUDE.md

```markdown
### PDSA vs QA Roles

**PDSA Role:** Plan-Do-Study-Act execution
- Creates: design nodes, PDSA docs
- Actions: research, plan, review implementations, document learnings

**QA Role:** Quality assurance
- Creates: test nodes, test reports
- Actions: execute tests, verify criteria, document defects

**Current Config:** One agent handles both (PDSA+QA combined)
- Reason: Resource efficiency (3-pane layout)
- Agent should mentally switch between PDSA mode and QA mode
- Do NOT blur roles within a single task

**Mode Switching Cue:**
- Working on design node → PDSA mode
- Working on test node → QA mode
```
