# PDSA: Capability Suggestion During Mission Planning

**Task:** capability-discovery-design | **Version:** v0.0.1 | **Requirement:** REQ-OG-006

## Design Decisions
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Dual search: vector similarity + text matching | Vector catches semantic matches, text catches exact names. |
| D2 | Three suggestion types: compose, extend, create | Compose = reuse existing. Extend = add requirements. Create = new capability needed. |

## Flow
Agent describes need → POST /a2a/suggest_capabilities → dual search across capabilities → rank by similarity → return: existing caps to COMPOSE (>0.8), existing to EXTEND (0.5-0.8), or suggest CREATE (<0.5). Response includes capability details + relationship type.

## Acceptance Criteria
- AC1: suggest_capabilities endpoint, AC2: Vector + text dual search, AC3: Three tiers (compose/extend/create), AC4: Ranked results with scores, AC5: Returns capability details for compose candidates
