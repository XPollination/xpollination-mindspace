# PDSA: Register REQ-* Requirements into DB

**Task:** ms-requirement-registration | **Version:** v0.0.1 | **Status:** PLAN
**Roadmap:** ROAD-002 Phase 1

## Problem
REQ-* entries exist in Brain as thoughts but not in the requirements DB table. No hierarchy linking to Capabilities.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Extract REQ-* from Brain via API query | Brain has the source data |
| D2 | Create requirement rows in DB with title, description, capability_id | Structured data for hierarchy |
| D3 | Map REQ to Capability: REQ-AGENT→CAP-AGENT-PROTOCOL, REQ-A2A→CAP-AGENT-PROTOCOL, REQ-BRANCH→CAP-INTEGRATION, REQ-IPLD→CAP-FOUNDATION | Logical grouping |
| D4 | Thomas confirms mappings before committing | Human oversight on hierarchy |
| D5 | Idempotent script (INSERT OR IGNORE) | Safe to re-run |

### Acceptance Criteria
- AC1: All REQ-* entries registered in requirements table
- AC2: Each requirement linked to correct capability
- AC3: Viz hierarchy: Mission→Capability→Requirement shows data
- AC4: Thomas confirmed mappings
- AC5: Script is idempotent

### Files: Migration script or seed script for requirements + capability_requirements linking
