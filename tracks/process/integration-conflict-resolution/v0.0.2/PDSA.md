# PDSA v0.0.2 — Conflict resolution rework

## Problem
After detecting heads>1, the resolution wasn't propagated — both nodes kept 2 heads.

## Fix
`autoResolveConflict()` creates a merge twin (evolves winner with `mergedFrom: losers`), docks it (becomes new single head), and publishes to transport so other nodes converge.
