# PDSA v0.0.5 — Auto-claim checks conflict winner

Fix: Before executing (step 2), auto-claim queries all active claims for the logicalId. If multiple exist, calls resolveConflict(). Loser skips execution.
