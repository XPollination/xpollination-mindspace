# PDSA: Persist Filter Preferences in localStorage

**Task:** ms-viz-persist-filter-prefs | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Every page refresh resets filters to defaults. User preferences lost.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Save filter states to localStorage on every change | Persist across refreshes |
| D2 | On load: read localStorage before defaults | Restore user preferences |
| D3 | Keys: activeFilter, queueFilter, blockedFilter, completeFilterDays | All filter states |
| D4 | Reset Filters button clears localStorage + restores defaults | Escape hatch |
| D5 | Version bump (v0.0.34 per DNA) | Mandatory |

### Acceptance Criteria
- AC1: Filter changes saved to localStorage
- AC2: Page refresh restores previous filter state
- AC3: Reset button restores defaults and clears localStorage
- AC4: No localStorage → defaults applied (first visit)

### Files: `viz/versions/v0.0.X/index.html` — localStorage read/write on filter change
