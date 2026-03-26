-- Capability twin schema extension: self-deploying capability support
-- Adds config, feature_gate, activation, rollback, version columns
-- All JSON columns default NULL — existing capabilities unaffected

ALTER TABLE capabilities ADD COLUMN config TEXT DEFAULT NULL;
ALTER TABLE capabilities ADD COLUMN feature_gate TEXT DEFAULT NULL;
ALTER TABLE capabilities ADD COLUMN activation TEXT DEFAULT NULL;
ALTER TABLE capabilities ADD COLUMN rollback_plan TEXT DEFAULT NULL;
ALTER TABLE capabilities ADD COLUMN version TEXT DEFAULT '1.0.0';
