-- Add req_version column to attestations for version-checking
ALTER TABLE attestations ADD COLUMN req_version INTEGER;
