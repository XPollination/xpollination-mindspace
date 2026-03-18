# PDSA: Hive Logo Fix + Onboarding Update

**Task:** ms-hive-logo-fix | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Hive shows wrong logo (xpollination-logo-256 instead of Mindspace). Onboarding instructions outdated — A2A connect needs direct API URL, not nginx proxy.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Replace logo with mindspace-logo-120.webp/png (exists in viz/assets) | Correct branding |
| D2 | Update A2A instructions: use direct API port 3100, not nginx catch-all | Proxy mangles JSON body |
| D3 | Add full digital twin payload example (5 required sections) | Agent developers need working example |
| D4 | Add Mindspace API URL alongside Brain endpoints | Complete onboarding info |

### Acceptance Criteria
- AC1: Hive page shows Mindspace logo, not xpollination logo
- AC2: A2A connect instructions use direct API URL
- AC3: Digital twin payload example complete with all 5 sections
- AC4: Both Brain and Mindspace URLs documented

### Files: Brain API onboarding page, logo assets
