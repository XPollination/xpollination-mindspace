# Operational: Remove unused test_brain_* Qdrant collections

**Task:** cleanup-test-qdrant-collections
**Version:** v0.0.1
**Type:** Operational cleanup (no code change)
**Date:** 2026-03-09

## Problem

5 empty `test_brain_*` Qdrant collections were created speculatively by task d1-4-test-qdrant-collections. All had 0 points, no consumer existed, no routing mechanism was defined.

## Action

Delete all 5 collections via Qdrant DELETE API:
- test_brain_queries
- test_brain_best_practices
- test_brain_thought_space
- test_brain_thought_space_maria
- test_brain_thought_space_shared

## Principle

Do not create infrastructure speculatively. Create it when there is a concrete use case and a defined consumer.
