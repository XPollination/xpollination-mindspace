# PDSA: integration-runner-auto-claim v0.0.2 (Rework)

## Problem
Claimed twin not propagating to other nodes — getTasksForRole on remote node couldn't see active tasks.

## Fix
1. Auto-claim publishes `twin.evolved` event after claiming (status=active)
2. `handleTaskAnnouncement` now processes `twin.evolved` events (not just `twin.created`)
