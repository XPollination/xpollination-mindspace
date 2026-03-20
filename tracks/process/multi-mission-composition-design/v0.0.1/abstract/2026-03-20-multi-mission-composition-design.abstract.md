# Completion Abstract: Multi-Mission Capability Composition via Relationships

**Task:** multi-mission-composition-design
**Status:** complete
**Date:** 2026-03-20
**Author:** LIAISON

## Outcome
Capabilities can now belong to multiple missions via COMPOSES relationships instead of being limited to a single mission_id FK. Migration 059 seeds COMPOSES and IMPLEMENTS relationships from existing FK data. CAP-AUTH demonstrates multi-mission composition across Agent-Human Collaboration and Fair Attribution missions.

## Changes Made
- `migrations/059-seed-relationships-from-fks.sql`: Seeds COMPOSES (mission-to-capability, bidirectional) and IMPLEMENTS (capability-to-requirement) from existing FK data
- Knowledge browser cross-reference section for multi-mission capabilities
- Breadcrumb +N badge for capabilities belonging to multiple missions
- FK columns preserved for backward compatibility

## Key Decisions
- Incremental migration: FK columns preserved rather than removed, ensuring backward compat
- Breadcrumb +N badge chosen over full mission list in breadcrumb (cleaner UI)
- Bidirectional COMPOSES relationships for consistent traversal

## Documentation Objects Added
- PDSA: `tracks/process/multi-mission-composition-design/v0.0.1/PDSA.md`

## Learnings
- Relationship-based composition enables capabilities to serve multiple missions without schema changes to the capability table
- Seeding from existing FKs ensures zero data loss during migration
