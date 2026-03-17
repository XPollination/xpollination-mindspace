-- Add dna column (alias for dna_json) for unified database access
ALTER TABLE tasks ADD COLUMN dna TEXT;
