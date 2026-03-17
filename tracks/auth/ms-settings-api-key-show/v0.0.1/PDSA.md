# PDSA: Bug — Settings API Key Show Stuck on Loading

**Task:** ms-settings-api-key-show | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Show API key button displays Loading... forever. Full chain: settings.html JS → fetch /api/keys → proxy → API → response → DOM update broken somewhere.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Trace full chain: JS fetch → proxy → API → response format | Find the break point |
| D2 | Verify /api/keys returns keys in format JS expects | May be array vs object mismatch |
| D3 | Verify JWT contains user_id for the keys endpoint | Keys are per-user |
| D4 | Fix JS: show masked key or "No key — Generate" on success, error message on failure | No infinite Loading |

### Acceptance Criteria
- AC1: Show button reveals masked API key (or "No key" with Generate option)
- AC2: No infinite Loading state
- AC3: Full fetch→display chain verified end-to-end

### Files: `settings.html` JS, `api/routes/keys.ts`
