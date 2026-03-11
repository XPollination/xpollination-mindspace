# Changelog: ms-a6-1-release-table

## v0.0.1 — Initial Design

- PDSA design for releases table + create release endpoint
- Migration 022: releases with status CHECK (draft/sealed), version UNIQUE
- POST/GET/PUT at /api/projects/:slug/releases
- Admin creates, viewer lists/gets, sealed releases immutable
- 3 files: migration (NEW), releases.ts (NEW), projects.ts (UPDATE)
- 12 test cases
