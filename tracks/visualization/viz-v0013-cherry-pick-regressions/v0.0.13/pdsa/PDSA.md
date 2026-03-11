# PDSA: Viz v0.0.13 — Cherry-Pick Missing Features from v0.0.11

**Date:** 2026-03-11
**Task:** ms-viz-v0013-cherry-pick-regressions
**Track:** visualization
**Status:** PLAN

## Plan

### Problem

v0.0.12 was created from v0.0.11 to fix root/versioned file divergence (bind host, auto-approval dropdown). During the copy, 3 features present in v0.0.11 were lost:

1. **Version display in menu** — header shows app version via `/api/version` endpoint
2. **Queue column filter (All/Ready/Pending/Rework)** — filter buttons to narrow queue view
3. **Complete column time filter (1d/1w/1m/All)** — filter buttons to limit completed task history

### Evidence

Direct comparison of v0.0.11/index.html vs v0.0.12/index.html confirms zero matches for `queueFilter`, `viz-version`, `completeFilter`, or `setCompleteFilter` in v0.0.12.

### Design

#### REG-1: Version Display in Menu

Cherry-pick from v0.0.11:
- CSS: `.viz-version` class (line 51)
- HTML: `<span class="viz-version"></span>` in header (line 933)
- JS: fetch `/api/version` and populate span (line 1880)

#### REG-2: Queue Column Filter

Cherry-pick from v0.0.11:
- Variable: `queueFilter` with localStorage persistence (line 1021)
- HTML: All/Ready/Pending/Rework filter buttons (lines 1393-1396)
- Logic: filter `columnNodes` by status when not 'all' (lines 1412-1413)
- Function: `setQueueFilter()` (lines 1958-1959)

#### REG-3: Complete Column Time Filter

Cherry-pick from v0.0.11:
- Variable: `completeFilterDays` with localStorage persistence (line 1003)
- Config: filter options array `[{label:'1d',days:1},{label:'1w',days:7},{label:'1m',days:30},{label:'All',days:0}]` (lines 996-1001)
- HTML: filter button rendering with selected state (lines 1385-1388)
- Logic: cutoff date filtering (lines 1379-1380)
- Function: `setCompleteFilter()` (lines 2003-2008)

### NOT Changed

- All v0.0.12 additions (bind host, auto-approval dropdown) remain
- No new features — strictly cherry-picking lost functionality
- server.js unchanged (regressions are all in index.html)

### Risks

1. **Merge conflicts** — v0.0.12 restructured some HTML. Manual integration may be needed vs raw copy-paste.

## Do
(To be completed by DEV agent)

## Study
- Version displays in header menu
- Queue filter buttons appear and filter correctly
- Complete time filter buttons appear and filter correctly
- All v0.0.12 features still work

## Act
- Establish regression test: diff feature list between versions before releasing
