# PDSA v0.0.4 — Query-based conflict detection

Fix: replaced heads()-based detection with query-based: find all twins with same logicalId + status=active + claimed_by. Also getLatestTwin uses query+sort by version instead of heads().
