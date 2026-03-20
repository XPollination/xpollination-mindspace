# PDSA: Proactive Thought Push via A2A SSE

**Task:** proactive-push-design | **Version:** v0.0.1 | **Requirement:** REQ-A2A-008

## Design Decisions
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | On brain contribution, compute similarity to active missions | Catch relevant insights automatically. |
| D2 | Push THOUGHT_RELEVANT SSE event if score > 0.7 | Threshold prevents noise. Agent decides action. |

## Flow
Brain POST /api/v1/memory → contribution stored → compute cosine similarity vs active mission embeddings → if > 0.7 → push THOUGHT_RELEVANT to agents watching that mission via SSE → agent can query brain for full thought.

## Acceptance Criteria
- AC1: Brain triggers similarity check on contribution, AC2: THOUGHT_RELEVANT SSE event with thought_id + score, AC3: Configurable threshold, AC4: Only push to agents watching relevant mission
