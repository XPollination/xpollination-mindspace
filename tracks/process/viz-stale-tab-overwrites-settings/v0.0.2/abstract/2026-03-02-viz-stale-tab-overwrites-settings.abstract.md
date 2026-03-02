# Completion Abstract: viz-stale-tab-overwrites-settings

**Date:** 2026-03-02
**Status:** Complete
**Project:** xpollination-mcp-server

## Outcome

Fixed a bug where opening a stale browser tab would overwrite the current `liaison-approval-mode` setting with a cached value. The fix ensures only explicit user dropdown interactions write to the server, while programmatic value changes are suppressed.

## Key Decisions

- **suppressModeChange flag:** Simple boolean guard separates programmatic `.value=` changes from user-initiated dropdown clicks.
- **visibilitychange refresh:** Tab regaining focus loads current server state before user can interact, preventing stale data from persisting.
- **Minimal approach:** 5-line change, no architectural rework needed.

## Changes

- `viz/index.html`: Added suppressModeChange flag, loadLiaisonMode() on visibilitychange, guard in change handler
- Commit: 42682cd

## Test Results

- QA PASS (verified suppressModeChange guard, visibilitychange handler, explicit-only writes)
- PDSA PASS (root cause confirmed, no race conditions, minimal blast radius)

## Related Documentation

- Origin: Thomas reported mode reverting from auto to manual when opening stale browser tab (2026-03-02)
