# PDSA v0.0.3 — Create executes relation on claim

Fix: auto-claim now creates relation-twin {relationType: executes, source: runnerDID, target: taskCID} after claiming task. PermissionResolver.check() finds this relation and allows access.
