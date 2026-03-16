# PDSA: LIAISON Challenge Questions — Force Task-Specific Thinking

**Task:** ms-liaison-challenge-questions
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 Phase 1.9 iteration

## Problem

LIAISON filled liaison_review mechanically with identical text across 4 tasks. The gate enforces existence, not quality. Need questions that force task-specific answers.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | 3 mandatory APPROVAL questions (liaison_q1-q3_approval) | Force gap analysis, dependency awareness, risk assessment |
| D2 | 3 mandatory COMPLETION questions (liaison_q1-q3_complete) | Force test gap analysis, assumption check, manual verification |
| D3 | Quality gate: reject answers <20 chars or matching template patterns | Prevent "none", "N/A", "scope appropriate" |
| D4 | Template pattern detection: reject if answer matches known templates | "matches description", "Design matches", identical across tasks |
| D5 | Viz display: answers visible in Object Details as whitebox | Thomas reads exactly what LIAISON considered per question |
| D6 | SKILL.md: questions visible to agents before answering | Guidance so agents can prepare quality answers |

### Question Design

**APPROVAL (approval→approved):**
- Q1: "What specific gap exists between the description and the design?"
- Q2: "Who needs to do what that is NOT in the team's control?"
- Q3: "What will break if this design is wrong?"

**COMPLETION (review→complete):**
- Q1: "What did the tests NOT cover that the description asked for?"
- Q2: "What assumption does this implementation make about the system state?"
- Q3: "What should Thomas verify manually after deployment?"

### Acceptance Criteria

- AC1: approval→approved requires liaison_q1-q3_approval in DNA
- AC2: review→complete requires liaison_q1-q3_complete in DNA
- AC3: Answers <20 chars rejected with clear error
- AC4: Known template patterns rejected (configurable list)
- AC5: Viz Object Detail shows all 6 answers when present
- AC6: SKILL.md lists all 6 questions in LIAISON review protocol
- AC7: Each question's answer must be task-specific (no identical answers across tasks)

### Files to Change

- `src/db/workflow-engine.js` — Add question fields to requiresDna + quality validation
- `~/.claude/skills/xpo.claude.monitor/SKILL.md` — Add questions to LIAISON protocol
- `viz/versions/v0.0.X/index.html` — Render question answers in detail panel

### Test Plan

1. Attempt approval→approved without q1-q3 → blocked
2. Attempt with <20 char answer → blocked
3. Attempt with "N/A" or "none" → blocked
4. Attempt with task-specific answers → passes
5. Verify Viz shows answers in detail panel

## Do / Study / Act

(To be completed)
