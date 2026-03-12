-- Add warning_sent column to leases for dedup of LEASE_WARNING notifications
ALTER TABLE leases ADD COLUMN warning_sent INTEGER NOT NULL DEFAULT 0;
