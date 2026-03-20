# PDSA: capability_version_history Table

## Plan
Create table to track capability version history. Each row: capability_id, version, content snapshot, changed_by, timestamp.
Migration adds table + index. Integrates with existing node_content_history pattern from kb-schema-migration.

## Do
DEV creates migration with CREATE TABLE + index.

## Study
Table exists, insert/query works, index on capability_id.

## Act
Reuse node_content_history pattern but specific to capabilities. Version as integer, auto-increment on content change.
